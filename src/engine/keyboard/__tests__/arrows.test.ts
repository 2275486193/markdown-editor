import { describe, it, expect } from 'vitest';
import { handleArrows } from '../arrows';
import type { Block } from '../../types';

const make = (key: string) => ({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false });

describe('handleArrows', () => {
  it('非方向键返回 null', () => {
    expect(handleArrows(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0 },
      make('Enter'),
    )).toBeNull();
  });

  it('ArrowLeft 同 block 内左移', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'abc' };
    const patch = handleArrows(
      { content: 'abc', blocks: [p], caretBlockId: 'p1', caretOffset: 2, caretLineTarget: 0 },
      make('ArrowLeft'),
    );
    expect(patch!.newCaretOffset).toBe(1);
    expect(patch!.syncActiveOffset).toBe(true);
    expect(patch!.repositionAfter).toBe(true);
    expect(patch!.newCaretBlockId).toBeUndefined();
  });

  it('ArrowLeft offset=0 跨块到前 block 末尾', () => {
    const p1: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const p2: Block = { id: 'p2', type: 'paragraph', sourceStartLine: 2, sourceEndLine: 2, markdown: 'bar' };
    const patch = handleArrows(
      { content: 'foo\nbar', blocks: [p1, p2], caretBlockId: 'p2', caretOffset: 0, caretLineTarget: 0 },
      make('ArrowLeft'),
    );
    expect(patch!.newCaretBlockId).toBe('p1');
    expect(patch!.newCaretOffset).toBe(3);
    expect(patch!.syncActiveBlockId).toBe(true);
  });

  it('ArrowRight 同 block 内右移', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'abc' };
    const patch = handleArrows(
      { content: 'abc', blocks: [p], caretBlockId: 'p1', caretOffset: 1, caretLineTarget: 0 },
      make('ArrowRight'),
    );
    expect(patch!.newCaretOffset).toBe(2);
  });

  it('ArrowDown 跨块,列保持 min(offset, nextText.length)', () => {
    const p1: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'longlong' };
    const p2: Block = { id: 'p2', type: 'paragraph', sourceStartLine: 2, sourceEndLine: 2, markdown: 'ab' };
    const patch = handleArrows(
      { content: 'longlong\nab', blocks: [p1, p2], caretBlockId: 'p1', caretOffset: 6, caretLineTarget: 0 },
      make('ArrowDown'),
    );
    expect(patch!.newCaretBlockId).toBe('p2');
    expect(patch!.newCaretOffset).toBe(2); // min(6, len('ab')) = 2
  });

  it('ArrowUp 首块不变', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const patch = handleArrows(
      { content: 'foo', blocks: [p], caretBlockId: 'p1', caretOffset: 2, caretLineTarget: 0 },
      make('ArrowUp'),
    );
    expect(patch).not.toBeNull();
    expect(patch!.newCaretBlockId).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });
});
