import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system" | "paper";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark" || stored === "system" || stored === "paper") {
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
  if (mode === "system") return getSystemTheme();
  if (mode === "paper") return "light";
  return mode;
}

function loadFontSize(): number {
  try {
    const stored = localStorage.getItem("fontSize");
    if (stored) {
      const n = parseInt(stored, 10);
      if (n >= 12 && n <= 28) return n;
    }
  } catch {
    // localStorage unavailable
  }
  return 16;
}

function saveFontSize(size: number) {
  try {
    localStorage.setItem("fontSize", String(size));
  } catch {
    // localStorage unavailable
  }
}

interface UiStore {
  theme: ThemeMode;
  resolved: "light" | "dark";
  fontSize: number;
  immersiveMode: boolean;
  sidebarCollapsed: boolean;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: number) => void;
  toggleImmersive: () => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiStore>()((set) => ({
  theme: loadTheme(),
  resolved: resolveTheme(loadTheme()),
  fontSize: loadFontSize(),
  immersiveMode: false,
  sidebarCollapsed: false,

  setTheme: (theme) => {
    saveTheme(theme);
    set({ theme, resolved: resolveTheme(theme) });
  },

  setFontSize: (size) => {
    const clamped = Math.min(28, Math.max(12, size));
    saveFontSize(clamped);
    set({ fontSize: clamped });
  },

  toggleImmersive: () => set((s) => ({ immersiveMode: !s.immersiveMode })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
