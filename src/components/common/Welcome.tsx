interface WelcomeProps {
  onOpenFile: () => void;
}

export function Welcome({ onOpenFile }: WelcomeProps) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-zinc-500">
        <svg
          className="h-16 w-16"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <p className="text-lg">打开一个 Markdown 文件开始编辑</p>
        <div className="flex flex-col items-center gap-2 text-sm">
          <button
            onClick={onOpenFile}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 transition-colors"
          >
            打开文件
          </button>
          <p className="text-zinc-400">或按 Ctrl+O 打开文件对话框</p>
          <p className="text-zinc-400">或拖拽 .md 文件到窗口</p>
        </div>
      </div>
    </div>
  );
}
