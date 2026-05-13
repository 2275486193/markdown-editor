import { useState, useCallback, type DragEvent, type ReactNode } from "react";

interface FileDropZoneProps {
  onFileDrop: (path: string) => void;
  children: ReactNode;
}

export function FileDropZone({ onFileDrop, children }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      // Tauri 2 exposes file paths via dataTransfer
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith(".md") || file.name.endsWith(".markdown")) {
          // In Tauri, the full path is available via the path property
          const filePath = (file as unknown as { path?: string }).path;
          if (filePath) {
            onFileDrop(filePath);
          }
        }
      }
    },
    [onFileDrop],
  );

  return (
    <div
      className="relative h-full w-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-blue-400 bg-white/90 px-8 py-6 dark:bg-zinc-900/90">
            <p className="text-lg font-medium text-blue-600 dark:text-blue-400">
              释放文件以打开
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
