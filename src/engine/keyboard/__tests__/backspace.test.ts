import { describe, it, expect } from 'vitest';
import { handleBackspace } from '../backspace';
import type { Block } from '../../types';
import { parseMarkdown } from '../../parser';

const evt = { key: 'Backspace', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

describe('handleBackspace', () => {
  it('caretBlockId=null 返回 null', () => {
    expect(handleBackspace(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      evt,
    )).toBeNull();
  });

  it('paragraph offset>0 同块删字符', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'abc' };
    const patch = handleBackspace(
      { content: 'abc', blocks: [p], caretBlockId: 'p1', caretOffset: 2, caretLineTarget: 0, caretCell: null },
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
      { content: 'foo\nbar', blocks: [p1, p2], caretBlockId: 'p2', caretOffset: 0, caretLineTarget: 0, caretCell: null },
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
      { content: '\n## hi', blocks: [empty, h], caretBlockId: 'h1', caretOffset: 0, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('## hi');
    expect(patch!.newCaretLineTarget).toBe(1);
  });

  it('首块且非空,offset=0 不处理(只 preventDefault)', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const patch = handleBackspace(
      { content: 'foo', blocks: [p], caretBlockId: 'p1', caretOffset: 0, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });

  it('表格 (0,0) 行首 Backspace 删除整表', () => {
    const para: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const t: Block = {
      id: 't1', type: 'table', sourceStartLine: 2, sourceEndLine: 4,
      markdown: '| a |\n|---|\n| 1 |',
      meta: { cells: [['a'], ['1']], align: [null], rowCount: 2, colCount: 1 },
    };
    const before = 'foo\n| a |\n|---|\n| 1 |';
    const patch = handleBackspace(
      { content: before, blocks: [para, t], caretBlockId: 't1', caretOffset: 0, caretLineTarget: 0, caretCell: { row: 0, col: 0 } },
      evt,
    );
    expect(patch!.newContent).toBe('foo');
    expect(patch!.newCaretBlockId).toBeNull();
    expect(patch!.newCaretCell).toBeNull();
  });

  it('表格非 (0,0) 不触发整表删除', () => {
    const t: Block = {
      id: 't1', type: 'table', sourceStartLine: 1, sourceEndLine: 3,
      markdown: '| a | b |\n|---|---|\n| 1 | 2 |',
      meta: { cells: [['a', 'b'], ['1', '2']], align: [null, null], rowCount: 2, colCount: 2 },
    };
    const patch = handleBackspace(
      { content: t.markdown, blocks: [t], caretBlockId: 't1', caretOffset: 0, caretLineTarget: 0, caretCell: { row: 0, col: 1 } },
      evt,
    );
    // (0,1) 不命中删表分支;走默认 backspace caretOffset=0 路径(首块非空 → preventDefault, newContent undefined)
    expect(patch!.newContent).toBeUndefined();
  });
});

describe('handleBackspace list (structural)', () => {
  it('非首项行首 Backspace 合并到前 sibling', () => {
    const content = '- foo\n- bar';
    const blocks = parseMarkdown(content);
    const list = blocks.find((b) => b.type === 'list')!;
    const item = list.children![1];
    const para = item.children!.find((c) => c.type === 'paragraph')!;
    const patch = handleBackspace(
      { content, blocks, caretBlockId: para.id, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('- foobar');
    expect(patch!.newCaretOffset).toBe(3);
  });

  it('顶层空项行首 Backspace → 退出列表', () => {
    const content = '- ';
    const blocks = parseMarkdown(content);
    const list = blocks.find((b) => b.type === 'list')!;
    const item = list.children![0];
    // 空 listItem 没有 paragraph child,caret 落 listItem 自身
    const caretId = item.children?.find((c) => c.type === 'paragraph')?.id ?? item.id;
    const patch = handleBackspace(
      { content, blocks, caretBlockId: caretId, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('');
  });

  it('嵌套空项行首 Backspace → 降级', () => {
    const content = '- a\n\n  - ';
    const blocks = parseMarkdown(content);
    const list = blocks.find((b) => b.type === 'list')!;
    const topItem = list.children![0];
    const nestedList = topItem.children!.find((c) => c.type === 'list')!;
    const nestedItem = nestedList.children![0];
    const caretId = nestedItem.children?.find((c) => c.type === 'paragraph')?.id ?? nestedItem.id;
    const patch = handleBackspace(
      { content, blocks, caretBlockId: caretId, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('- a\n- ');
  });
});
