export type EditorMode = "preview" | "source";

export interface CursorPosition {
  line: number;
  column: number;
}

export interface TextSelection {
  start: CursorPosition;
  end: CursorPosition;
  text: string;
}

export interface TocNode {
  id: string;
  text: string;
  level: number;
  children: TocNode[];
}
