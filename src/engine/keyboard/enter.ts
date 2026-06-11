// src/engine/keyboard/enter.ts
import type { Handler } from './types';
import { displayText, blockToMarkdown, applyQuotePrefix, findBlockRecursive } from '../blocks';
import { syncBlockEdit, syncCellEdit } from '../sync';
import { renumberOrderedList } from './list';

const LIST_MARKER_RE = /^(\s*)([-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/;

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

  const dtext = displayText(block);
  const before = dtext.slice(0, ctx.caretOffset);
  const after = dtext.slice(ctx.caretOffset);

  // ── list: continuation / exit / renumber ──
  if (block.type === 'list' && !block.meta?.quoteDepth) {
    const lineInBlock = dtext.slice(0, ctx.caretOffset).split('\n').length - 1;
    const lines = ctx.content.split('\n');
    const lineIdx = block.sourceStartLine - 1 + lineInBlock;
    const orig = lines[lineIdx] ?? '';
    const markerMatch = orig.match(LIST_MARKER_RE);

    if (markerMatch) {
      const indent = markerMatch[1];
      const isTask = !!markerMatch[3];
      const itemContent = orig.slice(markerMatch[0].length);

      if (itemContent === '') {
        // empty item: exit list (top-level) or dedent one level (nested)
        if (indent.length >= 2) {
          lines[lineIdx] = indent.slice(2) + markerMatch[2] + ' ' + (isTask ? '[ ] ' : '');
          const newContent = lines.join('\n');
          if (newContent === ctx.content) return { preventDefault: true };
          return {
            newContent,
            newCaretBlockId: ctx.caretBlockId,
            newCaretOffset: 0,
            preventDefault: true,
          };
        }
        // top-level empty item: exit to paragraph
        lines[lineIdx] = '';
        const newContent = lines.join('\n');
        if (newContent === ctx.content) return { preventDefault: true };
        return {
          newContent,
          newCaretBlockId: null,
          newCaretLineTarget: lineIdx + 1,
          newCaretOffset: 0,
          preventDefault: true,
        };
      }

      // non-empty item: continue with sibling
      const ordered = block.meta?.ordered ?? false;
      let newMarker: string;
      if (ordered) {
        const num = parseInt(markerMatch[2].replace('.', ''), 10);
        newMarker = (num + 1) + '. ';
      } else {
        newMarker = markerMatch[2] + ' ';
      }
      const taskPrefix = isTask ? '[ ] ' : '';
      const newItem = indent + newMarker + taskPrefix;

      lines.splice(lineIdx + 1, 0, newItem);
      let newContent = lines.join('\n');

      if (ordered) {
        newContent = renumberOrderedList(newContent, block.sourceStartLine, block.sourceEndLine + 1);
      }

      if (newContent === ctx.content) return { preventDefault: true };
      return {
        newContent,
        newCaretBlockId: null,
        newCaretLineTarget: lineIdx + 2,
        newCaretOffset: newItem.length,
        preventDefault: true,
      };
    }
  }

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
