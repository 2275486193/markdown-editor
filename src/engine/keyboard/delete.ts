// src/engine/keyboard/delete.ts
import type { Handler } from './types';
import {
  applyQuotePrefix,
  displayText,
  blockToMarkdown,
  findBlockRecursive,
  findEnclosingListItem,
  findParentQuote,
  flattenBlocks,
} from '../blocks';
import { syncBlockEdit, syncCellEdit } from '../sync';
import { serializeBlocks } from '../serialize';
import type { Block } from '../types';

function updateBlockMarkdown(blocks: Block[], blockId: string, markdown: string): boolean {
  for (const block of blocks) {
    if (block.id === blockId) {
      block.markdown = markdown;
      return true;
    }
    if (block.children && updateBlockMarkdown(block.children, blockId, markdown)) return true;
  }
  return false;
}

export const handleDelete: Handler = (ctx) => {
  if (!ctx.caretBlockId) return null;
  const block = findBlockRecursive(ctx.blocks, ctx.caretBlockId);
  if (!block) return null;
  const dtext = displayText(block);

  if (
    ctx.selectionRange &&
    ctx.selectionRange.blockId === ctx.caretBlockId &&
    ctx.selectionRange.end > ctx.selectionRange.start
  ) {
    if (block.type === 'heading') {
      const { start, end } = ctx.selectionRange;
      const rawText = block.markdown.slice(0, start) + block.markdown.slice(end);
      const newText = rawText.trimStart();
      const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newText);
      return {
        newContent,
        newCaretBlockId: null,
        newCaretLineTarget: block.sourceStartLine,
        newCaretOffset: Math.min(start, newText.length),
        syncActiveOffset: true,
        preventDefault: true,
      };
    }
    const { start, end } = ctx.selectionRange;
    const newText = dtext.slice(0, start) + dtext.slice(end);
    const newMd = blockToMarkdown(newText, block);
    const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newMd);
    return {
      newContent,
      newCaretOffset: start,
      syncActiveOffset: true,
      preventDefault: true,
    };
  }

  if (block.type === 'heading' && ctx.caretOffset < block.markdown.length) {
    const offset = Math.max(0, ctx.caretOffset);
    const newMd = block.markdown.slice(0, offset) + block.markdown.slice(offset + 1);
    if (findEnclosingListItem(ctx.blocks, block.id)) {
      const newBlocks = structuredClone(ctx.blocks) as Block[];
      if (!updateBlockMarkdown(newBlocks, block.id, newMd)) return { preventDefault: true };
      return {
        newContent: serializeBlocks(newBlocks),
        newCaretBlockId: null,
        newCaretLineTarget: block.sourceStartLine,
        newCaretOffset: offset,
        syncActiveOffset: true,
        preventDefault: true,
      };
    }
    if (block.meta?.quoteDepth) {
      const newContent = syncBlockEdit(
        ctx.content,
        block.sourceStartLine,
        block.sourceEndLine,
        applyQuotePrefix(newMd, block.meta.quoteDepth),
      );
      return {
        newContent,
        newCaretBlockId: null,
        newCaretLineTarget: block.sourceStartLine,
        newCaretOffset: offset,
        syncActiveOffset: true,
        preventDefault: true,
      };
    }
    const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newMd);
    return {
      newContent,
      newCaretBlockId: null,
      newCaretLineTarget: block.sourceStartLine,
      newCaretOffset: offset,
      syncActiveOffset: true,
      preventDefault: true,
    };
  }

  if (block.type === 'table' && ctx.caretCell) {
    const cells = block.meta?.cells;
    if (!cells) return { preventDefault: true };
    const { row, col } = ctx.caretCell;
    const cellText = cells[row]?.[col] ?? '';
    if (ctx.caretOffset >= cellText.length) return { preventDefault: true };
    const offset = Math.max(0, ctx.caretOffset);
    const newCellText = cellText.slice(0, offset) + cellText.slice(offset + 1);
    return {
      newContent: syncCellEdit(ctx.content, block, row, col, newCellText),
      newCaretCell: { row, col },
      newCaretOffset: offset,
      syncActiveOffset: true,
      preventDefault: true,
    };
  }

  if (ctx.caretOffset < dtext.length) {
    const newText = dtext.slice(0, ctx.caretOffset) + dtext.slice(ctx.caretOffset + 1);
    const newMd = blockToMarkdown(newText, block);
    const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newMd);
    if (newContent === ctx.content) return { preventDefault: true };
    return { newContent, preventDefault: true };
  }

  // Quote child: only merge with next sibling
  if (block.meta?.quoteDepth) {
    const parentQuote = findParentQuote(ctx.blocks, block.id);
    const siblings = parentQuote?.children ?? [];
    const siblingIdx = siblings.findIndex((c) => c.id === block.id);
    if (siblingIdx < 0 || siblingIdx >= siblings.length - 1) return { preventDefault: true };
    const nextSibling = siblings[siblingIdx + 1];
    const nextText = displayText(nextSibling);
    if (dtext === '' && nextText === '') {
      const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, nextSibling.sourceEndLine, '');
      if (newContent === ctx.content) return { preventDefault: true };
      return { newContent, preventDefault: true };
    }
    const merged = dtext + nextText;
    const mergedMd = blockToMarkdown(merged, block);
    const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, nextSibling.sourceEndLine, mergedMd);
    if (newContent === ctx.content) return { preventDefault: true };
    return { newContent, preventDefault: true };
  }

  // At end of block: merge next block into current
  const flat = flattenBlocks(ctx.blocks);
  const idx = flat.findIndex((b) => b.id === ctx.caretBlockId);
  if (idx < 0 || idx >= flat.length - 1) return { preventDefault: true };
  const nextBlock = flat[idx + 1];
  if (nextBlock.meta?.quoteDepth) return { preventDefault: true };
  const nextText = displayText(nextBlock);
  if (dtext === '' && nextText === '') {
    const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, nextBlock.sourceEndLine, '');
    if (newContent === ctx.content) return { preventDefault: true };
    return { newContent, preventDefault: true };
  }
  const merged = dtext + nextText;
  const mergedMd = blockToMarkdown(merged, block);
  const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, nextBlock.sourceEndLine, mergedMd);
  if (newContent === ctx.content) return { preventDefault: true };
  return { newContent, preventDefault: true };
};
