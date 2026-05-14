import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return "system";
}

function saveTheme(theme: ThemeMode) {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // localStorage unavailable
  }
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? getSystemTheme() : mode;
}

interface UiStore {
  theme: ThemeMode;
  resolved: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
}

export const useUiStore = create<UiStore>()((set) => ({
  theme: loadTheme(),
  resolved: resolveTheme(loadTheme()),

  setTheme: (theme) => {
    saveTheme(theme);
    set({ theme, resolved: resolveTheme(theme) });
  },
}));
