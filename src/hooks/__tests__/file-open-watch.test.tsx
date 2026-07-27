import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileOpen } from '../useFileOpen';
import { useFileWatch } from '../useFileWatch';
import { useEditorStore } from '../../stores/editor';

let changeHandler:
  | ((event: { payload: { path: string; content: string } }) => void)
  | null = null;

vi.mock('../../services/tauri-bridge', () => ({
  openFileDialog: vi.fn(),
  readFile: vi.fn(async () => ({ path: 'D:/doc.md', content: 'watched\n\n' })),
  updateRecentFile: vi.fn(async () => undefined),
  startWatch: vi.fn(async () => undefined),
  stopWatch: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (
    eventName: string,
    handler: (event: { payload: { path: string; content: string } }) => void,
  ) => {
    if (eventName === 'file-changed') changeHandler = handler;
    return () => undefined;
  }),
}));

describe('file open and watch normalization', () => {
  beforeEach(() => {
    changeHandler = null;
    useEditorStore.setState({
      content: '',
      savedContent: '',
      isDirty: false,
      filePath: null,
      fileName: null,
      undoStack: [],
      redoStack: [],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  it('normalizes openByPath content before marking clean', async () => {
    const { result } = renderHook(() => useFileOpen());

    await act(async () => {
      await result.current.openByPath('D:/doc.md');
    });

    const state = useEditorStore.getState();
    expect(state.content).toBe('watched');
    expect(state.savedContent).toBe('watched');
    expect(state.isDirty).toBe(false);
  });

  it('normalizes external reload content before marking clean', async () => {
    useEditorStore.setState({ filePath: 'D:/doc.md', isDirty: false });
    renderHook(() => useFileWatch());

    await waitFor(() => expect(changeHandler).not.toBeNull());

    await act(async () => {
      changeHandler?.({ payload: { path: 'D:/doc.md', content: 'external\n\n' } });
    });

    const state = useEditorStore.getState();
    expect(state.content).toBe('external');
    expect(state.savedContent).toBe('external');
    expect(state.isDirty).toBe(false);
  });
});
