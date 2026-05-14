import { useCallback } from "react";
import { useEditorStore } from "../stores/editor";
import { saveFile, saveFileDialog, updateRecentFile } from "../services/tauri-bridge";

export function useFileSave() {
  const content = useEditorStore((s) => s.content);
  const filePath = useEditorStore((s) => s.filePath);
  const fileName = useEditorStore((s) => s.fileName);
  const setFilePath = useEditorStore((s) => s.setFilePath);
  const markClean = useEditorStore((s) => s.markClean);

  const save = useCallback(async () => {
    if (!filePath) {
      const newPath = await saveFileDialog(content, fileName ?? "untitled.md");
      if (newPath) {
        setFilePath(newPath);
        markClean();
        await updateRecentFile(newPath);
      }
      return;
    }
    try {
      await saveFile(filePath, content);
      markClean();
      await updateRecentFile(filePath);
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  }, [filePath, content, fileName, setFilePath, markClean]);

  const saveAs = useCallback(async () => {
    try {
      const newPath = await saveFileDialog(content, fileName ?? "untitled.md");
      if (newPath) {
        setFilePath(newPath);
        markClean();
        await updateRecentFile(newPath);
      }
    } catch (error) {
      if (error !== "No file selected") {
        console.error("Failed to save file:", error);
      }
    }
  }, [content, fileName, setFilePath, markClean]);

  return { save, saveAs };
}
