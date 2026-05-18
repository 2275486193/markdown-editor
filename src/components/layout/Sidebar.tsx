import { useEditorStore } from "../../stores/editor";
import { useUiStore } from "../../stores/ui";
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
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  if (toc.length === 0) return null;

  return (
    <aside className={`${sidebarCollapsed ? "w-8" : "w-52"} shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50 transition-all dark:border-zinc-800 dark:bg-zinc-950 paper:border-[#c4b6a4] paper:bg-[#d9cebc]`}>
      <button
        className="flex w-full items-center justify-center py-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 paper:hover:text-[#3d3d3d]"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? "展开目录" : "收起目录"}
      >
        {sidebarCollapsed ? "▶" : "◀"}
      </button>
      {!sidebarCollapsed && (
        <>
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 paper:text-[#6b6052]">
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
        </>
      )}
    </aside>
  );
}
