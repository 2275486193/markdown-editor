import { useEditorStore } from "../../stores/editor";
import { useTocHighlight } from "../../hooks/useTocHighlight";
import { navigateToHeading } from "../../services/heading-nav";
import type { TocNode } from "../../types/editor";

function scrollToHeading(id: string, text: string) {
  const { mode } = useEditorStore.getState();
  navigateToHeading(id, text, mode);
}

function TocItem({
  node,
  activeId,
  depth,
}: {
  node: TocNode;
  activeId: string | null;
  depth: number;
}) {
  const isActive = node.id === activeId;

  return (
    <li>
      <button
        className={`block w-full truncate text-left text-sm leading-6 transition-colors ${
          isActive
            ? "font-semibold text-blue-600 dark:text-blue-400"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => scrollToHeading(node.id, node.text)}
        title={node.text}
      >
        {node.text}
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TocItem
              key={child.id}
              node={child}
              activeId={activeId}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar() {
  const toc = useEditorStore((s) => s.toc);
  const activeId = useTocHighlight();

  if (toc.length === 0) return null;

  return (
    <aside className="w-52 shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        目录
      </div>
      <nav>
        <ul className="space-y-0.5">
          {toc.map((node) => (
            <TocItem
              key={node.id}
              node={node}
              activeId={activeId}
              depth={0}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
