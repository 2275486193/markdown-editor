import { create } from "zustand";

export type ThemeMode =
  | "light" | "dark" | "system" | "paper"
  | "github" | "newsprint" | "night" | "pixyll" | "whitey";

const ALL_THEMES: ThemeMode[] = [
  "light", "dark", "system", "paper",
  "github", "newsprint", "night", "pixyll", "whitey",
];

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem("theme");
    if (stored && (ALL_THEMES as string[]).includes(stored)) {
      return stored as ThemeMode;
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
  if (mode === "dark" || mode === "night") return "dark";
  return "light";
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
  sidebarView: "files" | "outline";
  fileViewMode: "tree" | "list";
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: number) => void;
  toggleImmersive: () => void;
  toggleSidebar: () => void;
  setSidebarView: (view: "files" | "outline") => void;
  setFileViewMode: (mode: "tree" | "list") => void;
}

export const useUiStore = create<UiStore>()((set) => ({
  theme: loadTheme(),
  resolved: resolveTheme(loadTheme()),
  fontSize: loadFontSize(),
  immersiveMode: false,
  sidebarCollapsed: true,
  sidebarView: "outline",
  fileViewMode: "list",

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
  setSidebarView: (sidebarView) => set({ sidebarView }),
  setFileViewMode: (fileViewMode) => set({ fileViewMode }),
}));
