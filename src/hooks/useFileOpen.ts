import { useCallback } from "react";
import { useEditorStore } from "../stores/editor";
import { openFileDialog, readFile, updateRecentFile } from "../services/tauri-bridge";

export function useFileOpen() {
  const setContent = useEditorStore((s) => s.setContent);
  const setFilePath = useEditorStore((s) => s.setFilePath);
  const markClean = useEditorStore((s) => s.markClean);

  const openFile = useCallback(async () => {
    try {
      const file = await openFileDialog();
      if (file) {
        setContent(file.content);
        setFilePath(file.path);
        markClean();
        await updateRecentFile(file.path);
      }
    } catch (error) {
      if (error !== "No file selected") {
        console.error("Failed to open file:", error);
      }
    }
  }, [setContent, setFilePath, markClean]);

  const openByPath = useCallback(
    async (path: string) => {
      try {
        const file = await readFile(path);
        if (file) {
          setContent(file.content);
          setFilePath(file.path);
          markClean();
          await updateRecentFile(file.path);
        }
      } catch (error) {
        console.error("Failed to open file:", error);
      }
    },
    [setContent, setFilePath, markClean],
  );

  return { openFile, openByPath };
}
