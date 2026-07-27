import { describe, it, expect } from 'vitest';
import { syncCellEdit } from '../sync';
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
