import { useState } from "react";
import type { FileEntry } from "../../types/file";

function TreeNode({
  entry,
  depth,
  currentPath,
  onOpen,
}: {
  entry: FileEntry;
  depth: number;
  currentPath: string | null;
  onOpen: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (entry.is_dir) {
    const hasMdChildren = entry.children.some((c) => !c.is_dir);
    return (
      <div>
        <button
          className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
            expanded ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-400"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-xs">{expanded ? "▾" : "▸"}</span>
          <span className="text-xs">📁</span>
          <span className="min-w-0 truncate">{entry.name}</span>
        </button>
        {expanded && (
          <div>
            {entry.children
              .filter((c) => !c.is_dir || c.children.some((gc) => !gc.is_dir || gc.children.length > 0))
              .map((child) => (
                <TreeNode
                  key={child.path}
                  entry={child}
                  depth={depth + 1}
                  currentPath={currentPath}
                  onOpen={onOpen}
                />
              ))}
            {hasMdChildren && (
              <p className="py-1 text-xs text-zinc-400" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
                打开文件夹查看所有文件
              </p>
            )}
            {entry.children.length === 0 && (
              <p className="py-1 text-xs text-zinc-400" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
                空文件夹
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
        entry.path === currentPath
          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          : "text-zinc-600 dark:text-zinc-400"
      }`}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
      onClick={() => onOpen(entry.path)}
      title={entry.path}
    >
      <span className="text-xs shrink-0">📄</span>
      <span className="min-w-0 truncate">{entry.name}</span>
    </button>
  );
}

export function FileTree({
  entries,
  currentPath,
  onOpen,
}: {
  entries: FileEntry[];
  currentPath: string | null;
  onOpen: (path: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="p-4 text-xs text-zinc-400">目录中无 Markdown 文件</p>;
  }

  return (
    <div className="p-1">
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          currentPath={currentPath}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
