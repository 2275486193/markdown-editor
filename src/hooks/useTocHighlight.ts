import { useState, useEffect } from "react";
import { useEditorStore } from "../stores/editor";

export function useTocHighlight() {
  const mode = useEditorStore((s) => s.mode);
  const content = useEditorStore((s) => s.content);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "preview") {
      setActiveId(null);
      return;
    }

    const article = document.querySelector("article");
    if (!article) return;

    const headingElements = article.querySelectorAll("h1[id], h2[id], h3[id]");
    if (headingElements.length === 0) return;

    const visible = new Map<string, boolean>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting);
        }
        for (const [id, isVisible] of visible) {
          if (isVisible) {
            setActiveId(id);
            break;
          }
        }
      },
      { rootMargin: "-64px 0px -80% 0px", threshold: 0 },
    );

    headingElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [mode, content]);

  return activeId;
}
