export interface FileInfo {
  path: string;
  name: string;
  content: string;
  size: number;
  modified: number;
}

export interface RecentFile {
  path: string;
  name: string;
  last_opened: number;
  pinned: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  modified: number;
  children: FileEntry[];
}
