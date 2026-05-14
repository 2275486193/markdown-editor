import { create } from "zustand";
import type { EditorMode, CursorPosition, TextSelection, TocNode } from "../types/editor";

interface EditorStore {
  content: string;
  mode: EditorMode;
  isDirty: boolean;
  filePath: string | null;
  fileName: string | null;
  cursor: CursorPosition | null;
  selection: TextSelection | null;
  scrollPosition: number;

  wordCount: number;
  lineCount: number;
  readingTime: number;
  toc: TocNode[];
  isEmpty: boolean;

  setContent: (content: string) => void;
  setMode: (mode: EditorMode) => void;
  setFilePath: (path: string | null) => void;
  setCursor: (cursor: CursorPosition | null) => void;
  setSelection: (selection: TextSelection | null) => void;
  setScrollPosition: (ratio: number) => void;
  markClean: () => void;
  markDirty: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿\s-]/g, "")
    .replace(/\s+/g, "-");
}

function computeToc(content: string): TocNode[] {
  const lines = content.split("\n");
  const root: TocNode[] = [];
  const stack: { level: number; children: TocNode[] }[] = [
    { level: 0, children: root },
  ];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim();
    const id = slugify(text);

    const node: TocNode = { id, text, level: level as TocNode["level"], children: [] };

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push({ level, children: node.children });
  }

  return root;
}

function computeDerived(content: string) {
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content ? content.split("\n").length : 0;
  const readingTime = Math.ceil(wordCount / 200);
  const isEmpty = content.length === 0;
  const toc = computeToc(content);
  return { wordCount, lineCount, readingTime, isEmpty, toc };
}

export const useEditorStore = create<EditorStore>()((set, get) => ({
  content: "",
  mode: "preview",
  isDirty: false,
  filePath: null,
  fileName: null,
  cursor: null,
  selection: null,
  scrollPosition: 0,

  wordCount: 0,
  lineCount: 0,
  readingTime: 0,
  toc: [],
  isEmpty: true,

  setContent: (content) => {
    const current = get();
    const derived = computeDerived(content);
    set({
      content,
      isDirty: content !== current.content,
      ...derived,
    });
  },

  setMode: (mode) => set({ mode }),

  setFilePath: (path) => {
    const fileName = path ? path.split(/[\\/]/).pop() ?? null : null;
    set({ filePath: path, fileName });
  },

  setCursor: (cursor) => set({ cursor }),
  setSelection: (selection) => set({ selection }),
  setScrollPosition: (scrollPosition) => set({ scrollPosition }),

  markClean: () => set({ isDirty: false }),
  markDirty: () => set({ isDirty: true }),
}));
