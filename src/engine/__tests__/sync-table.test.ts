import { describe, it, expect } from 'vitest';
import { syncCellEdit, addRowAfter, deleteRow, addColumnAfter, deleteColumn, swapTableRow, swapTableColumn } from '../sync';
import type { Block } from '../types';

const tableBlock: Block = {
  id: 't1',
  type: 'table',
  sourceStartLine: 1,
  sourceEndLine: 3,
  markdown: '| a | b |\n|---|---|\n| 1 | 2 |',
  meta: {
    cells: [['a', 'b'], ['1', '2']],
    align: [null, null],
    rowCount: 2,
    colCount: 2,
  },
};

describe('syncCellEdit', () => {
  it('修改 row=1 col=0(数据行第 1 单元格)', () => {
    const content = tableBlock.markdown;
    const result = syncCellEdit(content, tableBlock, 1, 0, 'X');
    expect(result).toBe('| a | b |\n|---|---|\n| X | 2 |');
  });

  it('修改 row=0 col=1(表头第 2 单元格)', () => {
    const content = tableBlock.markdown;
    const result = syncCellEdit(content, tableBlock, 0, 1, 'B');
    expect(result).toBe('| a | B |\n|---|---|\n| 1 | 2 |');
  });

  it('cell 内 \\| 保留为字面量', () => {
    const content = tableBlock.markdown;
    const result = syncCellEdit(content, tableBlock, 1, 0, 'x \\| y');
    expect(result).toBe('| a | b |\n|---|---|\n| x \\| y | 2 |');
  });
});

describe('addRowAfter', () => {
  it('在 row=0(表头)后插入空行', () => {
    const result = addRowAfter(tableBlock.markdown, tableBlock, 0);
    expect(result).toBe('| a | b |\n|---|---|\n|  |  |\n| 1 | 2 |');
  });
});

describe('deleteRow', () => {
  it('删除 row=1(第一数据行)', () => {
    const content = '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';
    const block: Block = { ...tableBlock, sourceEndLine: 4, markdown: content, meta: { ...tableBlock.meta!, cells: [['a','b'],['1','2'],['3','4']], rowCount: 3 } };
    const result = deleteRow(content, block, 1);
    expect(result).toBe('| a | b |\n|---|---|\n| 3 | 4 |');
  });

  it('删除 row=0(表头)是无操作或返回原 content', () => {
    expect(deleteRow(tableBlock.markdown, tableBlock, 0)).toBe(tableBlock.markdown);
  });
});

describe('addColumnAfter', () => {
  it('在 col=0 后插入新列(全行同步加)', () => {
    const result = addColumnAfter(tableBlock.markdown, tableBlock, 0);
    expect(result).toBe('| a |  | b |\n|---|---|---|\n| 1 |  | 2 |');
  });
});

describe('deleteColumn', () => {
  it('删除 col=0', () => {
    const result = deleteColumn(tableBlock.markdown, tableBlock, 0);
    expect(result).toBe('| b |\n|---|\n| 2 |');
  });
});

describe('swapTableRow', () => {
  it('交换两行(数据行)', () => {
    const block: Block = {
      id: 't1', type: 'table', sourceStartLine: 1, sourceEndLine: 4,
      markdown: '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |',
      meta: { cells: [['a','b'],['1','2'],['3','4']], align: [null,null], rowCount: 3, colCount: 2 },
    };
    const out = swapTableRow(block.markdown, block, 1, 2);
    expect(out).toBe('| a | b |\n|---|---|\n| 3 | 4 |\n| 1 | 2 |');
  });
  it('row=0 (表头) 不参与:返回原 content', () => {
    const block: Block = {
      id: 't1', type: 'table', sourceStartLine: 1, sourceEndLine: 4,
      markdown: '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |',
      meta: { cells: [['a','b'],['1','2'],['3','4']], align: [null,null], rowCount: 3, colCount: 2 },
    };
    expect(swapTableRow(block.markdown, block, 0, 1)).toBe(block.markdown);
  });
});

describe('swapTableColumn', () => {
  it('交换两列(包括表头与对齐行)', () => {
    const block: Block = {
      id: 't1', type: 'table', sourceStartLine: 1, sourceEndLine: 3,
      markdown: '| a | b |\n|---|---|\n| 1 | 2 |',
      meta: { cells: [['a','b'],['1','2']], align: [null,null], rowCount: 2, colCount: 2 },
    };
    const out = swapTableColumn(block.markdown, block, 0, 1);
    // 期望表头 a/b 互换,数据行 1/2 互换
    expect(out).toBe('| b | a |\n|---|---|\n| 2 | 1 |');
  });
});
