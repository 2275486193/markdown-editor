import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Welcome } from "../common/Welcome";
import { FileDropZone } from "../common/FileDropZone";
import { PreviewMode } from "../editor/PreviewMode";
import { SourceMode } from "../editor/SourceMode";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { AIPanel } from "../ai/AIPanel";
import { useFileOpen } from "../../hooks/useFileOpen";
import { useKeyboard } from "../../hooks/useKeyboard";
import { useTheme } from "../../hooks/useTheme";
import { useFileWatch } from "../../hooks/useFileWatch";
import { useEditorStore } from "../../stores/editor";
import { useUiStore } from "../../stores/ui";
import { closeWindow, saveFile, saveFileDialog, updateRecentFile } from "../../services/tauri-bridge";

function StatusBar() {
  const wordCount = useEditorStore((s) => s.wordCount);
  const lineCount = useEditorStore((s) => s.lineCount);
  const readingTime = useEditorStore((s) => s.readingTime);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const immersiveMode = useUiStore((s) => s.immersiveMode);
  const toggleImmersive = useUiStore((s) => s.toggleImmersive);
  const fileViewMode = useUiStore((s) => s.fileViewMode);
  const setFileViewMode = useUiStore((s) => s.setFileViewMode);
  const sidebarView = useUiStore((s) => s.sidebarView);

  return (
    <div className={`flex h-7 items-center gap-3 border-t px-3 text-xs transition-colors ${
      immersiveMode
        ? "border-transparent bg-zinc-50/60 text-zinc-300 dark:bg-zinc-950/60 dark:text-zinc-600 paper:bg-[#d9cebc]/60 paper:text-[#b0a090]"
        : "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 paper:border-[#c4b6a4] paper:bg-[#d9cebc] paper:text-[#6b6052]"
    }`}>
      {/* Sidebar toggle */}
      <button
        className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? "显示侧栏" : "隐藏侧栏"}
      >
        {sidebarCollapsed ? "☰" : "✕"}
      </button>

      {/* File view mode (only when sidebar is open on files tab) */}
      {!sidebarCollapsed && sidebarView === "files" && (
        <div className="flex items-center gap-0.5">
          <button
            className={`rounded px-1 py-0.5 ${fileViewMode === "list" ? "text-zinc-600 dark:text-zinc-300" : ""}`}
            onClick={() => setFileViewMode("list")}
            title="列表视图"
          >
            ☰
          </button>
          <button
            className={`rounded px-1 py-0.5 ${fileViewMode === "tree" ? "text-zinc-600 dark:text-zinc-300" : ""}`}
            onClick={() => setFileViewMode("tree")}
            title="树状视图"
          >
            🌳
          </button>
        </div>
      )}

      <div className="flex-1" />

      {/* Stats */}
      <span>{wordCount} 字</span>
      <span>{lineCount} 行</span>
      <span>约 {readingTime} 分钟</span>

      {/* Immersive toggle */}
      <button
        className={`rounded px-1.5 py-0.5 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 ${immersiveMode ? "text-blue-500" : ""}`}
        onClick={toggleImmersive}
        title={immersiveMode ? "退出沉浸式 (Esc)" : "沉浸式阅读"}
      >
        {immersiveMode ? "⊡" : "⊙"}
      </button>
    </div>
  );
}

function openInNewWindow(filePath: string | null) {
  const label = `editor-${Date.now()}`;
  const url = filePath ? `/?openPath=${encodeURIComponent(filePath)}` : "/";
  const win = new WebviewWindow(label, {
    url,
    title: filePath ? filePath.split(/[\\/]/).pop() ?? "Markdown Editor" : "Markdown Editor",
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

  // Open file via URL query param (new window)
  useEffect(() => {
    if (initialOpenDone.current) return;
    initialOpenDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const openPath = params.get("openPath");
    if (openPath) {
      openByPath(decodeURIComponent(openPath));
      window.history.replaceState({}, "", "/");
    }
  }, [openByPath]);

  // Project menu handlers
  const handleNewFile = useCallback(() => {
    if (isDirty && !confirm("当前文件未保存。是否放弃修改并新建？")) return;
    useEditorStore.getState().setContentNoHistory("");
    useEditorStore.getState().setFilePath(null);
    useEditorStore.getState().markClean();
  }, [isDirty]);

  const handleOpenFile = useCallback(() => openFile(), [openFile]);

  const handleCloseProject = useCallback(async () => {
    const state = useEditorStore.getState();
    if (state.isDirty) {
      const saveChoice = confirm("当前文件有未保存的修改，是否保存后再关闭？");
      if (saveChoice) {
        if (state.filePath) {
          try {
            await saveFile(state.filePath, state.content);
            await updateRecentFile(state.filePath);
          } catch (e) { console.error("Save failed:", e); return; }
        } else {
          const newPath = await saveFileDialog(state.content, state.fileName ?? "untitled.md");
          if (!newPath) return;
        }
      } else if (!confirm("放弃未保存的修改并返回欢迎页？")) return;
    }
    useEditorStore.getState().setContentNoHistory("");
    useEditorStore.getState().setFilePath(null);
    useEditorStore.getState().markClean();
  }, []);

  // Ctrl+O / Ctrl+Z / Ctrl+Y / Ctrl+E / Esc
  useKeyboard([
    { key: "o", ctrl: true, handler: handleOpenFile },
    { key: "z", ctrl: true, handler: () => useEditorStore.getState().undo() },
    { key: "y", ctrl: true, handler: () => useEditorStore.getState().redo() },
    { key: "z", ctrl: true, shift: true, handler: () => useEditorStore.getState().redo() },
    { key: "e", ctrl: true, handler: () => {
      const s = useEditorStore.getState();
      s.setMode(s.mode === "preview" ? "source" : "preview");
    }},
    { key: "Escape", handler: () => { if (immersiveMode) toggleImmersive(); } },
  ]);

  // Tauri close-requested
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
            } catch (e) { console.error("Save failed:", e); return; }
          } else {
            const newPath = await saveFileDialog(state.content, state.fileName ?? "untitled.md");
            if (newPath) {
              useEditorStore.getState().setFilePath(newPath);
              useEditorStore.getState().markClean();
              await updateRecentFile(newPath);
            } else return;
          }
        } else if (!confirm("放弃未保存的修改并关闭？")) return;
      }
      await closeWindow();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleFileDrop = useCallback((path: string) => openByPath(path), [openByPath]);

  const hasFile = filePath !== null;

  return (
    <FileDropZone onFileDrop={handleFileDrop}>
      <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950 paper:bg-[#f5f0e8]">
        {hasFile ? (
          <>
            {!immersiveMode && (
              <TitleBar
                onToggleAI={() => setAiPanelOpen((v) => !v)}
                onNewProject={handleNewFile}
                onOpenProject={handleOpenFile}
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
                <StatusBar />
              </div>
              {aiPanelOpen && (
                <div className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800">
                  <AIPanel onClose={() => setAiPanelOpen(false)} />
                </div>
              )}
            </div>
          </>
        ) : (
          <Welcome onOpenFile={handleOpenFile} onOpenByPath={openByPath} />
        )}

        {windowChoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-80 rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
              <h3 className="mb-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">选择打开方式</h3>
              <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">当前已有文件打开，请选择：</p>
              <div className="flex flex-col gap-2">
                <button
                  className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
                  onClick={() => { setWindowChoice(null); handleNewFile(); }}
                >
                  在当前窗口打开
                </button>
                <button
                  className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  onClick={() => { setWindowChoice(null); openInNewWindow(null); }}
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
