import { useState, useEffect, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";

interface FileDropZoneProps {
  onFileDrop: (path: string) => void;
  children: ReactNode;
}

interface TauriDragDropPayload {
  type: "enter" | "over" | "leave" | "drop";
  paths?: string[];
  position?: { x: number; y: number };
}

export function FileDropZone({ onFileDrop, children }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const listeners: (() => void)[] = [];

    async function setupListeners() {
      const unlistenEnter = await listen<TauriDragDropPayload>("tauri://drag-enter", () => {
        setIsDragOver(true);
      });
      const unlistenOver = await listen<TauriDragDropPayload>("tauri://drag-over", () => {
        setIsDragOver(true);
      });
      const unlistenLeave = await listen<TauriDragDropPayload>("tauri://drag-leave", () => {
        setIsDragOver(false);
      });
      const unlistenDrop = await listen<TauriDragDropPayload>("tauri://drag-drop", (event) => {
        setIsDragOver(false);
        const paths = event.payload.paths;
        if (paths) {
          for (const p of paths) {
            const lower = p.toLowerCase();
            if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
              onFileDrop(p);
              break;
            }
          }
        }
      });
      listeners.push(unlistenEnter, unlistenOver, unlistenLeave, unlistenDrop);
    }

    setupListeners();
    return () => {
      listeners.forEach((fn) => fn());
    };
  }, [onFileDrop]);

  return (
    <div className="relative h-full w-full">
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
