import { create } from "zustand";
import type { EditorMode, CursorPosition, TextSelection, TocNode } from "../types/editor";

const MAX_UNDO = 200;

interface EditorStore {
  content: string;
  savedContent: string;
  mode: EditorMode;
  isDirty: boolean;
  filePath: string | null;
  fileName: string | null;
  cursor: CursorPosition | null;
  selection: TextSelection | null;
  scrollPosition: number;
  pendingSourceLine: number | null;

  wordCount: number;
  lineCount: number;
  readingTime: number;
  toc: TocNode[];
  isEmpty: boolean;

  undoStack: string[];
  redoStack: string[];

  setContent: (content: string) => void;
  setContentNoHistory: (content: string) => void;
  setMode: (mode: EditorMode) => void;
  setFilePath: (path: string | null) => void;
  setCursor: (cursor: CursorPosition | null) => void;
  setSelection: (selection: TextSelection | null) => void;
  setScrollPosition: (ratio: number) => void;
  markClean: () => void;
  undo: () => void;
  redo: () => void;
  setPendingSourceLine: (line: number | null) => void;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿\s-]/g, "")
    .replace(/\s+/g, "-");
}

function computeToc(content: string): TocNode[] {
  const lines = content.split("\n");
  const root: TocNode[] = [];
  const stack: { level: number; children: TocNode[] }[] = [{ level: 0, children: root }];
  let inFence = false;
  for (const line of lines) {
    // Track fenced code blocks (```, ````, etc.)
    // Opening: backticks can be followed by language identifier
    // Closing: backticks only (may have trailing whitespace)
    const fenceEnd = line.match(/^(`{3,})\s*$/);
    if (fenceEnd) {
      inFence = !inFence;
      continue;
    }
    const fenceStart = line.match(/^(`{3,})[^\n`]/);
    if (fenceStart) {
      inFence = true;
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim();
    const id = slugify(text);
    const node: TocNode = { id, text, level: level as TocNode["level"], children: [] };
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push({ level, children: node.children });
  }
  return root;
}

export function normalizeOpenedMarkdown(content: string): string {
  return content.replace(/\n+$/, "");
}

function computeDerived(content: string) {
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content ? content.split("\n").length : 0;
  const readingTime = Math.ceil(wordCount / 200);
  const isEmpty = content.length === 0;
  const toc = computeToc(content);
  return { wordCount, lineCount, readingTime, isEmpty, toc };
}

let lastPush = 0;

export const useEditorStore = create<EditorStore>()((set, get) => ({
  content: "",
  savedContent: "",
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

  pendingSourceLine: null,

  undoStack: [],
  redoStack: [],

  setContent: (content) => {
    const state = get();
    if (content === state.content) return;
    const derived = computeDerived(content);
    const now = Date.now();
    const undoStack = [...state.undoStack];
    const redoStack: string[] = [];
    // Debounce: keep the first baseline snapshot, skip within 500ms window
    if (now - lastPush >= 500 || undoStack.length === 0) {
      undoStack.push(state.content);
      if (undoStack.length > MAX_UNDO) undoStack.shift();
    }
    lastPush = now;
    set({
      content,
      isDirty: content !== state.savedContent,
      undoStack,
      redoStack,
      ...derived,
    });
  },

  setContentNoHistory: (content) => {
    const state = get();
    const derived = computeDerived(content);
    set({
      content,
      isDirty: content !== state.savedContent,
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

  markClean: () =>
    set((state) => ({
      isDirty: false,
      savedContent: state.content,
    })),

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const undoStack = [...state.undoStack];
    const prev = undoStack.pop()!;
    const redoStack = [...state.redoStack, state.content];
    const derived = computeDerived(prev);
    set({
      content: prev,
      isDirty: prev !== state.savedContent,
      undoStack,
      redoStack,
      ...derived,
    });
    lastPush = 0;
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const redoStack = [...state.redoStack];
    const next = redoStack.pop()!;
    const undoStack = [...state.undoStack, state.content];
    const derived = computeDerived(next);
    set({
      content: next,
      isDirty: next !== state.savedContent,
      undoStack,
      redoStack,
      ...derived,
    });
    lastPush = 0;
  },

  setPendingSourceLine: (pendingSourceLine) => set({ pendingSourceLine }),
}));
