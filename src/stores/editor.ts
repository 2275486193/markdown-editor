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

function computeDerived(content: string) {
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content ? content.split("\n").length : 0;
  const readingTime = Math.ceil(wordCount / 200);
  const isEmpty = content.length === 0;
  return { wordCount, lineCount, readingTime, isEmpty };
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
