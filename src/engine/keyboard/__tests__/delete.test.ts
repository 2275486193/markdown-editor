import { describe, it, expect } from 'vitest';
import { handleDelete } from '../delete';
import type { Block } from '../../types';

const evt = { key: 'Delete', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

describe('handleDelete', () => {
  it('caretBlockId=null 返回 null', () => {
    expect(handleDelete(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0 },
      evt,
    )).toBeNull();
  });

  it('paragraph 中段删字符', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'abc' };
    const patch = handleDelete(
      { content: 'abc', blocks: [p], caretBlockId: 'p1', caretOffset: 1, caretLineTarget: 0 },
      evt,
    );
    expect(patch!.newContent).toBe('ac');
    expect(patch!.preventDefault).toBe(true);
  });

  it('paragraph 末尾合并下一段', () => {
    const p1: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const p2: Block = { id: 'p2', type: 'paragraph', sourceStartLine: 2, sourceEndLine: 2, markdown: 'bar' };
    const patch = handleDelete(
      { content: 'foo\nbar', blocks: [p1, p2], caretBlockId: 'p1', caretOffset: 3, caretLineTarget: 0 },
      evt,
    );
    expect(patch!.newContent).toBe('foobar');
  });

  it('末块末尾 Delete 不变', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const patch = handleDelete(
      { content: 'foo', blocks: [p], caretBlockId: 'p1', caretOffset: 3, caretLineTarget: 0 },
      evt,
    );
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });
});
