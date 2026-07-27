import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeOpenedMarkdown, useEditorStore } from '../editor';

describe('normalizeOpenedMarkdown', () => {
  it('trims one or more trailing line feeds', () => {
    expect(normalizeOpenedMarkdown('hello\n')).toBe('hello');
    expect(normalizeOpenedMarkdown('hello\n\n\n')).toBe('hello');
  });

  it('preserves internal blank lines and non-newline trailing whitespace', () => {
    expect(normalizeOpenedMarkdown('a\n\nb\n')).toBe('a\n\nb');
    expect(normalizeOpenedMarkdown('a  ')).toBe('a  ');
  });
});

describe('editor store clean baseline', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: '',
      savedContent: '',
      isDirty: false,
      filePath: null,
      fileName: null,
      undoStack: [],
      redoStack: [],
    });
  });

  it('marks normalized opened content clean when markClean follows setContentNoHistory', () => {
    const normalized = normalizeOpenedMarkdown('hello\n\n');
    useEditorStore.getState().setContentNoHistory(normalized);
    useEditorStore.getState().markClean();

    const state = useEditorStore.getState();
    expect(state.content).toBe('hello');
    expect(state.savedContent).toBe('hello');
    expect(state.isDirty).toBe(false);
  });
});
