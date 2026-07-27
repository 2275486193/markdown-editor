import type { FileEntry } from "../../types/file";

function formatDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FileList({
  entries,
  currentPath,
  onOpen,
}: {
  entries: FileEntry[];
  currentPath: string | null;
  onOpen: (path: string) => void;
}) {
  const flat = flattenEntries(entries);

  if (flat.length === 0) {
    return <p className="p-4 text-xs text-zinc-400">目录中无 Markdown 文件</p>;
  }

  return (
    <ul className="space-y-0.5 p-2">
      {flat.map((e) => (
        <li key={e.path}>
          <button
            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-800 ${
              e.path === currentPath
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
            onClick={() => onOpen(e.path)}
            title={e.path}
          >
            <span className="text-xs shrink-0">
              {e.is_dir ? "📁" : "📄"}
            </span>
            <span className="min-w-0 truncate">{e.name}</span>
            <span className="ml-auto shrink-0 text-xs text-zinc-400">
              {formatDate(e.modified)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Flatten tree entries into a depth-sorted list */
function flattenEntries(entries: FileEntry[]): FileEntry[] {
  const result: FileEntry[] = [];
  for (const e of entries) {
    result.push(e);
    if (e.children.length > 0) {
      result.push(...flattenEntries(e.children));
    }
  }
  return result;
}
