import { describe, it, expect } from 'vitest';
import { handleEnter } from '../enter';
import type { Block } from '../../types';
import { parseMarkdown } from '../../parser';

const evt = { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

describe('handleEnter', () => {
  it('paragraph 中间分割', () => {
    const blocks: Block[] = [{ id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foobar' }];
    const patch = handleEnter(
      { content: 'foobar', blocks, caretBlockId: 'p1', caretOffset: 3, caretLineTarget: 0, caretCell: null },
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
      { content: '# Title', blocks: [h], caretBlockId: 'h1', caretOffset: 5, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('# Title\n');
  });

  it('caretBlockId=null 不处理', () => {
    expect(handleEnter(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      evt,
    )).toBeNull();
  });

  it('code 块 Enter 软换行', () => {
    const c: Block = { id: 'c1', type: 'code', sourceStartLine: 1, sourceEndLine: 3, markdown: '```\nabc\n```', meta: { language: '' } };
    const patch = handleEnter(
      { content: '```\nabc\n```', blocks: [c], caretBlockId: 'c1', caretOffset: 1, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('```\na\nbc\n```');
    expect(patch!.newCaretBlockId).toBe('c1');
    expect(patch!.newCaretOffset).toBe(2);
  });
});

describe('Enter in list (structural)', () => {
  it('非空末项 Enter → 续同级项', () => {
    const content = '- a\n- b';
    const blocks = parseMarkdown(content);
    const list = blocks.find((b) => b.type === 'list')!;
    const item = list.children![1];
    const para = item.children!.find((c) => c.type === 'paragraph')!;
    const patch = handleEnter(
      { content, blocks, caretBlockId: para.id, caretOffset: 1, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('- a\n- b\n- ');
    expect(patch!.preventDefault).toBe(true);
  });

  it('顶层空项 Enter → 退出列表为 paragraph', () => {
    const content = '- ';
    const blocks = parseMarkdown(content);
    const list = blocks.find((b) => b.type === 'list')!;
    const item = list.children![0];
    // 空项 parser 不生成 paragraph child,caret 落在 listItem 本身
    const caretId = item.children?.find((c) => c.type === 'paragraph')?.id ?? item.id;
    const patch = handleEnter(
      { content, blocks, caretBlockId: caretId, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('');
  });

  it('空嵌套项 Enter → 降级到上一层', () => {
    const content = '- a\n\n  - ';
    const blocks = parseMarkdown(content);
    const list = blocks.find((b) => b.type === 'list')!;
    const topItem = list.children![0];
    const nestedList = topItem.children!.find((c) => c.type === 'list')!;
    const nestedItem = nestedList.children![0];
    const caretId = nestedItem.children?.find((c) => c.type === 'paragraph')?.id ?? nestedItem.id;
    const patch = handleEnter(
      { content, blocks, caretBlockId: caretId, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('- a\n- ');
  });

  it('任务项 Enter 续项默认未勾选', () => {
    const content = '- [x] done';
    const blocks = parseMarkdown(content);
    const list = blocks.find((b) => b.type === 'list')!;
    const item = list.children![0];
    const para = item.children!.find((c) => c.type === 'paragraph')!;
    const patch = handleEnter(
      { content, blocks, caretBlockId: para.id, caretOffset: 4, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('- [x] done\n- [ ] ');
  });

  it('table cell 内 Enter 插 <br>', () => {
    const block: Block = {
      id: 't1', type: 'table', sourceStartLine: 1, sourceEndLine: 3,
      markdown: '| a | b |\n|---|---|\n| 1 | 2 |',
      meta: { cells: [['a','b'],['1','2']], align: [null,null], rowCount: 2, colCount: 2 },
    };
    const patch = handleEnter(
      { content: block.markdown, blocks: [block], caretBlockId: 't1',
        caretOffset: 1, caretLineTarget: 0, caretCell: { row: 1, col: 0 } },
      evt,
    );
    expect(patch!.newContent).toBe('| a | b |\n|---|---|\n| 1<br> | 2 |');
    expect(patch!.newCaretOffset).toBe(5);
  });
});
