import { useEffect, useSyncExternalStore } from "react";

type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "team-task-manager.theme";

const PREFERENCE_CHANGED = "team-task-manager:theme-changed";

function getPreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemePreference(stored) ? stored : "system";
}

function subscribe(onChange: () => void) {
  window.addEventListener(PREFERENCE_CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PREFERENCE_CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function setTheme(theme: ThemePreference) {
  window.localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new Event(PREFERENCE_CHANGED));
}

export function useThemePreference() {
  const theme = useSyncExternalStore(subscribe, getPreference);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      root.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media?.matches === true),
      );
    };

    applyTheme();
    if (theme !== "system") return;

    media?.addEventListener?.("change", applyTheme);
    return () => media?.removeEventListener?.("change", applyTheme);
  }, [theme]);

  return { theme, setTheme };
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}
