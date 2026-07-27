import { invoke } from "@tauri-apps/api/core";
import type { FileInfo, RecentFile } from "../types/file";

export async function openFileDialog(): Promise<FileInfo> {
  return invoke<FileInfo>("open_file_dialog");
}

export async function readFile(path: string): Promise<FileInfo> {
  return invoke<FileInfo>("read_file", { path });
}

export async function saveFile(
  path: string,
  content: string,
): Promise<void> {
  return invoke("save_file", { path, content });
}

export async function saveFileDialog(
  content: string,
  suggestedName: string,
): Promise<string> {
  return invoke<string>("save_file_dialog", {
    content,
    suggestedName,
  });
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  return invoke<RecentFile[]>("get_recent_files");
}

export async function updateRecentFile(
  path: string,
  pinned?: boolean,
): Promise<void> {
  return invoke("update_recent_file", { path, pinned });
}

export async function removeRecentFile(path: string): Promise<void> {
  return invoke("remove_recent_file", { path });
}

export async function startWatch(path: string): Promise<void> {
  return invoke("start_watch", { path });
}

export async function stopWatch(): Promise<void> {
  return invoke("stop_watch");
}

export async function closeWindow(): Promise<void> {
  return invoke("close_window");
}

export async function listFolder(path: string): Promise<import("../types/file").FileEntry[]> {
  return invoke("list_folder", { path });
}
