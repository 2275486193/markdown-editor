import { describe, it, expect } from 'vitest';
import { handleBackspace } from '../backspace';
import type { Block } from '../../types';

const evt = { key: 'Backspace', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

describe('handleBackspace', () => {
  it('caretBlockId=null 返回 null', () => {
    expect(handleBackspace(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0 },
      evt,
    )).toBeNull();
  });

  it('paragraph offset>0 同块删字符', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'abc' };
    const patch = handleBackspace(
      { content: 'abc', blocks: [p], caretBlockId: 'p1', caretOffset: 2, caretLineTarget: 0 },
      evt,
    );
    expect(patch!.newContent).toBe('ac');
    expect(patch!.newCaretOffset).toBe(1);
    expect(patch!.syncActiveOffset).toBe(true);
    expect(patch!.preventDefault).toBe(true);
  });

  it('paragraph offset=0 合并到前块', () => {
    const p1: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const p2: Block = { id: 'p2', type: 'paragraph', sourceStartLine: 2, sourceEndLine: 2, markdown: 'bar' };
    const patch = handleBackspace(
      { content: 'foo\nbar', blocks: [p1, p2], caretBlockId: 'p2', caretOffset: 0, caretLineTarget: 0 },
      evt,
    );
    expect(patch!.newContent).toBe('foobar');
    expect(patch!.newCaretLineTarget).toBe(1);
    expect(patch!.newCaretOffset).toBe(3);
    expect(patch!.newCaretBlockId).toBeNull();
  });

  it('heading offset=0 退化为 paragraph(空前段)', () => {
    const empty: Block = { id: 'p0', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: '' };
    const h: Block = { id: 'h1', type: 'heading', level: 2, sourceStartLine: 2, sourceEndLine: 2, markdown: '## hi' };
    const patch = handleBackspace(
      { content: '\n## hi', blocks: [empty, h], caretBlockId: 'h1', caretOffset: 0, caretLineTarget: 0 },
      evt,
    );
    expect(patch!.newContent).toBe('## hi');
    expect(patch!.newCaretLineTarget).toBe(1);
  });

  it('首块且非空,offset=0 不处理(只 preventDefault)', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const patch = handleBackspace(
      { content: 'foo', blocks: [p], caretBlockId: 'p1', caretOffset: 0, caretLineTarget: 0 },
      evt,
    );
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });
});
