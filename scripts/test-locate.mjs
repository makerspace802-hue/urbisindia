/**
 * Functional checks for the location chain.
 *
 * The geolocation fallback is the critical fix in this refactor, and "it
 * compiles" says nothing about whether it degrades correctly. This drives
 * `locate()` through every branch with stubbed browser globals: cache hit,
 * GPS success, denial, timeout, IP fallback, and the final default city.
 *
 *   node scripts/test-locate.mjs
 */

import assert from "node:assert/strict";
import { transformSync } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* -- stub the browser environment before importing locate.ts -- */

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const storage = makeStorage();
globalThis.window = { localStorage: storage };

// Node 22 exposes `navigator` as a getter-only global, so a plain assignment
// throws. defineProperty replaces the accessor outright.
function setNavigator(value) {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
}

setNavigator({});
delete globalThis.fetch;

const out = join(tmpdir(), "urbis-locate-test.mjs");
writeFileSync(
  out,
  transformSync(readFileSync("src/lib/locate.ts", "utf8"), { loader: "ts", format: "esm" }).code,
);
const locate = await import(`file://${out}?v=${Date.now()}`);

/* -- harness -- */

let passed = 0;
const failures = [];

async function test(name, fn) {
  storage._map.clear();
  try {
    await fn();
    passed++;
  } catch (error) {
    failures.push(`${name} — ${error.message}`);
  }
}

/** Installs a navigator whose getCurrentPosition follows `behaviour`. */
function stubGeo(behaviour) {
  setNavigator({ geolocation: { getCurrentPosition: behaviour } });
}

/** Installs a navigator with no geolocation support at all. */
function stubNoGeo() {
  setNavigator({});
}

const neverCalled = () => {
  throw new Error("geolocation should not have been called");
};

/** A radio that simply never answers — neither callback is ever invoked. */
const hangsForever = () => {};

const cacheSeed = (overrides = {}) => {
  storage.setItem(
    "urbis.location.v1",
    JSON.stringify({
      lat: 19.076,
      lon: 72.8777,
      label: "Mumbai, Maharashtra",
      state: "Maharashtra",
      at: Date.now(),
      ...overrides,
    }),
  );
};

/* -- tests -- */

await test("unsupported browser falls back to the configured city", async () => {
  stubNoGeo();
  globalThis.fetch = async () => {
    throw new Error("IP lookup should not run when geolocation is absent");
  };
  const r = await locate.locate();
  assert.equal(r.status, "unsupported");
  assert.equal(r.fix.source, "fallback");
  assert.equal(r.fix.label, "Bhopal");
  assert.equal(r.fix.lat, locate.FALLBACK_PLACE.lat);
  assert.equal(r.approximate, true);
});

await test("GPS success is exact and is cached", async () => {
  stubGeo((ok) => ok({ coords: { latitude: 23.2599, longitude: 77.4126 } }));
  const r = await locate.locate({ resolveState: () => "Madhya Pradesh" });
  assert.equal(r.status, "success");
  assert.equal(r.fix.source, "gps");
  assert.equal(r.fix.state, "Madhya Pradesh");
  assert.equal(r.approximate, false);
  assert.ok(storage.getItem("urbis.location.v1"), "GPS fix should be cached");
});

await test("denied permission degrades to IP lookup", async () => {
  stubGeo((ok, fail) => fail({ code: 1 }));
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ latitude: "19.076", longitude: "72.8777", city: "Mumbai", region: "Maharashtra" }),
  });
  const r = await locate.locate({ resolveState: () => "Maharashtra" });
  // Status still reports the real reason, even though IP answered.
  assert.equal(r.status, "denied");
  assert.equal(r.fix.source, "ip");
  assert.equal(r.fix.label, "Mumbai, Maharashtra");
  assert.equal(r.approximate, true);
});

await test("IP rate limit is treated as no answer, not a crash", async () => {
  stubGeo((ok, fail) => fail({ code: 1 }));
  // ipapi.co returns 429 with a JSON error body, not an HTTP error.
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: true, reason: "RateLimited" }),
  });
  const r = await locate.locate();
  assert.equal(r.status, "denied");
  assert.equal(r.fix.source, "fallback");
  assert.equal(r.fix.label, "Bhopal");
});

await test("IP returning a non-India payload does not fabricate a state", async () => {
  stubGeo((ok, fail) => fail({ code: 1 }));
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ latitude: 37.3382, longitude: -121.8863, city: "San Jose", region: "California" }),
  });
  const r = await locate.locate({ resolveState: () => null });
  assert.equal(r.fix.source, "ip");
  assert.equal(r.fix.state, null, "a US fix must not be forced into a Census state");
});

await test("position-unavailable maps to timeout, not denial", async () => {
  stubGeo((ok, fail) => fail({ code: 2 }));
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  const r = await locate.locate();
  assert.equal(r.status, "timeout");
});

await test("a hung radio times out instead of hanging the page", async () => {
  stubGeo(hangsForever); // never invokes either callback
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0); // fire the deadline now
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  const r = await locate.locate();
  globalThis.setTimeout = realTimeout;
  assert.equal(r.status, "timeout");
});

await test("a synchronous throw from getCurrentPosition degrades safely", async () => {
  // Some browsers expose geolocation but throw when it is blocked by policy,
  // so a bare feature check is not enough to promise the call works.
  stubGeo(neverCalled);
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  const r = await locate.locate();
  assert.equal(r.status, "denied");
  assert.equal(r.fix.source, "fallback");
});

await test("a fresh cache hit skips both the prompt and the network", async () => {
  cacheSeed();
  stubGeo(neverCalled);
  globalThis.fetch = async () => {
    throw new Error("cache hit must not hit the network");
  };
  const r = await locate.locate();
  assert.equal(r.status, "success");
  assert.equal(r.fix.source, "cache");
  assert.equal(r.fix.state, "Maharashtra");
  assert.equal(r.approximate, false, "a replayed GPS fix is real, not an approximation");
});

await test("the IP fallback is never cached", async () => {
  stubGeo((ok, fail) => fail({ code: 1 }));
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ latitude: "19.076", longitude: "72.8777", city: "Mumbai" }),
  });
  await locate.locate();
  assert.equal(
    storage.getItem("urbis.location.v1"),
    null,
    "caching an exit-node guess would pin a VPN or hotel-network location for 6h",
  );
});

await test("a denied fix and a timeout report different statuses", async () => {
  stubGeo((ok, fail) => fail({ code: 1 }));
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  const denied = await locate.locate();
  assert.equal(denied.status, "denied");

  storage._map.clear();
  stubGeo((ok, fail) => fail({ code: 3 }));
  const timedOut = await locate.locate();
  assert.equal(timedOut.status, "timeout");
});

await test("force re-asks the browser instead of trusting the cache", async () => {
  cacheSeed();
  let asked = false;
  stubGeo((ok) => {
    asked = true;
    ok({ coords: { latitude: 12.9716, longitude: 77.5946 } });
  });
  const r = await locate.locate({ force: true });
  assert.ok(asked, "force must re-prompt");
  assert.equal(r.fix.source, "gps");
});

await test("an expired cache is ignored", async () => {
  cacheSeed({ at: Date.now() - 7 * 60 * 60 * 1000 });
  stubGeo((ok) => ok({ coords: { latitude: 12.9716, longitude: 77.5946 } }));
  const r = await locate.locate();
  assert.equal(r.fix.source, "gps", "a cache older than the TTL must not win");
});

await test("a corrupt cache entry is discarded, not thrown on", async () => {
  storage.setItem("urbis.location.v1", "{not json");
  assert.equal(locate.readCache(), null);
  assert.equal(storage.getItem("urbis.location.v1"), null, "corrupt entry should be cleared");
});

await test("an out-of-range cached coordinate is rejected", async () => {
  cacheSeed({ lat: 999, lon: 999 });
  assert.equal(locate.readCache(), null);
});

await test("a null cached coordinate cannot leak through as 0,0", async () => {
  storage.setItem(
    "urbis.location.v1",
    JSON.stringify({ lat: null, lon: null, label: "x", state: null, at: Date.now() }),
  );
  assert.equal(locate.readCache(), null, "Number(null) is 0, which would land in the Gulf of Guinea");
});

/* -- report -- */

if (failures.length === 0) {
  console.log(`locate: ${passed}/${passed} behavioural checks passed`);
} else {
  console.log(`locate: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}