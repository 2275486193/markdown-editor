import { useEffect, useState } from "react";
import { getRecentFiles, updateRecentFile, removeRecentFile } from "../../services/tauri-bridge";
import type { RecentFile } from "../../types/file";

interface WelcomeProps {
  onOpenFile: () => void;
  onOpenByPath: (path: string) => void;
}

export function Welcome({ onOpenFile, onOpenByPath }: WelcomeProps) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  useEffect(() => {
    getRecentFiles().then(setRecentFiles);
  }, []);

  function handleTogglePin(file: RecentFile) {
    updateRecentFile(file.path, !file.pinned);
    setRecentFiles((prev) =>
      prev.map((f) =>
        f.path === file.path ? { ...f, pinned: !f.pinned } : f,
      ),
    );
  }

  function handleRemove(file: RecentFile) {
    removeRecentFile(file.path);
    setRecentFiles((prev) => prev.filter((f) => f.path !== file.path));
  }

  const sorted = [...recentFiles].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.last_opened - a.last_opened;
  });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4 text-zinc-500">
        <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-lg">打开一个 Markdown 文件开始编辑</p>
        <div className="flex flex-col items-center gap-2 text-sm">
          <button
            onClick={onOpenFile}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 transition-colors"
          >
            打开文件
          </button>
          <p className="text-zinc-400">或按 Ctrl+O / 拖拽 .md 文件到窗口</p>
        </div>
      </div>

      {sorted.length > 0 && (
        <div className="w-80">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            最近文件
          </h3>
          <ul className="space-y-1">
            {sorted.slice(0, 10).map((file) => (
              <li
                key={file.path}
                className="flex items-center gap-2 rounded px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <button
                  className="flex-1 truncate text-left text-sm text-zinc-600 dark:text-zinc-400"
                  onClick={() => onOpenByPath(file.path)}
                >
                  {file.name}
                </button>
                <button
                  className={`text-xs ${file.pinned ? "text-blue-500" : "text-zinc-300 hover:text-zinc-500 dark:text-zinc-600"}`}
                  onClick={() => handleTogglePin(file)}
                  title={file.pinned ? "取消置顶" : "置顶"}
                >
                  📌
                </button>
                <button
                  className="text-xs text-zinc-300 hover:text-red-400 dark:text-zinc-600"
                  onClick={() => handleRemove(file)}
                  title="清除"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
