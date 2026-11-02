import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "team-task-manager.theme";

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldUseDark =
      theme === "dark" || (theme === "system" && systemPrefersDark);

    root.classList.toggle("dark", shouldUseDark);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme };
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}
