import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Welcome } from "../common/Welcome";
import { FileDropZone } from "../common/FileDropZone";
import { PreviewMode } from "../editor/PreviewMode";
import { SourceMode } from "../editor/SourceMode";
import { Sidebar } from "./Sidebar";
import { ProjectMenu } from "./ProjectMenu";
import { AIProviderDialog } from "../settings/AIProviderDialog";
import { AIPanel } from "../ai/AIPanel";
import { useFileOpen } from "../../hooks/useFileOpen";
import { useFileSave } from "../../hooks/useFileSave";
import { useKeyboard } from "../../hooks/useKeyboard";
import { useTheme } from "../../hooks/useTheme";
import { useFileWatch } from "../../hooks/useFileWatch";
import { useEditorStore } from "../../stores/editor";
import { useUiStore, type ThemeMode } from "../../stores/ui";
import { closeWindow, openFileDialog, saveFile, saveFileDialog, updateRecentFile } from "../../services/tauri-bridge";
import type { EditorMode } from "../../types/editor";

function TitleBar({
  onToggleAI,
  onNewProject,
  onOpenProject,
  onCloseProject,
}: {
  onToggleAI: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onCloseProject: () => void;
}) {
  const fileName = useEditorStore((s) => s.fileName);
  const isDirty = useEditorStore((s) => s.isDirty);
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const { save, saveAs } = useFileSave();
  const [aiOpen, setAiOpen] = useState(false);

  function revertToSaved() {
    const { savedContent } = useEditorStore.getState();
    useEditorStore.getState().setContentNoHistory(savedContent);
  }

  useKeyboard([
    { key: "s", ctrl: true, handler: save },
    { key: "s", ctrl: true, shift: true, handler: saveAs },
  ]);

  const modes: { mode: EditorMode; label: string }[] = [
    { mode: "preview", label: "预览" },
    { mode: "source", label: "源码" },
  ];

  function cycleTheme() {
    const order: ThemeMode[] = ["light", "dark", "system", "paper"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  }

  const themeLabel = theme === "light" ? "☀" : theme === "dark" ? "☾" : theme === "system" ? "⇅" : "📜";

  return (
    <div className="flex h-10 items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-4 dark:border-zinc-800 dark:bg-zinc-900 paper:border-[#c4b6a4] paper:bg-[#cfc3b0]">
      <ProjectMenu
        onNewProject={onNewProject}
        onOpenProject={onOpenProject}
        onSave={save}
        onSaveAs={saveAs}
        onCloseProject={onCloseProject}
        hasFile={!!fileName}
      />
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {fileName}
      </span>
      {isDirty && (
        <span className="text-amber-500 text-xs" title="未保存的修改">●</span>
      )}
      <div className="flex items-center gap-1 ml-2">
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
        onClick={onToggleAI}
        title="AI 助手"
      >
        AI
      </button>
      <button
        className="rounded px-1 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        onClick={() => setAiOpen(true)}
        title="AI 配置"
      >
        ⚙
      </button>
      <button
        className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
        onClick={cycleTheme}
        title={`主题: ${theme}`}
      >
        {themeLabel}
      </button>
      {isDirty && (
        <button
          className="rounded px-3 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-500 dark:hover:bg-amber-950"
          onClick={revertToSaved}
          title="放弃修改 (Ctrl+Shift+Z)"
        >
          撤销更改
        </button>
      )}
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

function StatusBar() {
  const wordCount = useEditorStore((s) => s.wordCount);
  const lineCount = useEditorStore((s) => s.lineCount);
  const readingTime = useEditorStore((s) => s.readingTime);

  return (
    <div className="flex h-6 items-center gap-4 border-t border-zinc-200 bg-zinc-50 px-4 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 paper:border-[#c4b6a4] paper:bg-[#d9cebc] paper:text-[#6b6052]">
      <span>{wordCount} 字</span>
      <span>{lineCount} 行</span>
      <span>约 {readingTime} 分钟</span>
    </div>
  );
}

function openInNewWindow(filePath: string | null) {
  const label = `editor-${Date.now()}`;
  const url = filePath ? `/?openPath=${encodeURIComponent(filePath)}` : "/";
  const title = filePath
    ? filePath.split(/[\\/]/).pop() ?? "Markdown Editor"
    : "Markdown Editor";
  const win = new WebviewWindow(label, {
    url,
    title,
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
  });
  win.once("tauri://error", (e) => {
    console.error("Failed to create window:", e);
  });
}

export function AppShell() {
  useTheme();
  useFileWatch();
  const filePath = useEditorStore((s) => s.filePath);
  const mode = useEditorStore((s) => s.mode);
  const isDirty = useEditorStore((s) => s.isDirty);
  const immersiveMode = useUiStore((s) => s.immersiveMode);
  const toggleImmersive = useUiStore((s) => s.toggleImmersive);
  const { openFile, openByPath } = useFileOpen();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [windowChoice, setWindowChoice] = useState<"new" | "open" | null>(null);
  const initialOpenDone = useRef(false);

  // Open file passed via URL query parameter (new window)
  useEffect(() => {
    if (initialOpenDone.current) return;
    initialOpenDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const openPath = params.get("openPath");
    if (openPath) {
      const path = decodeURIComponent(openPath);
      openByPath(path);
      window.history.replaceState({}, "", "/");
    }
  }, [openByPath]);

  const handleOpenFile = useCallback(() => {
    openFile();
  }, [openFile]);

  const handleNewFile = useCallback(() => {
    if (isDirty) {
      if (!confirm("当前文件未保存。是否放弃修改并新建？")) return;
    }
    useEditorStore.getState().setContentNoHistory("");
    useEditorStore.getState().setFilePath(null);
    useEditorStore.getState().markClean();
  }, [isDirty]);

  // Project menu handlers
  const handleNewProject = useCallback(() => {
    if (filePath) {
      setWindowChoice("new");
    } else {
      handleNewFile();
    }
  }, [filePath, handleNewFile]);

  const handleOpenProject = useCallback(() => {
    if (filePath) {
      setWindowChoice("open");
    } else {
      handleOpenFile();
    }
  }, [filePath, handleOpenFile]);

  const handleCloseProject = useCallback(async () => {
    const state = useEditorStore.getState();
    if (state.isDirty) {
      const saveChoice = confirm("当前文件有未保存的修改，是否保存后再关闭？");
      if (saveChoice) {
        if (state.filePath) {
          try {
            await saveFile(state.filePath, state.content);
            await updateRecentFile(state.filePath);
          } catch (e) {
            console.error("Save failed:", e);
            return;
          }
        } else {
          const newPath = await saveFileDialog(state.content, state.fileName ?? "untitled.md");
          if (!newPath) return;
        }
      } else {
        if (!confirm("放弃未保存的修改并返回欢迎页？")) return;
      }
    }
    useEditorStore.getState().setContentNoHistory("");
    useEditorStore.getState().setFilePath(null);
    useEditorStore.getState().markClean();
  }, []);

  const handleCurrentWindow = useCallback((action: "new" | "open") => {
    setWindowChoice(null);
    if (action === "new") {
      handleNewFile();
    } else {
      handleOpenFile();
    }
  }, [handleNewFile, handleOpenFile]);

  const handleNewWindow = useCallback(async (action: "new" | "open") => {
    setWindowChoice(null);
    if (action === "new") {
      openInNewWindow(null);
    } else {
      try {
        const file = await openFileDialog();
        if (file) {
          openInNewWindow(file.path);
        }
      } catch (error) {
        if (error !== "No file selected") console.error(error);
      }
    }
  }, []);

  // Tauri close-requested: save-on-exit prompt
  useEffect(() => {
    const unlisten = listen("close-requested", async () => {
      const state = useEditorStore.getState();
      if (state.isDirty) {
        const saveChoice = confirm("当前文件有未保存的修改。\n\n是否保存后关闭？");
        if (saveChoice) {
          if (state.filePath) {
            try {
              await saveFile(state.filePath, state.content);
              await updateRecentFile(state.filePath);
              useEditorStore.getState().markClean();
            } catch (e) {
              console.error("Save failed:", e);
              return;
            }
          } else {
            const newPath = await saveFileDialog(state.content, state.fileName ?? "untitled.md");
            if (newPath) {
              useEditorStore.getState().setFilePath(newPath);
              useEditorStore.getState().markClean();
              await updateRecentFile(newPath);
            } else {
              return;
            }
          }
        } else {
          if (!confirm("放弃未保存的修改并关闭？")) {
            return;
          }
        }
      }
      await closeWindow();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleFileDrop = useCallback(
    (path: string) => {
      openByPath(path);
    },
    [openByPath],
  );

  useKeyboard([
    { key: "o", ctrl: true, handler: handleOpenFile },
    { key: "z", ctrl: true, handler: () => useEditorStore.getState().undo() },
    { key: "y", ctrl: true, handler: () => useEditorStore.getState().redo() },
    { key: "z", ctrl: true, shift: true, handler: () => useEditorStore.getState().redo() },
    { key: "Escape", handler: () => { if (immersiveMode) toggleImmersive(); } },
  ]);

  const hasFile = filePath !== null;

  return (
    <FileDropZone onFileDrop={handleFileDrop}>
      <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950 paper:bg-[#f5f0e8]">
        {hasFile ? (
          <>
            {!immersiveMode && (
              <TitleBar
                onToggleAI={() => setAiPanelOpen((v) => !v)}
                onNewProject={handleNewProject}
                onOpenProject={handleOpenProject}
                onCloseProject={handleCloseProject}
              />
            )}
            <div className="flex flex-1 overflow-hidden">
              {!immersiveMode && <Sidebar />}
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  {mode === "preview" && <PreviewMode />}
                  {mode === "source" && <SourceMode />}
                </div>
                {!immersiveMode && <StatusBar />}
              </div>
              {aiPanelOpen && (
                <div className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800">
                  <AIPanel onClose={() => setAiPanelOpen(false)} />
                </div>
              )}
            </div>
          </>
        ) : (
          <Welcome onOpenFile={handleOpenProject} onOpenByPath={openByPath} />
        )}

        {/* Window choice dialog */}
        {windowChoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-80 rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
              <h3 className="mb-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">选择打开方式</h3>
              <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">当前已有文件打开，请选择：</p>
              <div className="flex flex-col gap-2">
                <button
                  className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
                  onClick={() => handleCurrentWindow(windowChoice)}
                >
                  在当前窗口打开
                </button>
                <button
                  className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  onClick={() => handleNewWindow(windowChoice)}
                >
                  在新窗口打开
                </button>
                <button
                  className="mt-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  onClick={() => setWindowChoice(null)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FileDropZone>
  );
}
