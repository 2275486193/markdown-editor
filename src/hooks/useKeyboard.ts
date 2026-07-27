import { useEffect } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  handler: () => void;
}

export function useKeyboard(shortcuts: Shortcut[]) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      for (const s of shortcuts) {
        if (
          e.key === s.key &&
          e.ctrlKey === (s.ctrl ?? false) &&
          e.shiftKey === (s.shift ?? false)
        ) {
          e.preventDefault();
          e.stopPropagation();
          s.handler();
          return;
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [shortcuts]);
}
