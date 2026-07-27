import { useEffect } from "react";
import { useUiStore } from "../stores/ui";

const LEGACY_THEMES = ["light", "dark", "system", "paper"];

export function useTheme() {
  const theme = useUiStore((s) => s.theme);
  const resolved = useUiStore((s) => s.resolved);

  useEffect(() => {
    const root = document.documentElement;
    const isLegacy = (LEGACY_THEMES as string[]).includes(theme);

    // Handle dark class
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Handle paper class
    if (theme === "paper") {
      root.classList.add("paper");
    } else {
      root.classList.remove("paper");
    }

    // Handle data-theme for new themes
    if (!isLegacy) {
      root.dataset.theme = theme;
    } else {
      delete root.dataset.theme;
    }
  }, [resolved, theme]);

  useEffect(() => {
    if (theme !== "system") return;

    function handleChange(e: MediaQueryListEvent) {
      const newResolved = e.matches ? "dark" : "light";
      useUiStore.setState({ resolved: newResolved });
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [theme]);
}
