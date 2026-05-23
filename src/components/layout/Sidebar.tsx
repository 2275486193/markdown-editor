import { useEffect, useState, useCallback } from "react";
import { useEditorStore } from "../../stores/editor";
import { useUiStore } from "../../stores/ui";
import { useTocHighlight } from "../../hooks/useTocHighlight";
import { navigateToHeading } from "../../services/heading-nav";
import { listFolder, readFile, updateRecentFile } from "../../services/tauri-bridge";
import { FileList } from "./FileList";
import { FileTree } from "./FileTree";
import type { TocNode } from "../../types/editor";
import type { FileEntry } from "../../types/file";

function TocItem({
  node,
  activeId,
  depth,
}: {
  node: TocNode;
  activeId: string | null;
  depth: number;
}) {
  return (
    <li>
      <button
        className={`block w-full truncate text-left text-sm leading-6 transition-colors ${
          node.id === activeId
            ? "font-semibold text-blue-600 dark:text-blue-400"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          const { mode } = useEditorStore.getState();
          navigateToHeading(node.id, node.text, mode);
        }}
        title={node.text}
      >
        {node.text}
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TocItem key={child.id} node={child} activeId={activeId} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function OutlinePanel() {
  const toc = useEditorStore((s) => s.toc);
  const activeId = useTocHighlight();

  if (toc.length === 0) {
    return <p className="p-4 text-xs text-zinc-400">暂无目录</p>;
  }

  return (
    <nav className="p-2">
      <ul className="space-y-0.5">
        {toc.map((node) => (
          <TocItem key={node.id} node={node} activeId={activeId} depth={0} />
        ))}
      </ul>
    </nav>
  );
}

function FilesPanel() {
  const filePath = useEditorStore((s) => s.filePath);
  const fileViewMode = useUiStore((s) => s.fileViewMode);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const parentDir = filePath
    ? filePath.replace(/[/\\][^/\\]+$/, "") || filePath
    : null;

  useEffect(() => {
    if (!parentDir) return;
    let cancelled = false;
    setLoading(true);
    listFolder(parentDir)
      .then((result) => {
        if (!cancelled) setEntries(result);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [parentDir]);

  const handleOpen = useCallback(async (path: string) => {
    try {
      const file = await readFile(path);
      useEditorStore.getState().setContentNoHistory(file.content);
      useEditorStore.getState().setFilePath(file.path);
      useEditorStore.getState().markClean();
      updateRecentFile(file.path);
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  }, []);

  if (loading) {
    return <p className="p-4 text-xs text-zinc-400">加载中...</p>;
  }

  if (fileViewMode === "tree") {
    return <FileTree entries={entries} currentPath={filePath} onOpen={handleOpen} />;
  }

  return <FileList entries={entries} currentPath={filePath} onOpen={handleOpen} />;
}

export function Sidebar() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const sidebarView = useUiStore((s) => s.sidebarView);
  const setSidebarView = useUiStore((s) => s.setSidebarView);
  const fileViewMode = useUiStore((s) => s.fileViewMode);
  const setFileViewMode = useUiStore((s) => s.setFileViewMode);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={`${sidebarCollapsed ? "w-0 overflow-hidden" : "w-56"} shrink-0 bg-zinc-50 transition-[width] duration-200 dark:bg-zinc-950 paper:bg-[#d9cebc]`}
    >
      <div className="flex h-full flex-col">
        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-zinc-200 dark:border-zinc-800 paper:border-[#c4b6a4]">
          {(["files", "outline"] as const).map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                sidebarView === tab
                  ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
              onClick={() => setSidebarView(tab)}
            >
              {tab === "files" ? "📁 文件" : "☰ 大纲"}
            </button>
          ))}
        </div>

        {/* View toggle (only in files tab) */}
        {sidebarView === "files" && (
          <div className="flex shrink-0 items-center justify-end gap-1 px-3 py-1.5">
            <button
              className={`rounded px-1.5 py-0.5 text-xs ${fileViewMode === "tree" ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" : "text-zinc-400 hover:text-zinc-600"}`}
              onClick={() => setFileViewMode("tree")}
              title="树状视图"
            >
              🌳
            </button>
            <button
              className={`rounded px-1.5 py-0.5 text-xs ${fileViewMode === "list" ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" : "text-zinc-400 hover:text-zinc-600"}`}
              onClick={() => setFileViewMode("list")}
              title="列表视图"
            >
              📋
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {sidebarView === "outline" ? <OutlinePanel /> : <FilesPanel />}
        </div>

        {/* Close button */}
        <button
          className="flex shrink-0 items-center justify-center gap-1 border-t border-zinc-200 py-2 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:border-zinc-800 dark:hover:text-zinc-300 paper:border-[#c4b6a4]"
          onClick={toggleSidebar}
        >
          ✕ 收起侧栏
        </button>
      </div>
    </aside>
  );
}
