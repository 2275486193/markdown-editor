import { describe, it, expect } from 'vitest';
import { handleEnter } from '../enter';
import type { Block } from '../../types';

const evt = { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

describe('handleEnter', () => {
  it('paragraph 中间分割', () => {
    const blocks: Block[] = [{ id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foobar' }];
    const patch = handleEnter(
      { content: 'foobar', blocks, caretBlockId: 'p1', caretOffset: 3, caretLineTarget: 0 },
      evt,
    );
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBe('foo\nbar');
    expect(patch!.newCaretLineTarget).toBe(2);
    expect(patch!.newCaretOffset).toBe(0);
    expect(patch!.preventDefault).toBe(true);
  });

  it('heading 末尾 Enter → 下一行 paragraph', () => {
    const h: Block = { id: 'h1', type: 'heading', level: 1, sourceStartLine: 1, sourceEndLine: 1, markdown: '# Title' };
    const patch = handleEnter(
      { content: '# Title', blocks: [h], caretBlockId: 'h1', caretOffset: 5, caretLineTarget: 0 },
      evt,
    );
    expect(patch!.newContent).toBe('# Title\n');
  });

  it('caretBlockId=null 不处理', () => {
    expect(handleEnter(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0 },
      evt,
    )).toBeNull();
  });

  it('code 块 Enter 软换行', () => {
    const c: Block = { id: 'c1', type: 'code', sourceStartLine: 1, sourceEndLine: 3, markdown: '```\nabc\n```', meta: { language: '' } };
    const patch = handleEnter(
      { content: '```\nabc\n```', blocks: [c], caretBlockId: 'c1', caretOffset: 1, caretLineTarget: 0 },
      evt,
    );
    expect(patch!.newContent).toBe('```\na\nbc\n```');
    expect(patch!.newCaretBlockId).toBe('c1');
    expect(patch!.newCaretOffset).toBe(2);
  });
});
