import { useEffect, useRef, useCallback } from "react";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { history } from "@milkdown/kit/plugin/history";
import { replaceAll, getMarkdown } from "@milkdown/kit/utils";
import { useEditorStore } from "../../stores/editor";
import { registerNavigator, unregisterNavigator } from "../../services/heading-nav";

function WYSIWYGEditor() {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const contentRef = useRef(content);
  contentRef.current = content;

  const setContentStable = useCallback(
    (markdown: string) => {
      setContent(markdown);
    },
    [setContent],
  );

  const { get, loading } = useEditor(
    (container) => {
      return Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, container);
          ctx.set(defaultValueCtx, contentRef.current);
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            setContentStable(markdown);
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener);
    },
    [],
  );

  useEffect(() => {
    if (!loading) {
      const editor = get();
      if (editor && editor.status === "Created") {
        const current = editor.action(getMarkdown());
        if (current !== contentRef.current) {
          editor.action(replaceAll(contentRef.current));
        }
      }
    }
  }, [content, loading, get]);

  return <Milkdown />;
}

function keepAliveStyle(active: boolean): React.CSSProperties {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: active ? 1 : 0,
    pointerEvents: active ? "auto" : "none",
    zIndex: active ? 1 : 0,
  };
}

export function WYSIWYGMode() {
  const mode = useEditorStore((s) => s.mode);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerNavigator("wysiwyg", (_id, text) => {
      const container = containerRef.current;
      if (!container) return;
      const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
      for (const h of headings) {
        if (h.textContent?.trim() === text) {
          h.scrollIntoView({ behavior: "smooth", block: "start" });
          break;
        }
      }
    });
    return () => unregisterNavigator("wysiwyg");
  }, []);

  return (
    <div style={keepAliveStyle(mode === "wysiwyg")}>
      <MilkdownProvider>
        <div ref={containerRef} className="mx-auto max-w-3xl h-full overflow-auto px-6 pt-8 pb-[80vh]">
          <WYSIWYGEditor />
        </div>
      </MilkdownProvider>
    </div>
  );
}
