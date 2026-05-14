import { useRef, useEffect, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useEditorStore } from "../../stores/editor";
import { registerNavigator, unregisterNavigator } from "../../services/heading-nav";

const keepAliveStyle = (active: boolean): React.CSSProperties => ({
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  opacity: active ? 1 : 0,
  pointerEvents: active ? "auto" : "none",
  zIndex: active ? 1 : 0,
});

export function SourceMode() {
  const content = useEditorStore((s) => s.content);
  const mode = useEditorStore((s) => s.mode);
  const setContent = useEditorStore((s) => s.setContent);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const prevMode = useRef(mode);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) setContent(value);
    },
    [setContent],
  );

  useEffect(() => {
    if (mode === "source" && prevMode.current !== "source") {
      const editor = editorRef.current;
      if (editor && editor.getValue() !== content) {
        editor.setValue(content);
      }
    }
    prevMode.current = mode;
  }, [mode, content]);

  useEffect(() => {
    registerNavigator("source", (_id, text) => {
      const ed = editorRef.current;
      if (!ed) return;
      const model = ed.getModel();
      if (!model) return;
      const fullText = model.getValue();
      const lines = fullText.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(text)) {
          const line = i + 1;
          const targetTop = ed.getTopForLineNumber(line) - 40;
          const startTop = ed.getScrollTop();
          const duration = 400;
          const startTime = performance.now();
          const scroll = (now: number) => {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            ed!.setScrollTop(startTop + (targetTop - startTop) * eased);
            if (t < 1) requestAnimationFrame(scroll);
          };
          requestAnimationFrame(scroll);
          ed.setPosition({ lineNumber: line, column: 1 });
          break;
        }
      }
    });
    return () => unregisterNavigator("source");
  }, []);

  return (
    <div style={keepAliveStyle(mode === "source")}>
      <Editor
        language="markdown"
        defaultValue={content}
        onChange={handleChange}
        onMount={handleMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          lineNumbers: "on",
          wordWrap: "on",
          bracketPairColorization: { enabled: true },
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          matchBrackets: "always",
          fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
          fontSize: 14,
          lineHeight: 1.6,
          padding: { top: 16, bottom: 200 },
          scrollBeyondLastLine: true,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          renderLineHighlight: "line",
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          contextmenu: true,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
