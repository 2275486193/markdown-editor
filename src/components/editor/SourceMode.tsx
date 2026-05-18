import { useRef, useEffect, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useEditorStore } from "../../stores/editor";
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
  { tag: "!--", label: "<!-- -->", detail: "HTML 注释", insertText: "!-- $0 -->" },
];

export function SourceMode() {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const providerRef = useRef<{ dispose(): void } | null>(null);

  useEffect(() => {
    return () => {
      providerRef.current?.dispose();
    };
  }, []);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

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

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column,
          endColumn: position.column,
        };

        const suggestions = tagSuggestions.map((s) => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: s.detail,
          insertText: s.insertText ?? (s.closeTag
            ? `${s.tag}>$0${s.closeTag}`
            : `${s.tag}>`),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        }));

        return { suggestions };
      },
    });
    providerRef.current = provider;

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

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== content) {
      editor.setValue(content);
    }
  }, [content]);

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
    <div className="h-full">
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
