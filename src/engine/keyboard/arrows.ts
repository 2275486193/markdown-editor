// src/engine/keyboard/arrows.ts
import type { Handler } from './types';
import { displayText, findBlockRecursive, getNavigableBlocks } from '../blocks';
import { handleTableNav } from './table';

export const handleArrows: Handler = (ctx, event) => {
  const key = event.key;
  if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') {
    return null;
  }

  if (ctx.caretCell) {
    const tablePatch = handleTableNav(ctx, event);
    if (tablePatch) return tablePatch;
    // null fallback: 走原 arrows 默认逻辑
    // ArrowLeft/Right cell 内 caret 中段 → 字符级位移
    // ArrowUp/Down 出表 → 默认跨块跳出
  }

  if (key === 'ArrowLeft') {
    if (ctx.caretOffset > 0) {
      return {
        newCaretOffset: ctx.caretOffset - 1,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    const nav = getNavigableBlocks(ctx.blocks);
    const idx = nav.findIndex((b) => b.id === ctx.caretBlockId);
    if (idx > 0) {
      const prev = nav[idx - 1];
      return {
        newCaretBlockId: prev.id,
        newCaretOffset: displayText(prev).length,
        syncActiveBlockId: true,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    return { preventDefault: true };
  }

  if (key === 'ArrowRight') {
    if (!ctx.caretBlockId) return { preventDefault: true };
    const block = findBlockRecursive(ctx.blocks, ctx.caretBlockId);
    if (!block) return { preventDefault: true };
    const max = displayText(block).length;
    if (ctx.caretOffset < max) {
      return {
        newCaretOffset: ctx.caretOffset + 1,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    const nav = getNavigableBlocks(ctx.blocks);
    const idx = nav.findIndex((b) => b.id === ctx.caretBlockId);
    if (idx >= 0 && idx < nav.length - 1) {
      const next = nav[idx + 1];
      return {
        newCaretBlockId: next.id,
        newCaretOffset: 0,
        syncActiveBlockId: true,
        syncActiveOffset: true,
        repositionAfter: true,
        preventDefault: true,
      };
    }
    return { preventDefault: true };
  }

  // ArrowUp / ArrowDown
  if (!ctx.caretBlockId) return { preventDefault: true };
  const nav = getNavigableBlocks(ctx.blocks);
  const idx = nav.findIndex((b) => b.id === ctx.caretBlockId);
  const nextIdx = key === 'ArrowUp' ? idx - 1 : idx + 1;
  if (nextIdx < 0 || nextIdx >= nav.length) return { preventDefault: true };
  const nextBlock = nav[nextIdx];
  return {
    newCaretBlockId: nextBlock.id,
    newCaretOffset: Math.min(ctx.caretOffset, displayText(nextBlock).length),
    syncActiveBlockId: true,
    syncActiveOffset: true,
    repositionAfter: true,
    preventDefault: true,
  };
};
