import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WYSIWYGMode } from '../WYSIWYGMode';
import { useBlocksStore } from '../../../stores/blocks';
import { useEditorStore } from '../../../stores/editor';

type TestDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
};

describe('WYSIWYGMode', () => {
  const originalElementFromPoint = document.elementFromPoint;
  const originalCaretPositionFromPoint = (document as TestDocument).caretPositionFromPoint;
  const originalCreateRange = document.createRange;

  beforeEach(() => {
    document.elementFromPoint = originalElementFromPoint;
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: originalCaretPositionFromPoint,
    });
    document.createRange = () => {
      const range = originalCreateRange.call(document);
      return Object.assign(range, {
        getClientRects: () => [{ left: 0, top: 0, height: 16, width: 0 }],
      });
    };

    useEditorStore.setState({
      content: '',
      savedContent: '',
      isDirty: false,
      cursor: null,
      selection: null,
      undoStack: [],
      redoStack: [],
    });
    useBlocksStore.setState({ blocks: [] });
  });

  it('renders whitespace-only content as editable blank paragraphs', async () => {
    useEditorStore.setState({ content: '\n\n', savedContent: '\n\n', isDirty: false });

    const { container } = render(<WYSIWYGMode />);

    expect(screen.queryByText('Empty document')).not.toBeInTheDocument();
    expect(container.querySelector('.wysiwyg-page')).not.toBeNull();

    await waitFor(() => expect(container.querySelectorAll('.md-paragraph')).toHaveLength(2));
  });

  it('renders an empty document as an editable empty paragraph', async () => {
    useEditorStore.setState({ content: '', savedContent: '', isDirty: false });

    const { container } = render(<WYSIWYGMode />);

    expect(screen.queryByText('Empty document')).not.toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('.md-paragraph')).toBeTruthy());
  });

  it('accepts typing # in an empty document without losing caret', async () => {
    useEditorStore.setState({ content: '', savedContent: '', isDirty: false });

    const { container } = render(<WYSIWYGMode />);

    const paragraph = await waitFor(() => {
      const found = container.querySelector<HTMLElement>('.md-paragraph');
      expect(found).toBeTruthy();
      return found!;
    });
    document.elementFromPoint = vi.fn(() => paragraph);
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: vi.fn(() => null),
    });

    fireEvent.click(paragraph, { clientX: 10, clientY: 10 });
    const textarea = await waitFor(() => {
      const found = container.querySelector('textarea');
      expect(found).toBeTruthy();
      return found!;
    });

    fireEvent.input(textarea, { target: { value: '#' } });

    await waitFor(() => expect(useEditorStore.getState().content).toBe('#'));
    await waitFor(() => expect(container.querySelector('[data-caret="true"]')).toBeTruthy());
    expect(container.querySelector('textarea')).toBeTruthy();
  });

  it('keeps caret editable after typing a bare heading marker on an empty paragraph', async () => {
    useEditorStore.setState({ content: '\n', savedContent: '\n', isDirty: false });

    const { container } = render(<WYSIWYGMode />);

    const paragraph = await waitFor(() => {
      const found = container.querySelector<HTMLElement>('.md-paragraph');
      expect(found).toBeTruthy();
      return found!;
    });
    document.elementFromPoint = vi.fn(() => paragraph);
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: vi.fn(() => null),
    });

    fireEvent.click(paragraph, { clientX: 10, clientY: 10 });
    const textarea = await waitFor(() => {
      const found = container.querySelector('textarea');
      expect(found).toBeTruthy();
      return found!;
    });

    fireEvent.input(textarea, { target: { value: '#' } });

    await waitFor(() => expect(useEditorStore.getState().content).toBe('#\n'));
    await waitFor(() => expect(container.querySelector('[data-caret="true"]')).toBeTruthy());
    expect(container.querySelector('textarea')).toBeTruthy();

    fireEvent.input(container.querySelector('textarea')!, { target: { value: ' ' } });
    fireEvent.input(container.querySelector('textarea')!, { target: { value: 'X' } });

    await waitFor(() => expect(useEditorStore.getState().content).toBe('# X\n'));
    await waitFor(() => expect(container.querySelector('[data-caret="true"]')).toBeTruthy());
  });

  it('handles rapid character input before React re-renders blocks', async () => {
    useEditorStore.setState({ content: '\n', savedContent: '\n', isDirty: false });

    const { container } = render(<WYSIWYGMode />);

    const paragraph = await waitFor(() => {
      const found = container.querySelector<HTMLElement>('.md-paragraph');
      expect(found).toBeTruthy();
      return found!;
    });
    document.elementFromPoint = vi.fn(() => paragraph);
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: vi.fn(() => null),
    });

    fireEvent.click(paragraph, { clientX: 10, clientY: 10 });
    const textarea = await waitFor(() => {
      const found = container.querySelector('textarea');
      expect(found).toBeTruthy();
      return found!;
    });

    fireEvent.input(textarea, { target: { value: '#' } });
    fireEvent.input(textarea, { target: { value: ' ' } });
    fireEvent.input(textarea, { target: { value: 'X' } });

    await waitFor(() => expect(useEditorStore.getState().content).toBe('# X\n'));
    await waitFor(() => expect(container.querySelector('[data-caret="true"]')).toBeTruthy());
  });

  it('continues a list item when Enter is pressed after a WYSIWYG click', async () => {
    useEditorStore.setState({ content: '- item', savedContent: '- item', isDirty: false });

    const { container } = render(<WYSIWYGMode />);

    const paragraph = await waitFor(() => {
      const found = Array.from(container.querySelectorAll<HTMLElement>('.md-paragraph'))
        .find((el) => el.textContent === 'item');
      expect(found).toBeTruthy();
      return found!;
    });
    const seg = paragraph.querySelector('[data-seg-start]') as HTMLElement;
    const textNode = seg.querySelector('span')?.firstChild;
    expect(textNode).toBeTruthy();
    document.elementFromPoint = vi.fn(() => seg);
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: vi.fn(() => ({ offsetNode: textNode!, offset: 4 })),
    });

    fireEvent.click(paragraph, { clientX: 10, clientY: 10 });
    const textarea = await waitFor(() => {
      const found = container.querySelector('textarea');
      expect(found).toBeTruthy();
      return found!;
    });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await waitFor(() => expect(useEditorStore.getState().content).toBe('- item\n- '));
    await waitFor(() => expect(container.querySelector('[data-caret="true"]')).toBeTruthy());
  });

  it('types into the empty list item created by Enter', async () => {
    useEditorStore.setState({ content: '- item', savedContent: '- item', isDirty: false });

    const { container } = render(<WYSIWYGMode />);

    const paragraph = await waitFor(() => {
      const found = Array.from(container.querySelectorAll<HTMLElement>('.md-paragraph'))
        .find((el) => el.textContent === 'item');
      expect(found).toBeTruthy();
      return found!;
    });
    const seg = paragraph.querySelector('[data-seg-start]') as HTMLElement;
    const textNode = seg.querySelector('span')?.firstChild;
    expect(textNode).toBeTruthy();
    document.elementFromPoint = vi.fn(() => seg);
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: vi.fn(() => ({ offsetNode: textNode!, offset: 4 })),
    });

    fireEvent.click(paragraph, { clientX: 10, clientY: 10 });
    const textarea = await waitFor(() => {
      const found = container.querySelector('textarea');
      expect(found).toBeTruthy();
      return found!;
    });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    await waitFor(() => expect(useEditorStore.getState().content).toBe('- item\n- '));

    fireEvent.input(textarea, { target: { value: 'X' } });

    await waitFor(() => expect(useEditorStore.getState().content).toBe('- item\n- X'));
  });

  it('makes the hidden textarea available in the same click turn for list items', async () => {
    useEditorStore.setState({ content: '- item', savedContent: '- item', isDirty: false });

    const { container } = render(<WYSIWYGMode />);

    const paragraph = await waitFor(() => {
      const found = Array.from(container.querySelectorAll<HTMLElement>('.md-paragraph'))
        .find((el) => el.textContent === 'item');
      expect(found).toBeTruthy();
      return found!;
    });
    const seg = paragraph.querySelector('[data-seg-start]') as HTMLElement;
    const textNode = seg.querySelector('span')?.firstChild;
    expect(textNode).toBeTruthy();
    document.elementFromPoint = vi.fn(() => seg);
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: vi.fn(() => ({ offsetNode: textNode!, offset: 4 })),
    });

    fireEvent.click(paragraph, { clientX: 10, clientY: 10 });

    expect(container.querySelector('textarea')).toBeTruthy();
  });

  it('continues a quote line when Enter is pressed after a WYSIWYG click', async () => {
    useEditorStore.setState({ content: '> quote', savedContent: '> quote', isDirty: false });

    const { container } = render(<WYSIWYGMode />);

    const paragraph = await waitFor(() => {
      const found = Array.from(container.querySelectorAll<HTMLElement>('.md-paragraph'))
        .find((el) => el.textContent === 'quote');
      expect(found).toBeTruthy();
      return found!;
    });
    const seg = paragraph.querySelector('[data-seg-start]') as HTMLElement;
    const textNode = seg.querySelector('span')?.firstChild;
    expect(textNode).toBeTruthy();
    document.elementFromPoint = vi.fn(() => seg);
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: vi.fn(() => ({ offsetNode: textNode!, offset: 5 })),
    });

    fireEvent.click(paragraph, { clientX: 10, clientY: 10 });
    const textarea = await waitFor(() => {
      const found = container.querySelector('textarea');
      expect(found).toBeTruthy();
      return found!;
    });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await waitFor(() => expect(useEditorStore.getState().content).toBe('> quote\n> '));
    await waitFor(() => {
      const paragraphs = container.querySelectorAll<HTMLElement>('.md-quote .md-paragraph');
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[1].querySelector('[data-caret="true"]')).toBeTruthy();
    });

    fireEvent.input(textarea, { target: { value: 'X' } });

    await waitFor(() => expect(useEditorStore.getState().content).toBe('> quote\n> X'));
  });
});
