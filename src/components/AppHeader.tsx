import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import {
  LayoutDashboard,
  LogIn,
  Settings,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { Link, NavLink } from "react-router";
import { SettingsPanel } from "./SettingsPanel";

const TABS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/analytics", label: "Analytics" },
  { to: "/report", label: "Report Issue" },
  { to: "/quiz", label: "My Impact" },
];

/**
 * Shared spring.
 *
 * Every transition in the header — the sliding underline, the brand entrance —
 * runs on these numbers rather than a duration, so an interrupted animation
 * keeps its velocity instead of restarting.
 */
const SPRING = { type: "spring" as const, stiffness: 300, damping: 25 };

export function AppHeader() {
  const { isAuthenticated } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const reduced = useReducedMotion();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:px-6">
        {/* Brand — slides in from the left on first paint. */}
        <motion.div
          initial={reduced ? false : { x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={reduced ? { duration: 0 } : SPRING}
        >
          <Link to="/" className="nb-logo-glow flex items-center gap-2.5">
            <img src={logo} alt="URBIS India radome" className="size-9 shrink-0" />
            <span className="text-xl font-black tracking-tight text-[var(--nb-text)]">
              URBIS <span className="text-[#10B981]">India</span>
            </span>
          </Link>
        </motion.div>

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
                    // `.nb-nav-tab` owns the background fade and anchors the
                    // sliding underline; the scale and border are hover-only.
                    "nb-nav-tab relative border-2 px-3 py-1.5 font-black uppercase tracking-wide",
                    isActive
                      ? "border-[var(--nb-gain)] bg-[var(--nb-surface)] text-[var(--nb-text)]"
                      : "border-transparent bg-[var(--nb-surface)] text-[var(--nb-text-2)] hover:scale-[1.03] hover:border-[var(--nb-line)] hover:text-[var(--nb-text)] motion-reduce:hover:scale-100",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    {tab.label}
                    {isActive && (
                      <motion.span
                        layoutId="activeTab"
                        transition={reduced ? { duration: 0 } : SPRING}
                        className="nb-nav-underline bg-[var(--nb-gain)]"
                        aria-hidden="true"
                      />
                    )}
                  </>
                )}
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
              className="group flex size-8 items-center justify-center border-2 border-[var(--nb-ink)] bg-[#10B981] shadow-[3px_3px_0_0_var(--nb-ink)] transition-transform hover:-translate-y-0.5"
            >
              <Settings
                className="size-4 text-[#04110C] transition-transform duration-300 ease-out group-hover:rotate-90 motion-reduce:transition-none"
                strokeWidth={2.5}
              />
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