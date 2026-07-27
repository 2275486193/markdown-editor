import { describe, it, expect } from 'vitest';
import { handleChar } from '../char';
import type { Block } from '../../types';
import { parseMarkdown } from '../../parser';

describe('handleChar', () => {
  it('caretBlockId=null 返回 null', () => {
    expect(handleChar(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      'a',
    )).toBeNull();
  });

  it('paragraph 中插入字符', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'ab' };
    const patch = handleChar(
      { content: 'ab', blocks: [p], caretBlockId: 'p1', caretOffset: 1, caretLineTarget: 0, caretCell: null },
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
      { content: '#', blocks: [p], caretBlockId: 'p1', caretOffset: 1, caretLineTarget: 0, caretCell: null },
      ' ',
    );
    expect(patch!.newContent).toBe('# ');
    // 速记命中后 reparse 会把 paragraph-1 变成 heading-1,所以用行定位恢复 caret
    expect(patch!.newCaretBlockId).toBeNull();
    expect(patch!.newCaretLineTarget).toBe(1);
    expect(patch!.newCaretOffset).toBe(2);
    expect(patch!.syncActiveOffset).toBe(true);
  });

  it('active heading edits raw markdown marker text', () => {
    const h: Block = { id: 'h1', type: 'heading', level: 1, sourceStartLine: 1, sourceEndLine: 1, markdown: '# Title' };
    const patch = handleChar(
      { content: '# Title', blocks: [h], caretBlockId: 'h1', caretOffset: 0, caretLineTarget: 0, caretCell: null },
      'x',
    );
    expect(patch!.newContent).toBe('x# Title');
    expect(patch!.newCaretOffset).toBe(1);
  });

  it('非 paragraph 块的空格走普通插入', () => {
    const h: Block = { id: 'h1', type: 'heading', level: 1, sourceStartLine: 1, sourceEndLine: 1, markdown: '# Title' };
    const patch = handleChar(
      { content: '# Title', blocks: [h], caretBlockId: 'h1', caretOffset: 7, caretLineTarget: 0, caretCell: null },
      ' ',
    );
    // 速记守卫:非 paragraph 不触发,heading 激活态按 raw markdown offset 编辑。
    expect(patch!.newContent).toBe('# Title ');
    expect(patch!.newCaretBlockId).toBeUndefined();
    expect(patch!.newCaretOffset).toBe(8);
  });

  it('paragraph 普通空格(prefix 不匹配速记)走普通插入', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const patch = handleChar(
      { content: 'foo', blocks: [p], caretBlockId: 'p1', caretOffset: 3, caretLineTarget: 0, caretCell: null },
      ' ',
    );
    // prefix='foo' 不匹配任何 trigger,空格被插入
    expect(patch!.newContent).toBe('foo ');
    expect(patch!.newCaretOffset).toBe(4);
  });

  it('list item paragraph input preserves the list marker', () => {
    const content = '- item\n- ';
    const blocks = parseMarkdown(content);
    const list = blocks[0];
    const item = list.children![1];
    const para = item.children![0];
    const patch = handleChar(
      { content, blocks, caretBlockId: para.id, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      'X',
    );
    expect(patch!.newContent).toBe('- item\n- X');
    expect(patch!.newCaretBlockId).toBeNull();
    expect(patch!.newCaretLineTarget).toBe(2);
    expect(patch!.newCaretOffset).toBe(1);
  });

  it('list item marker-like input can reparse without losing caret line target', () => {
    const content = '- ';
    const blocks = parseMarkdown(content, { deferBareShortcutMarkers: true });
    const para = blocks[0].children![0].children![0];
    const patch = handleChar(
      { content, blocks, caretBlockId: para.id, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      '#',
    );
    expect(patch!.newContent).toBe('- #');
    expect(patch!.newCaretBlockId).toBeNull();
    expect(patch!.newCaretLineTarget).toBe(1);
    expect(patch!.newCaretOffset).toBe(1);
  });

  it('quote marker-like input preserves the quote prefix when space is typed', () => {
    const content = '> #';
    const blocks = parseMarkdown(content, { deferBareShortcutMarkers: true });
    const quote = blocks[0];
    const para = quote.children![0];
    const patch = handleChar(
      { content, blocks, caretBlockId: para.id, caretOffset: 1, caretLineTarget: 0, caretCell: null },
      ' ',
    );
    expect(patch!.newContent).toBe('> # ');
    expect(patch!.newCaretBlockId).toBeNull();
    expect(patch!.newCaretLineTarget).toBe(1);
    expect(patch!.newCaretOffset).toBe(2);
  });

  it('heading inside a list item input preserves the list marker', () => {
    const content = '- # ';
    const blocks = parseMarkdown(content, { deferBareShortcutMarkers: true });
    const heading = blocks[0].children![0].children![0];
    const patch = handleChar(
      { content, blocks, caretBlockId: heading.id, caretOffset: 2, caretLineTarget: 0, caretCell: null },
      'X',
    );
    expect(patch!.newContent).toBe('- # X');
    expect(patch!.newCaretBlockId).toBeNull();
    expect(patch!.newCaretLineTarget).toBe(1);
    expect(patch!.newCaretOffset).toBe(3);
  });

  it('table cell 内字符输入', () => {
    const block: Block = {
      id: 't1', type: 'table', sourceStartLine: 1, sourceEndLine: 3,
      markdown: '| a | b |\n|---|---|\n| 1 | 2 |',
      meta: { cells: [['a', 'b'], ['1', '2']], align: [null, null], rowCount: 2, colCount: 2 },
    };
    const patch = handleChar(
      {
        content: '| a | b |\n|---|---|\n| 1 | 2 |',
        blocks: [block], caretBlockId: 't1', caretOffset: 1,
        caretLineTarget: 0, caretCell: { row: 1, col: 0 },
      },
      'X',
    );
    expect(patch!.newContent).toBe('| a | b |\n|---|---|\n| 1X | 2 |');
    expect(patch!.newCaretOffset).toBe(2);
    expect(patch!.syncActiveOffset).toBe(true);
  });

  it('table 但 caretCell 为 null:不命中 cell 分支(不报错)', () => {
    const block: Block = {
      id: 't1', type: 'table', sourceStartLine: 1, sourceEndLine: 3,
      markdown: '| a | b |\n|---|---|\n| 1 | 2 |',
      meta: { cells: [['a', 'b'], ['1', '2']], align: [null, null], rowCount: 2, colCount: 2 },
    };
    const patch = handleChar(
      {
        content: '| a | b |\n|---|---|\n| 1 | 2 |',
        blocks: [block], caretBlockId: 't1', caretOffset: 0,
        caretLineTarget: 0, caretCell: null,
      },
      'X',
    );
    // 不命中 cell 分支,走 displayText/blockToMarkdown 普通路径,不应抛错
    expect(patch).not.toBeNull();
  });
});
