import { useEffect, useRef } from "react";
import { useEditorStore } from "../stores/editor";
import { saveFile, updateRecentFile } from "../services/tauri-bridge";

export function useAutoSave(intervalMs = 30000) {
  const isDirty = useEditorStore((s) => s.isDirty);
  const filePath = useEditorStore((s) => s.filePath);
  const content = useEditorStore((s) => s.content);
  const markClean = useEditorStore((s) => s.markClean);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    const id = setInterval(async () => {
      if (!isDirtyRef.current || !filePathRef.current) return;
      try {
        await saveFile(filePathRef.current, contentRef.current);
        markClean();
        await updateRecentFile(filePathRef.current);
      } catch {
        // silent fail for auto-save
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, markClean]);
}
