import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SourceMode } from '../SourceMode';
import { useEditorStore } from '../../../stores/editor';

const setValue = vi.fn();
let changeHandler: ((value: string | undefined) => void) | undefined;
let editorValue = 'initial';
let mounted = false;

vi.mock('@monaco-editor/react', () => ({
  default: (props: {
    defaultValue: string;
    onChange?: (value: string | undefined) => void;
    onMount?: (editor: unknown, monaco: unknown) => void;
  }) => {
    changeHandler = (value: string | undefined) => {
      editorValue = value ?? '';
      props.onChange?.(value);
    };
    if (!mounted) {
      mounted = true;
      editorValue = props.defaultValue;
      props.onMount?.(
        {
          getValue: () => editorValue,
          setValue,
          getContentHeight: () => 600,
          onDidContentSizeChange: () => ({ dispose: () => undefined }),
          onDidChangeCursorPosition: () => ({ dispose: () => undefined }),
          onDidChangeCursorSelection: () => ({ dispose: () => undefined }),
          getSelection: () => null,
          getModel: () => ({ getValue: () => editorValue }),
          setPosition: () => undefined,
          revealLineInCenter: () => undefined,
          getTopForLineNumber: () => 0,
        },
        {
          editor: { defineTheme: () => undefined },
          languages: {
            registerCompletionItemProvider: () => ({ dispose: () => undefined }),
            CompletionItemKind: { Snippet: 1 },
            CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
          },
        },
      );
    }
    return <div data-testid="monaco" data-default-value={props.defaultValue} />;
  },
}));

vi.mock('../../../services/heading-nav', () => ({
  registerNavigator: vi.fn(),
  unregisterNavigator: vi.fn(),
}));

describe('SourceMode', () => {
  beforeEach(() => {
    setValue.mockClear();
    changeHandler = undefined;
    editorValue = 'initial';
    mounted = false;
    useEditorStore.setState({
      content: 'initial',
      savedContent: 'initial',
      isDirty: false,
      cursor: null,
      selection: null,
      undoStack: [],
      redoStack: [],
    });
  });

  it('does not call editor.setValue after Monaco onChange updates the store', async () => {
    render(<SourceMode />);

    changeHandler?.('typed');

    await waitFor(() => expect(useEditorStore.getState().content).toBe('typed'));
    expect(setValue).not.toHaveBeenCalled();
  });

  it('does not call editor.setValue for store-driven content changes while mounted', async () => {
    render(<SourceMode />);

    useEditorStore.getState().setContentNoHistory('external');

    await waitFor(() => expect(useEditorStore.getState().content).toBe('external'));
    expect(setValue).not.toHaveBeenCalled();
  });
});
