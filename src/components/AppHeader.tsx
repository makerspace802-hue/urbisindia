import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { LayoutDashboard, LogIn, Settings } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router";
import { SettingsPanel } from "./SettingsPanel";

const TABS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/analytics", label: "Analytics" },
  { to: "/report", label: "Report Issue" },
  { to: "/quiz", label: "My Impact" },
];

export function AppHeader() {
  const { isAuthenticated } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:px-6">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="URBIS India radome" className="size-9 shrink-0" />
          <span className="text-xl font-black tracking-tight text-[var(--nb-text)]">
            URBIS <span className="text-[#10B981]">India</span>
          </span>
        </Link>

        {/* Right cluster: nav, auth and settings */}
        <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
          <nav className="flex flex-wrap items-center gap-2">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  [
                    "nb-chip px-3 py-1.5 transition-colors",
                    isActive
                      ? "bg-[#10B981] text-[#04110C]"
                      : "bg-[var(--nb-surface)] text-[var(--nb-text-2)] hover:bg-[var(--nb-surface-hover)]",
                  ].join(" ")
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="nb-btn bg-[#F8FAFC] px-3 py-1.5 text-[#04110C]"
            >
              <LayoutDashboard className="size-3.5" strokeWidth={3} />
              <span className="hidden sm:inline">Workspace</span>
            </Link>
          ) : (
            <Link
              to="/auth?returnTo=/dashboard"
              className="nb-btn bg-[#F8FAFC] px-3 py-1.5 text-[#04110C]"
            >
              <LogIn className="size-3.5" strokeWidth={3} />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}

          {/* Settings, top-right, immediately after the sign-in button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Settings"
              aria-expanded={settingsOpen}
              className="flex size-8 items-center justify-center border-2 border-[var(--nb-ink)] bg-[#10B981] shadow-[3px_3px_0_0_var(--nb-ink)] transition-transform hover:-translate-y-0.5"
            >
              <Settings className="size-4 text-[#04110C]" strokeWidth={2.5} />
            </button>

            <SettingsPanel
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
