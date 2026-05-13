import { useCallback } from "react";
import { Welcome } from "../common/Welcome";
import { FileDropZone } from "../common/FileDropZone";
import { useFileOpen } from "../../hooks/useFileOpen";
import { useKeyboard } from "../../hooks/useKeyboard";

export function AppShell() {
  const { openFile, openByPath } = useFileOpen();

  const handleOpenFile = useCallback(() => {
    openFile();
  }, [openFile]);

  const handleFileDrop = useCallback(
    (path: string) => {
      openByPath(path);
    },
    [openByPath],
  );

  useKeyboard([{ key: "o", ctrl: true, handler: handleOpenFile }]);

  return (
    <FileDropZone onFileDrop={handleFileDrop}>
      <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
        <Welcome onOpenFile={handleOpenFile} />
      </div>
    </FileDropZone>
  );
}
