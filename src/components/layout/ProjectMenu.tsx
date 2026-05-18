import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface ProjectMenuProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onCloseProject: () => void;
  hasFile: boolean;
}

const itemCls =
  "flex items-center px-3 py-1.5 text-xs cursor-pointer text-zinc-700 dark:text-zinc-300 rounded outline-none select-none data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-zinc-700 data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed";

export function ProjectMenu({
  onNewProject,
  onOpenProject,
  onSave,
  onSaveAs,
  onCloseProject,
  hasFile,
}: ProjectMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="rounded px-2 py-1 text-xs font-medium text-zinc-500 outline-none hover:bg-zinc-200 data-[state=open]:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:data-[state=open]:bg-zinc-800">
        项目
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          sideOffset={4}
          align="start"
        >
          <DropdownMenu.Item className={itemCls} onSelect={onNewProject}>
            📄 新建项目
          </DropdownMenu.Item>
          <DropdownMenu.Item className={itemCls} onSelect={onOpenProject}>
            📁 打开项目...
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

          <DropdownMenu.Item className={itemCls} onSelect={onSave} disabled={!hasFile}>
            <span className="flex-1">保存</span>
            <span className="ml-4 text-zinc-400">Ctrl+S</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={itemCls} onSelect={onSaveAs} disabled={!hasFile}>
            <span className="flex-1">另存为...</span>
            <span className="ml-4 text-zinc-400">Ctrl+Shift+S</span>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

          <DropdownMenu.Item className={itemCls} onSelect={onCloseProject} disabled={!hasFile}>
            关闭项目
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
