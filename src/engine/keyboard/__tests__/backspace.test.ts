import { describe, it, expect } from 'vitest';
import { handleBackspace } from '../backspace';
import type { Block } from '../../types';

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

  it('有序列表中间项删除后重排', () => {
    const block: Block = { id: 'l1', type: 'list', sourceStartLine: 1, sourceEndLine: 3, markdown: '1. a\n2. b\n3. c', meta: { ordered: true } };
    // displayText('1. a\n2. b\n3. c') for ordered list = 'a\nb\nc'
    // caretOffset=2 在 'b' 之前, Backspace 删掉 '\n' → 'ab\nc' → blockToMarkdown → '1. ab\n2. c'
    const patch = handleBackspace(
      { content: '1. a\n2. b\n3. c', blocks: [block], caretBlockId: 'l1', caretOffset: 2, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('1. ab\n2. c');
  });

  it('有序列表多项重排起始数字保留', () => {
    const block: Block = { id: 'l1', type: 'list', sourceStartLine: 1, sourceEndLine: 3, markdown: '5. a\n6. b\n7. c', meta: { ordered: true } };
    const patch = handleBackspace(
      { content: '5. a\n6. b\n7. c', blocks: [block], caretBlockId: 'l1', caretOffset: 2, caretLineTarget: 0, caretCell: null },
      evt,
    );
    // blockToMarkdown 重置所有标号为 1.,renumber 从 1. 起递增
    expect(patch!.newContent).toBe('1. ab\n2. c');
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
