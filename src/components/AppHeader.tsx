import { useAuth } from "@/hooks/use-auth";
import { Building2, LayoutDashboard, LogIn, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";

const TABS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/analytics", label: "Analytics" },
  { to: "/report", label: "Report Issue" },
  { to: "/quiz", label: "Quiz" },
];

export function AppHeader() {
  const { isAuthenticated } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("en-GB", { hour12: false });

  return (
    <header className="sticky top-0 z-50 border-b-2 border-black bg-[#111827]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:px-6">
        {/* Platform title */}
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center border-2 border-black bg-[#10B981] shadow-[3px_3px_0_0_#000]">
            <Building2 className="size-4 text-[#04110C]" strokeWidth={2.5} />
          </span>
          <span className="text-xl font-black tracking-tight text-[#F8FAFC]">
            URBIS
          </span>
        </Link>

        {/* City status pill */}
        <span className="nb-chip hidden bg-[#1E293B] text-[#10B981] sm:inline-flex">
          <span className="size-2 animate-pulse bg-[#10B981] shadow-[0_0_8px_2px_#10B981]" />
          City Status: OPTIMAL
        </span>

        {/* Right cluster: time, weather, nav, auth */}
        <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 border-2 border-black bg-[#1E293B] px-2.5 py-1 text-xs font-black tracking-wider text-[#E2E8F0] shadow-[3px_3px_0_0_#000] sm:inline-flex">
            {time}
          </span>

          <span className="nb-chip bg-[#FBBF24] text-black">
            <Sun className="size-3.5" strokeWidth={3} />
            37°C · Clear
          </span>

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
                      : "bg-[#1E293B] text-[#CBD5E1] hover:bg-[#334155] hover:text-[#F8FAFC]",
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
              <span className="hidden sm:inline">Staff Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
