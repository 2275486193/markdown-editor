// src/engine/keyboard/table.ts
import type { KeyContext, Patch, KeyEventData } from './types';
import { findBlockRecursive } from '../blocks';
import { addRowAfter } from '../sync';

export function handleTableNav(ctx: KeyContext, event: KeyEventData): Patch | null {
  if (!ctx.caretBlockId || !ctx.caretCell) return null;
  const block = findBlockRecursive(ctx.blocks, ctx.caretBlockId);
  if (!block || block.type !== 'table') return null;

  const cells = block.meta?.cells;
  if (!cells) return null;
  const rowCount = cells.length;
  const colCount = cells[0]?.length ?? 0;
  const { row, col } = ctx.caretCell;

  if (event.key === 'Tab' && !event.shiftKey) {
    if (col + 1 < colCount) {
      return {
        newCaretCell: { row, col: col + 1 },
        newCaretOffset: 0,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    if (row + 1 < rowCount) {
      return {
        newCaretCell: { row: row + 1, col: 0 },
        newCaretOffset: 0,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    // 表尾末 cell:auto addRowAfter
    const newContent = addRowAfter(ctx.content, block, row);
    return {
      newContent,
      newCaretCell: { row: row + 1, col: 0 },
      newCaretOffset: 0,
      syncActiveOffset: true,
      repositionAfter: true,
      preventDefault: true,
    };
  }
  if (event.key === 'Tab' && event.shiftKey) {
    if (col > 0) {
      return {
        newCaretCell: { row, col: col - 1 },
        newCaretOffset: 0,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    if (row > 0) {
      return {
        newCaretCell: { row: row - 1, col: colCount - 1 },
        newCaretOffset: 0,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    return { preventDefault: true };
  }
  if (event.key === 'ArrowUp') {
    if (row > 0) {
      return {
        newCaretCell: { row: row - 1, col },
        newCaretOffset: 0,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    return null; // 出表,交给上层 arrows.ts
  }
  if (event.key === 'ArrowDown') {
    if (row + 1 < rowCount) {
      return {
        newCaretCell: { row: row + 1, col },
        newCaretOffset: 0,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    return null; // 出表
  }
  if (event.key === 'ArrowLeft') {
    if (ctx.caretOffset > 0) return null; // 由 arrows.ts 默认 char-level
    if (col > 0) {
      const prevText = cells[row]?.[col - 1] ?? '';
      return {
        newCaretCell: { row, col: col - 1 },
        newCaretOffset: prevText.length,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    return null;
  }
  if (event.key === 'ArrowRight') {
    const cellText = cells[row]?.[col] ?? '';
    if (ctx.caretOffset < cellText.length) return null;
    if (col + 1 < colCount) {
      return {
        newCaretCell: { row, col: col + 1 },
        newCaretOffset: 0,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    return null;
  }
  return null;
}
