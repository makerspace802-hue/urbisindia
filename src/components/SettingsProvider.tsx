import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";
export type ClockMode = "digital" | "analog";

interface Settings {
  theme: Theme;
  clockMode: ClockMode;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setClockMode: (mode: ClockMode) => void;
  toggleClockMode: () => void;
}

const SettingsContext = createContext<Settings | null>(null);

const THEME_KEY = "urbis.theme";
const CLOCK_KEY = "urbis.clockMode";

function readStored(key: string, allowed: string[], fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value && allowed.includes(value) ? value : fallback;
}

/**
 * Applies the theme by toggling `.dark` on <html>. The class is written before
 * paint by the inline script in index.html, so this only has to keep it in
 * sync afterwards.
 */
function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    readStored(THEME_KEY, ["light", "dark"], "dark") as Theme,
  );
  const [clockMode, setClockModeState] = useState<ClockMode>(() =>
    readStored(CLOCK_KEY, ["digital", "analog"], "digital") as ClockMode,
  );

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(CLOCK_KEY, clockMode);
  }, [clockMode]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === "dark" ? "light" : "dark")),
    [],
  );
  const setClockMode = useCallback(
    (next: ClockMode) => setClockModeState(next),
    [],
  );
  const toggleClockMode = useCallback(
    () => setClockModeState((prev) => (prev === "digital" ? "analog" : "digital")),
    [],
  );

  const value = useMemo(
    () => ({ theme, clockMode, setTheme, toggleTheme, setClockMode, toggleClockMode }),
    [theme, clockMode, setTheme, toggleTheme, setClockMode, toggleClockMode],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside <SettingsProvider>");
  }
  return context;
}
