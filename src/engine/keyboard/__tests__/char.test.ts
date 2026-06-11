import { describe, it, expect } from 'vitest';
import { handleChar } from '../char';
import type { Block } from '../../types';

describe('handleChar', () => {
  it('caretBlockId=null 返回 null', () => {
    expect(handleChar(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0 },
      'a',
    )).toBeNull();
  });

  it('paragraph 中插入字符', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'ab' };
    const patch = handleChar(
      { content: 'ab', blocks: [p], caretBlockId: 'p1', caretOffset: 1, caretLineTarget: 0 },
      'X',
    );
    expect(patch!.newContent).toBe('aXb');
    expect(patch!.newCaretOffset).toBe(2);
    expect(patch!.syncActiveOffset).toBe(true);
    expect(patch!.preventDefault).toBe(false);
  });

  it('paragraph "# " 触发标题速记', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: '#' };
    const patch = handleChar(
      { content: '#', blocks: [p], caretBlockId: 'p1', caretOffset: 1, caretLineTarget: 0 },
      ' ',
    );
    expect(patch!.newContent).toBe('# ');
    // 速记命中后应返回 newCaret 字段
    expect(patch!.newCaretBlockId).toBeDefined();
    expect(patch!.newCaretOffset).toBe(0);
    expect(patch!.syncActiveOffset).toBe(true);
  });

  it('非 paragraph 块的空格走普通插入', () => {
    const h: Block = { id: 'h1', type: 'heading', level: 1, sourceStartLine: 1, sourceEndLine: 1, markdown: '# Title' };
    const patch = handleChar(
      { content: '# Title', blocks: [h], caretBlockId: 'h1', caretOffset: 5, caretLineTarget: 0 },
      ' ',
    );
    // 速记守卫:非 paragraph 不触发,走普通插入。
    // displayText(heading) 剥掉 '# ' 前缀,heading 文本 'Title' 长度 5,
    // caretOffset=5 在末尾,空格插入末尾 → 'Title ' → blockToMarkdown 加回 '# ' → '# Title '
    expect(patch!.newContent).toBe('# Title ');
    expect(patch!.newCaretBlockId).toBeUndefined();
    expect(patch!.newCaretOffset).toBe(6);
  });

  it('paragraph 普通空格(prefix 不匹配速记)走普通插入', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const patch = handleChar(
      { content: 'foo', blocks: [p], caretBlockId: 'p1', caretOffset: 3, caretLineTarget: 0 },
      ' ',
    );
    // prefix='foo' 不匹配任何 trigger,空格被插入
    expect(patch!.newContent).toBe('foo ');
    expect(patch!.newCaretOffset).toBe(4);
  });
});
