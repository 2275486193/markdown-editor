import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useEditorStore } from "../stores/editor";
import { startWatch, stopWatch } from "../services/tauri-bridge";

interface FileChangeEvent {
  path: string;
  content: string;
}

interface FileRemoveEvent {
  path: string;
}

export function useFileWatch() {
  const filePath = useEditorStore((s) => s.filePath);
  const isDirty = useEditorStore((s) => s.isDirty);
  const markClean = useEditorStore((s) => s.markClean);

  useEffect(() => {
    if (!filePath) return;
    startWatch(filePath).catch(() => {});
    return () => { stopWatch().catch(() => {}); };
  }, [filePath]);

  useEffect(() => {
    const unlistenChange = listen<FileChangeEvent>("file-changed", (event) => {
      const { path, content } = event.payload;
      if (path !== filePath) return;
      if (isDirty) {
        if (window.confirm("文件已被外部修改，是否放弃当前修改并重新加载？")) {
          useEditorStore.getState().setContentNoHistory(content);
          markClean();
        }
      } else {
        useEditorStore.getState().setContentNoHistory(content);
        markClean();
      }
    });

    const unlistenRemove = listen<FileRemoveEvent>("file-removed", (_event) => {
      window.alert("文件已被外部删除，编辑器内容仍保留。");
    });

    return () => {
      unlistenChange.then((fn) => fn());
      unlistenRemove.then((fn) => fn());
    };
  }, [filePath, isDirty, markClean]);
}
