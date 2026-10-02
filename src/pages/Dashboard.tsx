import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  Check,
  LogOut,
  MapPin,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

export default function Dashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const profile = useQuery(api.profile.myProfile);
  const quizScore = useQuery(api.quiz.myQuizScore);
  const isAdmin = useQuery(api.admin.isAdmin);
  const updateProfile = useMutation(api.profile.updateProfile);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [image, setImage] = useState("");
  const [saved, setSaved] = useState(false);

  // Seed the form once the profile query resolves. Adjusting state during
  // render (rather than in an effect) avoids a cascading second render.
  const [lastProfile, setLastProfile] = useState(profile);
  if (profile !== lastProfile) {
    setLastProfile(profile);
    setName(profile?.name ?? "");
    setCity(profile?.city ?? "");
    setCountry(profile?.country ?? "");
    setImage(profile?.image ?? "");
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await updateProfile({ name, city, country, image });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = profile?.name || profile?.email?.split("@")[0] || "Resident";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--nb-text)] md:text-3xl">
          {displayName}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <span className="nb-chip bg-[#F43F5E] text-black">
              <User className="size-3.5" strokeWidth={3} />
              Admin
            </span>
          )}
          <span className="nb-chip bg-[var(--nb-surface-2)] text-[#10B981]">
            <MapPin className="size-3.5" strokeWidth={3} />
            {profile?.city || "No city set"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* ------------------------------------------------- main column */}
        <div className="flex flex-col gap-4">
          {/* Identity card */}
          <section className="nb-panel">
            <div className="nb-subpanel flex items-center gap-3 border-b-2 border-[var(--nb-ink)] p-4">
              <span className="nb-chip bg-[#10B981] text-[#04110C]">
                <Building2 className="size-3.5" strokeWidth={3} />
                Resident Profile
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-5 p-5">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden border-2 border-[var(--nb-ink)] bg-[#06B6D4] shadow-[4px_4px_0_0_var(--nb-ink)]">
                {profile?.image ? (
                  <img
                    src={profile.image}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <User className="size-9 text-[#03151A]" strokeWidth={2.5} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black text-[var(--nb-text)]">{displayName}</p>
                <p className="truncate text-xs font-bold text-[var(--nb-text-muted)]">
                  {profile?.email || "—"}
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
                  {[profile?.city, profile?.country].filter(Boolean).join(", ") ||
                    "Location not set"}
                </p>
              </div>
            </div>
          </section>

          {/* Quiz result */}
          <section className="nb-panel">
            <div className="nb-subpanel flex flex-wrap items-center gap-3 border-b-2 border-[var(--nb-ink)] p-4">
              <h2 className="nb-title text-sm">Sustainability Score</h2>
              <Link
                to="/quiz"
                className="nb-btn ml-auto bg-[#FBBF24] px-3 py-1.5 text-black"
              >
                <Sparkles className="size-3.5" strokeWidth={3} />
                {quizScore ? "Update My Footprint" : "Measure My Footprint"}
              </Link>
            </div>
            <div className="p-5">
              {quizScore ? (
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-4xl font-black leading-none tabular-nums text-[var(--nb-text)]">
                      {(quizScore.footprintKg / 1000).toFixed(2)}
                      <span className="ml-1 text-lg">t</span>
                    </p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                      CO₂e per year
                    </p>
                  </div>
                  <div className="flex-1 min-w-48">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                        vs Indian average
                      </span>
                      <span className="text-xs font-black tabular-nums text-[var(--nb-text)]">
                        1.90 t
                      </span>
                    </div>
                    <div className="mt-1.5 h-4 border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)]">
                      <div
                        className="h-full bg-[#10B981]"
                        style={{
                          width: `${Math.min(100, (quizScore.footprintKg / 4700) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
                      Measured against the 4.7 t global per-capita average.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-bold text-[var(--nb-text-muted)]">
                  You have not taken the carbon footprint quiz yet.
                </p>
              )}
            </div>
          </section>

          {/* Shortcuts */}
          <section className="nb-panel p-4">
            <h2 className="nb-title mb-3 text-sm">Jump To</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Link to="/" className="nb-btn justify-center bg-[#06B6D4] text-[#03151A]">
                Dashboard
              </Link>
              <Link to="/analytics" className="nb-btn justify-center bg-[#10B981] text-[#04110C]">
                Analytics
              </Link>
              <Link to="/report" className="nb-btn justify-center bg-[#F8FAFC] text-[#04110C]">
                Report Issue
              </Link>
            </div>
          </section>
        </div>

        {/* ------------------------------------------------ settings card */}
        <aside className="flex flex-col gap-4">
          <section className="nb-panel">
            <div className="nb-subpanel flex items-center gap-3 border-b-2 border-[var(--nb-ink)] p-4">
              <Settings className="size-4 text-[#10B981]" strokeWidth={3} />
              <h2 className="nb-title text-sm">Settings</h2>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-4 p-4">
              <div>
                <label
                  htmlFor="settings-name"
                  className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]"
                >
                  Display Name
                </label>
                <input
                  id="settings-name"
                  className="nb-field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-city"
                  className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]"
                >
                  City
                </label>
                <input
                  id="settings-city"
                  className="nb-field"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Mumbai"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-country"
                  className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]"
                >
                  Country
                </label>
                <input
                  id="settings-country"
                  className="nb-field"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  placeholder="India"
                />
              </div>

              <div>
                <label
                  htmlFor="settings-image"
                  className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]"
                >
                  Profile Picture URL
                </label>
                <input
                  id="settings-image"
                  className="nb-field"
                  value={image}
                  onChange={(event) => setImage(event.target.value)}
                  placeholder="https://…"
                />
              </div>


              <button
                type="submit"
                className="nb-btn w-full justify-center bg-[#10B981] py-2.5 text-[#04110C]"
              >
                {saved ? (
                  <>
                    <Check className="size-4" strokeWidth={3} />
                    Saved
                  </>
                ) : (
                  "Save Settings"
                )}
              </button>
            </form>
          </section>

          <button
            type="button"
            onClick={handleSignOut}
            className="nb-btn w-full justify-center bg-[#F43F5E] py-2.5 text-black"
          >
            <LogOut className="size-4" strokeWidth={3} />
            Sign Out
          </button>
        </aside>
      </div>
    </div>
  );
}
