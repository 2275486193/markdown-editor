import type { CursorPosition } from "../types/editor";

/** Convert Source (line,col) to WYSIWYG character offset */
export function sourceToWysiwygPos(
  content: string,
  cursor: CursorPosition,
): number {
  const lines = content.split("\n");
  let pos = 0;
  for (let i = 0; i < cursor.line - 1 && i < lines.length; i++) {
    pos += lines[i].length + 1; // +1 for the newline
  }
  pos += cursor.column - 1;
  return Math.min(pos, content.length);
}

/** Convert WYSIWYG character offset to Source (line,col) */
export function wysiwygToSourcePos(
  content: string,
  pos: number,
): CursorPosition {
  let remaining = Math.min(pos, content.length);
  let line = 1;
  let column = 1;
  for (const char of content) {
    if (remaining === 0) break;
    if (char === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
    remaining--;
  }
  return { line, column };
}
