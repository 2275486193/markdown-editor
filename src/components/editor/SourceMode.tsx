import { useRef, useEffect, useCallback, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useEditorStore } from "../../stores/editor";
import { useUiStore } from "../../stores/ui";
import { registerNavigator, unregisterNavigator } from "../../services/heading-nav";

interface TagSuggestion {
  tag: string;
  label: string;
  detail: string;
  closeTag?: string;
  insertText?: string;
}

const tagSuggestions: TagSuggestion[] = [
  { tag: "br", label: "<br>", detail: "换行" },
  { tag: "div", label: "<div>", detail: "块容器", closeTag: "</div>" },
  { tag: "span", label: "<span>", detail: "行内容器", closeTag: "</span>" },
  { tag: "table", label: "<table>", detail: "表格", closeTag: "</table>" },
  { tag: "tr", label: "<tr>", detail: "表格行", closeTag: "</tr>" },
  { tag: "td", label: "<td>", detail: "表格单元格", closeTag: "</td>" },
  { tag: "details", label: "<details>", detail: "折叠块", closeTag: "</details>" },
  { tag: "summary", label: "<summary>", detail: "折叠标题", closeTag: "</summary>" },
  { tag: "kbd", label: "<kbd>", detail: "键盘按键", closeTag: "</kbd>" },
  { tag: "mark", label: "<mark>", detail: "高亮标记", closeTag: "</mark>" },
  { tag: "sub", label: "<sub>", detail: "下标", closeTag: "</sub>" },
  { tag: "sup", label: "<sup>", detail: "上标", closeTag: "</sup>" },
  { tag: "!--", label: "<!-- -->", detail: "HTML 注释", insertText: "<!-- $0 -->" },
];

export function SourceMode() {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const theme = useUiStore((s) => s.theme);
  const resolved = useUiStore((s) => s.resolved);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const providerRef = useRef<{ dispose(): void } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState(600);

  useEffect(() => {
    return () => {
      providerRef.current?.dispose();
    };
  }, []);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Define custom themes (avoid re-definition on remount)
    const defineTheme = (name: string, base: "vs" | "vs-dark", colors: Record<string, string>) => {
      try { monaco.editor.defineTheme(name, { base, inherit: true, rules: [], colors }); } catch { /* already defined */ }
    };

    defineTheme("paper", "vs", {
      "editor.background": "#faf7f2",
      "editor.foreground": "#3d3d3d",
      "editor.selectionBackground": "#d4c8b0",
      "editor.inactiveSelectionBackground": "#e8e0d0",
      "editorCursor.foreground": "#3d3d3d",
      "editor.lineHighlightBackground": "#f0ebe0",
      "editorBracketMatch.background": "#e8dcc8",
      "editorBracketMatch.border": "#c4b6a4",
    });

    defineTheme("newsprint", "vs", {
      "editor.background": "#fdfaf4",
      "editor.foreground": "#333333",
      "editor.selectionBackground": "#d5cec0",
      "editor.inactiveSelectionBackground": "#e8e0d0",
      "editorCursor.foreground": "#333333",
      "editor.lineHighlightBackground": "#f4f1ea",
      "editorBracketMatch.background": "#e8dcc8",
      "editorBracketMatch.border": "#c4b6a4",
    });

    defineTheme("night", "vs-dark", {
      "editor.background": "#1a1a2e",
      "editor.foreground": "#e0e0e0",
      "editor.selectionBackground": "#2a2a5a",
      "editor.inactiveSelectionBackground": "#1a1a3e",
      "editorCursor.foreground": "#e0e0e0",
      "editor.lineHighlightBackground": "#16213e",
      "editorBracketMatch.background": "#0f3460",
      "editorBracketMatch.border": "#2a2a4a",
    });

    // Register tag completion provider
    const provider = monaco.languages.registerCompletionItemProvider("markdown", {
      triggerCharacters: ["<"],
      provideCompletionItems(model: any, position: any) {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const lastChar = textUntilPosition.slice(-1);
        if (lastChar !== "<") return { suggestions: [] };

        const nextChar = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column + 1,
        });
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - 1,
          endColumn: nextChar === ">" ? position.column + 1 : position.column,
        };

        const suggestions = tagSuggestions.map((s) => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: s.detail,
          insertText: s.insertText ?? (s.closeTag
            ? `<${s.tag}>$0${s.closeTag}`
            : `<${s.tag}>`),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        }));

        return { suggestions };
      },
    });
    providerRef.current = provider;

    // Auto-height: track content size, grow card to match
    const updateHeight = () => {
      const h = editor.getContentHeight();
      setEditorHeight(h);
    };
    editor.onDidContentSizeChange(updateHeight);
    // Initial height after a tick for first paint
    setTimeout(updateHeight, 50);

    editor.onDidChangeCursorPosition((e) => {
      useEditorStore.getState().setCursor({ line: e.position.lineNumber, column: e.position.column });
    });
    editor.onDidChangeCursorSelection((_e) => {
      const sel = editor.getSelection();
      if (sel && !sel.isEmpty()) {
        const text = editor.getModel()?.getValueInRange(sel) ?? "";
        useEditorStore.getState().setSelection({
          start: { line: sel.startLineNumber, column: sel.startColumn },
          end: { line: sel.endLineNumber, column: sel.endColumn },
          text,
        });
      } else {
        useEditorStore.getState().setSelection(null);
      }
    });
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) setContent(value);
    },
    [setContent],
  );

  // Sync content from store → editor (undo/redo, external change)
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== content) {
      editor.setValue(content);
    }
  }, [content]);

  // Restore cursor on first mount
  useEffect(() => {
    const cursor = useEditorStore.getState().cursor;
    if (cursor) {
      const editor = editorRef.current;
      if (editor) {
        editor.setPosition({ lineNumber: cursor.line, column: cursor.column });
        editor.revealLineInCenter(cursor.line);
      }
    }
  }, []);

  // Navigate to pending line (from preview click-to-edit)
  useEffect(() => {
    const pendingLine = useEditorStore.getState().pendingSourceLine;
    if (!pendingLine) return;
    useEditorStore.getState().setPendingSourceLine(null);
    // Delay to let Monaco finish layout
    const timer = setTimeout(() => {
      const ed = editorRef.current;
      const scrollEl = scrollRef.current;
      if (!ed || !scrollEl) return;
      ed.setPosition({ lineNumber: pendingLine, column: 1 });
      const lineTop = ed.getTopForLineNumber(pendingLine);
      const card = scrollEl.firstElementChild as HTMLElement | null;
      const scrollRect = scrollEl.getBoundingClientRect();
      const cardTopInContent = card
        ? card.getBoundingClientRect().top - scrollRect.top + scrollEl.scrollTop
        : 0;
      scrollEl.scrollTop = cardTopInContent + lineTop - 80;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Navigator: scroll outer container, not Monaco
  useEffect(() => {
    registerNavigator("source", (_id, text) => {
      const scrollEl = scrollRef.current;
      const ed = editorRef.current;
      if (!scrollEl || !ed) return;
      const model = ed.getModel();
      if (!model) return;
      const fullText = model.getValue();
      const lines = fullText.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(text)) {
          const line = i + 1;
          const lineTop = ed.getTopForLineNumber(line);
          const card = scrollEl.firstElementChild as HTMLElement | null;
          // Viewport-relative → content-relative conversion
          const scrollRect = scrollEl.getBoundingClientRect();
          const cardTopInContent = card
            ? card.getBoundingClientRect().top - scrollRect.top + scrollEl.scrollTop
            : 0;
          // Absolute position of the heading line in the scroll container
          const absoluteTop = cardTopInContent + lineTop;
          const targetTop = absoluteTop - 40;
          const startTop = scrollEl.scrollTop;
          const distance = targetTop - startTop;
          const duration = 400;
          const startTime = performance.now();
          const scroll = (now: number) => {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            scrollEl.scrollTop = startTop + distance * eased;
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
    <div
      ref={scrollRef}
      className="h-full overflow-auto bg-zinc-100 dark:bg-zinc-900 paper:bg-[#d9cebc]"
    >
      <div
        className="mx-auto my-8 max-w-4xl overflow-hidden rounded-xl bg-white shadow-md dark:bg-zinc-900 dark:shadow-md paper:bg-[#faf7f2] paper:shadow-md"
        style={{ height: editorHeight }}
      >
        <Editor
          height="100%"
          language="markdown"
          defaultValue={content}
          onChange={handleChange}
          onMount={handleMount}
          theme={
            theme === "paper" ? "paper"
            : theme === "newsprint" ? "newsprint"
            : theme === "night" ? "night"
            : resolved === "dark" ? "vs-dark"
            : "vs"
          }
          options={{
            minimap: { enabled: false },
            lineNumbers: "off",
            wordWrap: "on",
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: "always",
            autoClosingQuotes: "always",
            matchBrackets: "always",
            fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
            fontSize: 15,
            lineHeight: 1.7,
            padding: { top: 32, bottom: 32 },
            scrollBeyondLastLine: false,
            scrollbar: { handleMouseWheel: false },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            renderLineHighlight: "none",
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            glyphMargin: false,
            folding: false,
            contextmenu: true,
            automaticLayout: true,
          }}
        />
      </div>
      {/* Bottom breathing room — ensures content can scroll past viewport */}
      <div className="pb-[80vh]" />
    </div>
  );
}
