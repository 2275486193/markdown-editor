import { describe, it, expect } from 'vitest';
import { handleTableNav } from '../table';
import type { Block } from '../../types';

const t: Block = {
  id: 't1',
  type: 'table',
  sourceStartLine: 1,
  sourceEndLine: 3,
  markdown: '| a | b |\n|---|---|\n| 1 | 2 |',
  meta: {
    cells: [
      ['a', 'b'],
      ['1', '2'],
    ],
    align: [null, null],
    rowCount: 2,
    colCount: 2,
  },
};

const ctx = (row: number, col: number, offset = 0) => ({
  content: t.markdown,
  blocks: [t],
  caretBlockId: 't1',
  caretOffset: offset,
  caretLineTarget: 0,
  caretCell: { row, col },
});

const ev = (key: string, shift = false) => ({
  key,
  shiftKey: shift,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
});

describe('handleTableNav', () => {
  it('Tab 从 (0,0) → (0,1)', () => {
    const p = handleTableNav(ctx(0, 0), ev('Tab'));
    expect(p!.newCaretCell).toEqual({ row: 0, col: 1 });
  });

  it('Tab 从行末 → 下一行第一', () => {
    const p = handleTableNav(ctx(0, 1), ev('Tab'));
    expect(p!.newCaretCell).toEqual({ row: 1, col: 0 });
  });

  it('Tab 表尾末 cell auto addRowAfter', () => {
    const p = handleTableNav(ctx(1, 1), ev('Tab'));
    expect(p!.newCaretCell).toEqual({ row: 2, col: 0 });
    expect(p!.newContent!.split('\n').length).toBe(t.markdown.split('\n').length + 1);
  });

  it('Shift+Tab 从 (0,1) → (0,0)', () => {
    const p = handleTableNav(ctx(0, 1), ev('Tab', true));
    expect(p!.newCaretCell).toEqual({ row: 0, col: 0 });
  });

  it('↑ 从 (1,0) → (0,0)', () => {
    const p = handleTableNav(ctx(1, 0), ev('ArrowUp'));
    expect(p!.newCaretCell).toEqual({ row: 0, col: 0 });
  });

  it('↑ 从表头出表 → null', () => {
    expect(handleTableNav(ctx(0, 0), ev('ArrowUp'))).toBeNull();
  });

  it('Shift+Tab 行首 → 上行末 cell', () => {
    const p = handleTableNav(ctx(1, 0), ev('Tab', true));
    expect(p!.newCaretCell).toEqual({ row: 0, col: 1 });
  });
});
