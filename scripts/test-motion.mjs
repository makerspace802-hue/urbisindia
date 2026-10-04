/**
 * Motion layer and dashboard theme.
 *
 * Two things are checked here that nothing else covers.
 *
 * 1. THEME. The dashboard's colours are parsed out of the real `index.css`, in
 *    both themes, and every foreground/background pair the tables actually put
 *    together is measured against WCAG AA. This is not a style assertion — it
 *    is arithmetic on the shipped values. It exists because the last palette
 *    printed `#FBBF24` as text on a white card at 1.67:1, and a whole theme
 *    was rejected for looking broken, and no test would have noticed.
 *
 * 2. MOTION. Every looping animation is read out of the CSS and checked to
 *    animate only `transform` and `opacity`, and every one of those loops is
 *    checked to have a `prefers-reduced-motion` escape. A keyframe that repaints
 *    on every frame is the one thing a 2.4s infinite loop must not do.
 *
 *   node scripts/test-motion.mjs
 */

import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* ==========================================================================
   Colour maths — the WCAG 2.x relative luminance formula.
   ========================================================================== */

const channel = (value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ==========================================================================
   Read the real stylesheet.
   ========================================================================== */

const css = readFileSync("src/index.css", "utf8");

/** Pulls `--name: value` pairs out of the first balanced block after `open`. */
function block(open) {
  const start = css.indexOf(open);
  assert.notEqual(start, -1, `${open} is not in index.css`);
  let depth = 0;
  for (let i = start + open.length - 1; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error(`${open} is never closed`);
}

function tokens(scope) {
  const found = {};
  for (const [, name, value] of block(scope).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found[name] = value.trim();
  }
  return found;
}

const LIGHT = tokens(":root {");
const DARK = tokens(".dark {");

/** Strips comments and collapses whitespace so assertions survive reformatting. */
function flat(path) {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\s+/g, " ");
}

/** Balanced block starting at the `{` at or after `index`. */
function balanced(source, index) {
  const open = source.indexOf("{", index);
  assert.notEqual(open, -1, "no opening brace");
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error("unbalanced block");
}

/**
 * Keyframe body, without the surrounding rule.
 *
 * Balanced rather than matched to the next `\n}`: these rules are indented, so
 * a non-greedy match to a line-starting brace runs straight through the rest of
 * the stylesheet and reports properties from unrelated rules.
 */
function keyframes(name) {
  const at = css.indexOf(`@keyframes ${name}`);
  if (at === -1) return null;
  return balanced(css, at);
}

/** Properties animated inside a keyframe body. */
function animatedProps(body) {
  const props = new Set();
  for (const line of body.split("\n")) {
    // Indented and inside a block, so a selector line like `0%,` cannot match.
    const m = /^\s+([a-z-]+)\s*:/.exec(line);
    if (m) props.add(m[1]);
  }
  return props;
}

/* ==========================================================================
   Harness
   ========================================================================== */

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failures.push(`${name} — ${error.message}`);
  }
}

/* ==========================================================================
   1. Theme tokens
   ========================================================================== */

check("both themes define the same token set", () => {
  const lightNames = Object.keys(LIGHT).filter((n) => n.startsWith("--nb-")).sort();
  const darkNames = Object.keys(DARK).filter((n) => n.startsWith("--nb-")).sort();
  assert.deepEqual(
    lightNames,
    darkNames,
    "a token present in one theme but not the other resolves to nothing when that theme is active",
  );
  // The ones the dashboard, tables and motion kit all reach for.
  for (const required of [
    "--nb-bg",
    "--nb-surface",
    "--nb-surface-2",
    "--nb-surface-hover",
    "--nb-text",
    "--nb-text-2",
    "--nb-text-muted",
    "--nb-text-dim",
    "--nb-ink",
    "--nb-table-head",
    "--nb-table-row",
    "--nb-line",
    "--nb-gain",
    "--nb-loss",
    "--nb-warn",
    "--nb-cool",
  ]) {
    assert.ok(lightNames.includes(required), `--nb-* token set is missing ${required}`);
  }
});

check("each theme has a real surface hierarchy", () => {
  // The dark palette shipped `--nb-surface-2` byte-identical to
  // `--nb-surface`, so every sub-panel, the switcher rail and the blank heat
  // cells were the exact same navy as the card behind them. That is the whole
  // reason the dark table read as flat and muddy.
  for (const [name, t] of [["light", LIGHT], ["dark", DARK]]) {
    assert.notEqual(
      t["--nb-surface-2"],
      t["--nb-surface"],
      `${name}: surface-2 is identical to surface, so there is no hierarchy`,
    );
    assert.notEqual(
      t["--nb-table-row"],
      t["--nb-surface"],
      `${name}: the sticky gutter is the same colour as the panel, so it vanishes when the table scrolls`,
    );
  }
});

check("every text/background pair the dashboard builds meets AA in both themes", () => {
  // These are the exact combinations the tables, cards and legends render.
  const FOREGROUNDS = [
    "--nb-text",
    "--nb-text-2",
    "--nb-text-muted",
    "--nb-text-dim",
    "--nb-gain",
    "--nb-loss",
    "--nb-warn",
    "--nb-cool",
  ];
  const BACKGROUNDS = [
    "--nb-surface",
    "--nb-surface-2",
    "--nb-table-head",
    "--nb-table-row",
    "--nb-bg",
  ];

  for (const [theme, t] of [["light", LIGHT], ["dark", DARK]]) {
    for (const fg of FOREGROUNDS) {
      for (const bg of BACKGROUNDS) {
        assert.ok(t[fg], `${theme}: ${fg} is undefined`);
        assert.ok(t[bg], `${theme}: ${bg} is undefined`);
        const ratio = contrast(t[fg], t[bg]);
        assert.ok(
          ratio >= 4.5,
          `${theme}: ${fg} (${t[fg]}) on ${bg} (${t[bg]}) is ${ratio.toFixed(2)}:1, below AA 4.5:1`,
        );
      }
    }
  }
});

check("the accents that used to be unreadable are now legible", () => {
  // The three values that were hard-coded and printed as TEXT on the card.
  // Each failed AA on white; the suite pins the replacement so a future
  // "simplification" back to the literals fails here rather than in review.
  const before = { green: "#10B981", amber: "#FBBF24", cyan: "#06B6D4" };
  const after = { green: "--nb-gain", amber: "--nb-warn", cyan: "--nb-cool" };

  for (const [name, hex] of Object.entries(before)) {
    const was = contrast(hex, "#ffffff");
    assert.ok(
      was < 4.5,
      `premise wrong: ${hex} already passed AA on white (${was.toFixed(2)}:1), so this test proves nothing`,
    );
    const now = contrast(LIGHT[after[name]], LIGHT["--nb-surface"]);
    assert.ok(
      now >= 4.5,
      `--nb-${name === "green" ? "gain" : name === "amber" ? "warn" : "cool"} is still only ${now.toFixed(2)}:1 on the light card`,
    );
  }
});

check("the cell gridline is not the ink border", () => {
  // A 1px rule in `--nb-ink` means pure black in both themes: harsh on white,
  // and a smudge over the tints on navy.
  const charts = flat("src/components/CensusCharts.tsx");
  assert.ok(
    !/borderColor:\s*"var\(--nb-ink\)"/.test(charts),
    "heat cells are still outlined in the ink border",
  );
  assert.match(charts, /borderColor:\s*highlight\s*\?\s*"var\(--nb-warn\)"\s*:\s*"var\(--nb-line\)"/);
  for (const [theme, t] of [["light", LIGHT], ["dark", DARK]]) {
    assert.notEqual(t["--nb-line"], t["--nb-ink"], `${theme}: --nb-line is still the ink colour`);
  }
});

check("the table's hard-coded accent text is gone", () => {
  for (const path of [
    "src/components/CensusCharts.tsx",
    "src/pages/CommandCenter.tsx",
  ]) {
    const source = flat(path);
    // These may still appear as a chip BACKGROUND with near-black text, which
    // is fine. What must not survive is them as a text colour.
    for (const hex of ["#F43F5E", "#10B981", "#06B6D4", "#FBBF24"]) {
      assert.ok(
        !new RegExp(`text-\\[${hex}\\]`).test(source),
        `${path} still prints ${hex} as a text colour`,
      );
      assert.ok(
        !new RegExp(`color:\\s*"${hex}"`).test(source),
        `${path} still sets ${hex} as an inline text colour`,
      );
    }
  }
});

check("the legend swatches point at tokens that exist", () => {
  // They referenced `--nb-accent` and `--nb-accent-loss`, which were never
  // defined — so the gain and loss swatches rendered transparent.
  const charts = flat("src/components/CensusCharts.tsx");
  assert.ok(!charts.includes("--nb-accent"), "the legend still reads an undefined accent token");
  assert.match(charts, /backgroundColor:\s*GAIN\s*}/);
  assert.match(charts, /backgroundColor:\s*LOSS\s*}/);
});

/* ==========================================================================
   2. Motion — the CSS layer
   ========================================================================== */

const LOOPS = [
  "nb-breathe",
  "nb-float",
  "nb-tag-glow",
  "nb-shimmer-sweep",
  "nb-logo-pulse",
  "nb-marquee-scroll",
  "nb-radar",
  "nb-caret-blink",
];

check("every looping animation stays on the compositor", () => {
  const allowed = new Set(["transform", "opacity"]);
  for (const name of LOOPS) {
    const body = keyframes(name);
    assert.ok(body, `@keyframes ${name} is missing`);
    const props = animatedProps(body);
    assert.ok(props.size > 0, `@keyframes ${name} animates nothing`);
    for (const prop of props) {
      assert.ok(
        allowed.has(prop),
        `@keyframes ${name} animates ${prop}; a repeating ${prop} repaints every frame`,
      );
    }
  }
});

check("every loop has a prefers-reduced-motion escape", () => {
  const blocks = [...css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g)];
  assert.ok(blocks.length > 0, "there is no reduced-motion block at all");
  const guarded = blocks.map((m) => balanced(css, m.index)).join("\n");

  const selectors = {
    "nb-breathe": ".urbis-ambient::after",
    "nb-float": ".nb-float",
    "nb-tag-glow": ".nb-neon-tag::after",
    "nb-shimmer-sweep": ".nb-shimmer::after",
    "nb-logo-pulse": ".nb-logo-glow:hover::after",
    "nb-marquee-scroll": ".nb-marquee__track",
    "nb-radar": ".nb-radar-ring",
    "nb-caret-blink": ".nb-caret",
  };
  for (const [name, selector] of Object.entries(selectors)) {
    assert.ok(
      guarded.includes(selector),
      `${name} (${selector}) still animates for a visitor who asked for reduced motion`,
    );
  }
  // And the escapes have to actually switch it off, not just be listed.
  assert.match(guarded, /animation:\s*none\s*!important/);
});

check("the ambient glow breathes on the specified curve", () => {
  assert.match(
    css,
    /\.urbis-ambient::after[\s\S]*?animation:\s*nb-breathe 8s ease-in-out infinite/,
  );
  const body = keyframes("nb-breathe");
  assert.match(body, /opacity:\s*0\.15/);
  assert.match(body, /opacity:\s*0\.3\b/);
});

check("the assistant launcher floats on the specified curve", () => {
  assert.match(css, /\.nb-float\s*\{[\s\S]*?animation:\s*nb-float 3s ease-in-out infinite/);
  const body = keyframes("nb-float");
  assert.match(body, /transform:\s*translateY\(0\)/);
  assert.match(body, /transform:\s*translateY\(-6px\)/);
});

check("the retry shimmer sweeps every three seconds", () => {
  assert.match(css, /\.nb-shimmer::after[\s\S]*?animation:\s*nb-shimmer-sweep 3s ease-in-out infinite/);
});

check("the badge glow is the specified halo, painted once", () => {
  // The halo must sit on a pseudo-element so only its opacity animates. Doing
  // it on the badge itself meant a box-shadow repaint every 2.4 seconds.
  assert.match(css, /\.nb-neon-tag::after[\s\S]*?box-shadow:\s*0 0 10px rgba\(255, 199, 0, 0\.4\)/);
  assert.match(css, /\.nb-neon-tag::after[\s\S]*?animation:\s*nb-tag-glow/);
  const badge = /\.nb-neon-tag\s*\{[\s\S]*?\}/.exec(css)[0];
  assert.ok(
    !badge.includes("animation"),
    ".nb-neon-tag animates on the badge itself, which repaints it every frame",
  );
});

check("the card hover lifts, shadows and lights the border", () => {
  const rule = /\.nb-card-lift:hover\s*\{[\s\S]*?\n  \}/.exec(css);
  assert.ok(rule, ".nb-card-lift has no hover rule");
  const body = rule[0];
  assert.match(body, /transform:\s*translateY\(-4px\)/);
  assert.match(body, /0 10px 30px -10px rgba\(0, 229, 163, 0\.2\)/);
  assert.match(body, /border-color:\s*var\(--nb-gain\)/);
});

check("the remaining interactions use the specified values", () => {
  assert.match(css, /\.nb-press:active\s*\{[\s\S]*?transform:\s*scale\(0\.95\)/);
  assert.match(css, /\.nb-nav-tab\s*\{[\s\S]*?background-color 0\.2s ease/);
  // The location alert animates from nothing to a single row.
  assert.match(css, /\.nb-banner\s*\{[\s\S]*?max-height:\s*40px/);
  assert.match(css, /\.nb-banner\[data-collapsed="true"\]\s*\{[\s\S]*?max-height:\s*0/);
  // Collapsing to zero height does not remove the controls inside it, so a
  // collapsed banner must also stop taking a tab stop.
  assert.match(
    css,
    /\.nb-banner\[data-collapsed="true"\]\s*\{[\s\S]*?visibility:\s*hidden/,
    "a collapsed banner keeps its retry button focusable",
  );
  // The glow pseudo-elements must not declare a layout property before the
  // animation, or the glow would move the layout rather than the pixels.
  for (const selector of ["nb-logo-glow", "nb-neon-tag"]) {
    const at = css.indexOf(`.${selector}::after`);
    assert.notEqual(at, -1, `.${selector}::after is missing`);
    const body = balanced(css, at);
    const before = body.split("animation")[0];
    assert.ok(
      !/\b(margin|padding|width|height|top|left|right|bottom|border-width)\s*:/.test(before),
      `.${selector}::after declares a layout property`,
    );
  }
});

/**
 * Every brace-delimited rule with its selector and body.
 *
 * Not a regex over the stylesheet: a `g` match starting after a `}` cannot
 * reuse that brace as its own anchor, so rules after the first vanish, and a
 * rule nested in `@layer` is skipped entirely — which is exactly where the
 * motion kit lives.
 */
function allRules(source) {
  const out = [];
  const stack = [];
  let mark = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "{") {
      const rule = { selector: source.slice(mark, i).trim(), open: i, close: -1 };
      out.push(rule);
      stack.push(rule);
      mark = i + 1;
    } else if (source[i] === "}") {
      const open = stack.pop();
      if (open) open.close = i;
      mark = i + 1;
    }
  }
  return out.filter((rule) => rule.close > rule.open);
}

check("every bounded loop declares will-change", () => {
  // Scoped on purpose. `will-change` on a large effect that animates for its
  // whole life is a mistake: it permanently pins a compositor layer. The
  // marquee track is `width: max-content` and never stops, and the help-bot
  // caret is one small glyph on a 900ms blink where promotion buys nothing.
  // Both are exempt here and animated only on `transform`/`opacity`
  // regardless, which the compositor-only check above covers.
  const EXEMPT = new Set(["nb-marquee-scroll", "nb-caret-blink"]);
  const rules = allRules(css);
  assert.ok(rules.length > 20, "the rule scanner found almost nothing — it is broken");

  for (const name of LOOPS) {
    const owners = rules.filter((rule) => {
      const body = css.slice(rule.open, rule.close);
      return /animation:[^;]*\b/.test(body) && body.includes(name);
    });
    assert.ok(owners.length > 0, `no selector drives @keyframes ${name}`);
    if (EXEMPT.has(name)) continue;
    for (const rule of owners) {
      const body = css.slice(rule.open, rule.close);
      if (!/infinite/.test(body)) continue;
      assert.ok(
        body.includes("will-change"),
        `${rule.selector} loops forever but never declares will-change`,
      );
    }
  }
});

/* ==========================================================================
   3. Motion — the components
   ========================================================================== */

const header = flat("src/components/AppHeader.tsx");
const centre = flat("src/pages/CommandCenter.tsx");
const charts = flat("src/components/CensusCharts.tsx");
const retro = flat("src/components/Retro.tsx");
const help = flat("src/components/HelpBot.tsx");

check("every spring in the app is stiffness 300 / damping 25", () => {
  for (const [name, source] of [
    ["AppHeader", header],
    ["CommandCenter", centre],
    ["Retro", retro],
  ]) {
    const springs = [...source.matchAll(/stiffness:\s*(\d+),\s*damping:\s*(\d+)/g)];
    assert.ok(springs.length > 0, `${name} declares no spring`);
    for (const [, stiffness, damping] of springs) {
      assert.equal(stiffness, "300", `${name} uses stiffness ${stiffness}`);
      assert.equal(damping, "25", `${name} uses damping ${damping}`);
    }
  }
});

check("the header carries its specified motion", () => {
  assert.match(header, /layoutId="activeTab"/, "the nav underline is not a shared layout element");
  assert.match(header, /initial=\{[^}]*x:\s*-20[^}]*opacity:\s*0/, "the brand does not slide in from the left");
  assert.match(header, /hover:scale-\[1\.03\]/, "inactive tabs do not scale on hover");
  assert.match(header, /group-hover:rotate-90/, "the settings gear does not turn");
  assert.match(header, /duration-300 ease-out/, "the gear does not take 0.3s");
  assert.match(header, /nb-logo-glow/, "the brand has no glow");
  assert.match(header, /useReducedMotion/);
});

check("the header carries one clock, not two", () => {
  // A header status bar (live clock + temperature pill) was built and then
  // removed — the draggable widget already shows both, and two clocks on one
  // page is one too many. What must not come back is a second fetch: the
  // widget stays the only surface, and it reads the shared store rather than
  // issuing its own request.
  assert.ok(
    !/HeaderClock|WeatherPill/.test(header),
    "the header status bar has been reinstated",
  );
  assert.ok(!/toLocaleTimeString/.test(header), "the header is ticking its own clock again");
  assert.ok(
    !/useWeather|fetchWeather/.test(header),
    "the header subscribes to weather again",
  );

  const widget = flat("src/components/ClockWeatherWidget.tsx");
  // Match the name, not a call site. Checking for `fetchWeather(` alone would
  // pass with the import reintroduced but unused — which is how the widget
  // starts issuing its own request again the moment someone wires it up.
  assert.ok(
    !/fetchWeather/.test(widget),
    "the widget talks to the weather API directly instead of the store",
  );
  assert.match(widget, /loadWeather/);
  assert.match(flat("src/lib/weatherStore.ts"), /useSyncExternalStore/);
});

check("the cards stagger in from 20px", () => {
  assert.match(centre, /staggerChildren:\s*0\.08/);
  assert.match(centre, /hidden:\s*\{\s*opacity:\s*0,\s*y:\s*20\s*\}/);
  assert.match(centre, /show:\s*\{\s*opacity:\s*1,\s*y:\s*0/);
  // Both grids, not just the first one.
  assert.equal((centre.match(/variants=\{GRID\}/g) ?? []).length, 2);
  assert.equal((centre.match(/nb-card-lift/g) ?? []).length, 2);
  assert.match(centre, /nb-neon-tag/);
});

check("the sparkline draws itself and pops its endpoint", () => {
  assert.match(centre, /pathLength=\{1\}/);
  assert.match(centre, /strokeDashoffset/);
  assert.match(centre, /strokeDashoffset:\s*1/);
  assert.match(centre, /strokeDashoffset:\s*0/);
  assert.match(centre, /duration:\s*1\.2,\s*ease:\s*"easeOut"/);
  assert.match(centre, /initial:\s*\{\s*scale:\s*0,\s*opacity:\s*0\s*\}/);
  assert.match(centre, /transformBox:\s*"fill-box"/);
});

check("numbers roll up on a spring", () => {
  assert.match(retro, /animate\(\s*count,/);
  assert.match(retro, /useTransform\(count/);
  assert.match(retro, /formatFigure/);
  assert.match(centre, /SlotValue/);
});

check("the location alert expands and the retry button shimmers", () => {
  assert.match(charts, /nb-banner/);
  assert.match(charts, /data-collapsed=/);
  assert.match(charts, /nb-shimmer/);
  assert.match(charts, /nb-press/);
});

check("the assistant launcher floats, glows and turns", () => {
  assert.match(help, /nb-float/);
  assert.match(help, /nb-ring-glow/);
  assert.match(help, /group-hover:scale-110/);
  assert.match(help, /rotate:\s*reduced \?\s*0\s*:\s*spins \* 360/);
  assert.match(help, /useReducedMotion/);
});

check("motion is suppressed rather than merely slowed for reduced-motion users", () => {
  // Framer animations need an explicit zero-duration path; a CSS `animation`
  // is handled by the media query. Both must be present.
  for (const [name, source] of [
    ["AppHeader", header],
    ["Retro", retro],
    ["HelpBot", help],
    ["CommandCenter", centre],
  ]) {
    assert.match(source, /useReducedMotion/, `${name} ignores reduced motion`);
  }
  assert.match(retro, /reduced \? \{ duration: 0 \} : SPRING/);
  assert.match(help, /reduced \? \{ duration: 0 \}/);
});

check("every Framer animation in the app honours the OS setting", () => {
  // Per-component opt-ins only cover the handful of components that thought to
  // check. Anything that animates for the first time after this was written
  // would silently ignore the preference, so the guarantee has to sit at the
  // root rather than in each file.
  const entry = flat("src/main.tsx");
  assert.match(
    entry,
    /<MotionConfig reducedMotion="user">/,
    "no root MotionConfig, so any component that does not check itself still moves",
  );

  // The root config must actually enclose the routed tree, not sit beside it.
  // Checking only "appears before <Routes>" is not enough: a stray closing tag
  // early in the file would leave every route outside the config while the
  // opening tag still passed an ordering check.
  const configAt = entry.indexOf('<MotionConfig reducedMotion="user">');
  const closeAt = entry.indexOf("</MotionConfig>");
  const routesAt = entry.indexOf("<Routes>");
  assert.ok(configAt !== -1, "no root MotionConfig");
  assert.ok(closeAt !== -1, "the root MotionConfig is never closed");
  assert.ok(routesAt !== -1, "no <Routes> found at all");
  assert.ok(
    configAt < routesAt && routesAt < closeAt,
    "MotionConfig does not enclose <Routes> — the routed tree is outside it",
  );

  // And nothing may opt back out of it.
  assert.ok(
    !/<MotionConfig reducedMotion="never">/.test(entry),
    "the root config has been overridden to always animate",
  );
  assert.equal(
    (entry.match(/<MotionConfig/g) ?? []).length,
    1,
    "a second MotionConfig could reintroduce an opt-out",
  );
});

/* ==========================================================================
   4. The roll-up, run rather than read
   ========================================================================== */

const out = join(tmpdir(), "urbis-motion.mjs");
buildSync({
  stdin: {
    contents: 'export * from "./src/lib/countUp";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: out,
  logLevel: "silent",
});
const cu = await import(`file://${out}?v=${Date.now()}`);

check("a roll-up reproduces the source format exactly", () => {
  // Every shape the dashboard actually produces.
  const samples = [
    "7,26,26,809",
    "1,210.9M",
    "238.4M",
    "+20.35%",
    "-3.21%",
    "31.4%",
    "3,76,12,306",
    "1901",
    "930.9",
    "72.98%",
  ];
  for (const text of samples) {
    const figure = cu.parseFigure(text);
    assert.ok(figure.numeric, `${text} was not recognised as a figure`);
    assert.equal(
      cu.formatFigure(figure, figure.value),
      text,
      `${text} does not survive a round trip`,
    );
    // The shape must survive every frame of the roll-up, not just the end.
    // String width is held by `tabular-nums` in CSS, so what matters is that
    // the prefix, suffix and decimal count are the same at every step — a
    // value that rendered "NaN" or dropped its "%" halfway up would not.
    for (let step = 0; step <= 20; step++) {
      const at = cu.formatFigure(figure, (figure.value * step) / 20);
      const frame = cu.parseFigure(at);
      assert.ok(frame.numeric, `${text} rendered ${JSON.stringify(at)} mid-roll`);
      assert.equal(frame.prefix, figure.prefix, `${text} lost its sign mid-roll`);
      assert.equal(frame.suffix, figure.suffix, `${text} lost its suffix mid-roll`);
      assert.equal(frame.decimals, figure.decimals, `${text} changed precision mid-roll`);
      assert.ok(!/NaN|undefined|Infinity/.test(at), `${text} rendered ${at} mid-roll`);
    }
  }
});

check("Indian digit grouping is preserved mid-roll", () => {
  // A bare toLocaleString() would regroup a crore as 12,10,90,579 and the
  // digits would jump sidewards as the count ran.
  const grouped = cu.parseFigure("7,26,26,809");
  assert.equal(grouped.grouped, true);
  assert.equal(cu.formatFigure(grouped, 72626809), "7,26,26,809");
  assert.equal(cu.formatFigure(grouped, 0), "0");
  assert.equal(cu.formatFigure(grouped, 1000000), "10,00,000");

  const negative = cu.parseFigure("-1,23,456");
  assert.equal(negative.prefix, "-");
  assert.equal(negative.value, 123456, "the sign must live in the prefix, not the value");
  assert.equal(cu.formatFigure(negative, negative.value), "-1,23,456");

  const compact = cu.parseFigure("1210.9M");
  assert.equal(compact.grouped, false);
  assert.equal(cu.formatFigure(compact, compact.value), "1210.9M");

  // Grouping and decimals together: Intl.NumberFormat is fixed at zero
  // decimals, so routing this through it would silently drop the ".9".
  const both = cu.parseFigure("1,210.9M");
  assert.equal(both.grouped, true);
  assert.equal(both.decimals, 1);
  assert.equal(cu.formatFigure(both, both.value), "1,210.9M");
  assert.equal(cu.formatFigure(both, 500.5), "500.5M");
  assert.equal(cu.formatFigure(both, 0), "0.0M");
});

check("something that is not a figure is never counted", () => {
  for (const text of ["–", "n/a", "", "Not counted"]) {
    const figure = cu.parseFigure(text);
    assert.equal(figure.numeric, false, `${JSON.stringify(text)} was treated as a number`);
    assert.equal(cu.formatFigure(figure, 0), text);
  }
});

/* ==========================================================================
   Result
   ========================================================================== */

if (failures.length === 0) {
  console.log(`motion: ${passed}/${passed} checks passed`);
} else {
  console.log(`motion: ${failures.length} FAILED of ${passed + failures.length}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exitCode = 1;
}