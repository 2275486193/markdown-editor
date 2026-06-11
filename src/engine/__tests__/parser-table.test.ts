import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../parser';

describe('table parser', () => {
  it('解析 2x2 表格', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |';
    const blocks = parseMarkdown(md);
    const table = blocks.find((b) => b.type === 'table');
    expect(table).toBeDefined();
    expect(table!.meta?.cells).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(table!.meta?.rowCount).toBe(2);
    expect(table!.meta?.colCount).toBe(2);
  });

  it('解析对齐', () => {
    const md = '| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |';
    const blocks = parseMarkdown(md);
    const table = blocks.find((b) => b.type === 'table');
    expect(table!.meta?.align).toEqual(['left', 'center', 'right']);
  });

  it('cell 内 \\| 转义保留为字面量', () => {
    const md = '| a | b |\n|---|---|\n| x \\| y | z |';
    const blocks = parseMarkdown(md);
    const table = blocks.find((b) => b.type === 'table');
    expect(table!.meta?.cells![1][0]).toBe('x \\| y');
  });
});
