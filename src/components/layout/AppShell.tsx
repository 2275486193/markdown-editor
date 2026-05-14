import { useCallback, useState } from "react";
import { Welcome } from "../common/Welcome";
import { FileDropZone } from "../common/FileDropZone";
import { PreviewMode } from "../editor/PreviewMode";
import { WYSIWYGMode } from "../editor/WYSIWYGMode";
import { SourceMode } from "../editor/SourceMode";
import { Sidebar } from "./Sidebar";
import { AIProviderDialog } from "../settings/AIProviderDialog";
import { useFileOpen } from "../../hooks/useFileOpen";
import { useFileSave } from "../../hooks/useFileSave";
import { useKeyboard } from "../../hooks/useKeyboard";
import { useTheme } from "../../hooks/useTheme";
import { useEditorStore } from "../../stores/editor";
import { useUiStore, type ThemeMode } from "../../stores/ui";
import type { EditorMode } from "../../types/editor";

function TitleBar() {
  const fileName = useEditorStore((s) => s.fileName);
  const isDirty = useEditorStore((s) => s.isDirty);
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const { save, saveAs } = useFileSave();
  const [aiOpen, setAiOpen] = useState(false);

  useKeyboard([
    { key: "s", ctrl: true, handler: save },
    { key: "s", ctrl: true, shift: true, handler: saveAs },
  ]);

  const modes: { mode: EditorMode; label: string }[] = [
    { mode: "preview", label: "预览" },
    { mode: "wysiwyg", label: "WYSIWYG" },
    { mode: "source", label: "源码" },
  ];

  function cycleTheme() {
    const order: ThemeMode[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  }

  const themeLabel = theme === "light" ? "☀" : theme === "dark" ? "☾" : "⇅";

  return (
    <div className="flex h-10 items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-4 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {fileName}
      </span>
      {isDirty && (
        <span className="text-amber-500 text-xs" title="未保存的修改">●</span>
      )}
      <div className="flex items-center gap-1 ml-4">
        {modes.map(({ mode: m, label }) => (
          <button
            key={m}
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              mode === m
                ? "bg-zinc-300 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                : "text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            onClick={() => setMode(m)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <button
        className="rounded px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950"
        onClick={() => setAiOpen(true)}
        title="AI 配置"
      >
        AI
      </button>
      <button
        className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
        onClick={cycleTheme}
        title={`主题: ${theme}`}
      >
        {themeLabel}
      </button>
      <button
        className="rounded px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
        onClick={save}
        title="Ctrl+S"
      >
        保存
      </button>
      <button
        className="rounded px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
        onClick={saveAs}
        title="Ctrl+Shift+S"
      >
        另存为
      </button>
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-96 max-h-[80vh] overflow-auto rounded-lg bg-white shadow-xl dark:bg-zinc-900">
            <AIProviderDialog onClose={() => setAiOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  useTheme();
  const filePath = useEditorStore((s) => s.filePath);
  const { openFile, openByPath } = useFileOpen();

  const handleOpenFile = useCallback(() => {
    openFile();
  }, [openFile]);

  const handleFileDrop = useCallback(
    (path: string) => {
      openByPath(path);
    },
    [openByPath],
  );

  useKeyboard([{ key: "o", ctrl: true, handler: handleOpenFile }]);

  const hasFile = filePath !== null;

  return (
    <FileDropZone onFileDrop={handleFileDrop}>
      <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
        {hasFile ? (
          <>
            <TitleBar />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar />
              <div className="flex-1 overflow-hidden relative">
                <PreviewMode />
                <WYSIWYGMode />
                <SourceMode />
              </div>
            </div>
          </>
        ) : (
          <Welcome onOpenFile={handleOpenFile} />
        )}
      </div>
    </FileDropZone>
  );
}
