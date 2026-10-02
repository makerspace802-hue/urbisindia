import { useSettings } from "@/components/SettingsProvider";
import { Clock, Moon, Settings, Sun, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

export function SettingsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { theme, clockMode, setTheme, setClockMode } = useSettings();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="nb-panel absolute left-0 top-full z-[60] mt-2 w-72"
          role="dialog"
          aria-label="Settings"
        >
          <div className="nb-subpanel flex items-center gap-2 border-b-2 border-[var(--nb-ink)] p-3">
            <Settings className="size-4 text-[#10B981]" strokeWidth={3} />
            <h2 className="nb-title text-xs">Settings</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="ml-auto flex size-6 items-center justify-center border-2 border-[var(--nb-ink)] bg-[var(--nb-surface)] text-[var(--nb-text-2)]"
            >
              <X className="size-3.5" strokeWidth={3} />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Theme */}
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                Appearance
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  aria-pressed={theme === "light"}
                  className={[
                    "nb-btn py-2",
                    theme === "light"
                      ? "bg-[#FBBF24] text-black"
                      : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]",
                  ].join(" ")}
                >
                  <Sun className="size-4" strokeWidth={3} />
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  aria-pressed={theme === "dark"}
                  className={[
                    "nb-btn py-2",
                    theme === "dark"
                      ? "bg-[#10B981] text-[#04110C]"
                      : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]",
                  ].join(" ")}
                >
                  <Moon className="size-4" strokeWidth={3} />
                  Dark
                </button>
              </div>
            </div>

            {/* Clock */}
            <div className="border-t-2 border-[var(--nb-ink)] pt-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                Clock Style
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClockMode("digital")}
                  aria-pressed={clockMode === "digital"}
                  className={[
                    "nb-btn py-2",
                    clockMode === "digital"
                      ? "bg-[#06B6D4] text-[#03151A]"
                      : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]",
                  ].join(" ")}
                >
                  <Clock className="size-4" strokeWidth={3} />
                  Digital
                </button>
                <button
                  type="button"
                  onClick={() => setClockMode("analog")}
                  aria-pressed={clockMode === "analog"}
                  className={[
                    "nb-btn py-2",
                    clockMode === "analog"
                      ? "bg-[#10B981] text-[#04110C]"
                      : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]",
                  ].join(" ")}
                >
                  <Clock className="size-4" strokeWidth={3} />
                  Analog
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
