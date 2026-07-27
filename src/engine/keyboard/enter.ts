// src/engine/keyboard/enter.ts
import type { Handler } from './types';
import { displayText, blockToMarkdown, applyQuotePrefix, findBlockRecursive, findEnclosingListItem, findParentList } from '../blocks';
import { syncBlockEdit, syncCellEdit } from '../sync';
import { exitListToParagraph, dedentListItem, splitListItem } from './list-ops';

export const handleEnter: Handler = (ctx) => {
  if (!ctx.caretBlockId) return null;
  const block = findBlockRecursive(ctx.blocks, ctx.caretBlockId);
  if (!block) return null;

  // table cell:Enter = 插 <br> 软换行(不出 cell)
  if (block.type === 'table' && ctx.caretCell) {
    const cells = block.meta?.cells;
    if (!cells) return { preventDefault: true };
    const { row, col } = ctx.caretCell;
    const cellText = cells[row]?.[col] ?? '';
    const newCellText = cellText.slice(0, ctx.caretOffset) + '<br>' + cellText.slice(ctx.caretOffset);
    const newContent = syncCellEdit(ctx.content, block, row, col, newCellText);
    return {
      newContent,
      newCaretOffset: ctx.caretOffset + 4,
      syncActiveOffset: true,
      preventDefault: true,
    };
  }

  // ── list (structural):caret 在 listItem 内的 paragraph 上(或空项落在 listItem 本身) ──
  const enclosingItem = findEnclosingListItem(ctx.blocks, ctx.caretBlockId);
  if (enclosingItem) {
    const parentList = findParentList(ctx.blocks, enclosingItem.id);
    if (!parentList) return { preventDefault: true };
    const itemText = displayText(enclosingItem);
    const before = itemText.slice(0, ctx.caretOffset);
    const after = itemText.slice(ctx.caretOffset);
    const indent = enclosingItem.meta?.indent ?? 0;
    if (itemText === '') {
      return indent > 0
        ? dedentListItem(ctx, enclosingItem, parentList)
        : exitListToParagraph(ctx, enclosingItem, parentList);
    }
    return splitListItem(ctx, enclosingItem, parentList, before, after);
  }

  const dtext = displayText(block);
  const before = dtext.slice(0, ctx.caretOffset);
  const after = dtext.slice(ctx.caretOffset);

  // ── quote child: exit or split within quote ──
  if (block.meta?.quoteDepth) {
    const qd = block.meta.quoteDepth;

    if (dtext === '') {
      const newMd = qd > 1 ? applyQuotePrefix('', qd - 1) : '';
      let newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newMd);
      if (!newContent.trim()) newContent = '​';
      if (newContent === ctx.content) return { preventDefault: true };
      return {
        newContent,
        newCaretLineTarget: block.sourceStartLine,
        newCaretOffset: 0,
        newCaretBlockId: null,
        preventDefault: true,
      };
    }

    const newMd = after
      ? applyQuotePrefix(before, qd) + '\n' + applyQuotePrefix(after, qd)
      : applyQuotePrefix(before, qd) + '\n' + applyQuotePrefix('', qd);
    const targetLine = block.sourceStartLine + 1;
    const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newMd);
    if (newContent === ctx.content) return { preventDefault: true };
    return {
      newContent,
      newCaretLineTarget: targetLine,
      newCaretOffset: 0,
      newCaretBlockId: null,
      preventDefault: true,
    };
  }

  // ── top-level blocks ──
  let newMd: string;
  let targetLine: number;
  let nextOffset = 0;

  if (block.type === 'code') {
    newMd = blockToMarkdown(before + '\n' + after, block);
    targetLine = block.sourceStartLine;
    nextOffset = ctx.caretOffset + 1;
  } else if (block.type === 'heading') {
    newMd = blockToMarkdown(before, block) + '\n' + after;
    targetLine = block.sourceStartLine + 1;
  } else {
    newMd = before + '\n' + after;
    targetLine = block.sourceStartLine + 1;
  }

  const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newMd);
  if (newContent === ctx.content) return { preventDefault: true };

  // code: 保留原 caretLineTarget(不修改),caretBlockId 改为 block.id
  if (block.type === 'code') {
    return {
      newContent,
      newCaretOffset: nextOffset,
      newCaretBlockId: block.id,
      preventDefault: true,
    };
  }

  // heading / paragraph / 其它: 更新 caretLineTarget,清空 caretBlockId
  return {
    newContent,
    newCaretLineTarget: targetLine,
    newCaretOffset: 0,
    newCaretBlockId: null,
    preventDefault: true,
  };
};
