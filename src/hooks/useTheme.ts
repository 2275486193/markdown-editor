import { useEffect } from "react";
import { useUiStore } from "../stores/ui";

export function useTheme() {
  const theme = useUiStore((s) => s.theme);
  const resolved = useUiStore((s) => s.resolved);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "paper") {
      root.classList.add("paper");
      root.classList.remove("dark");
    } else if (resolved === "dark") {
      root.classList.add("dark");
      root.classList.remove("paper");
    } else {
      root.classList.remove("dark");
      root.classList.remove("paper");
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
