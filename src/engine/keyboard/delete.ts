// src/engine/keyboard/delete.ts
import type { Handler } from './types';
import {
  displayText,
  blockToMarkdown,
  findBlockRecursive,
  findParentQuote,
  flattenBlocks,
} from '../blocks';
import { syncBlockEdit } from '../sync';

export const handleDelete: Handler = (ctx) => {
  if (!ctx.caretBlockId) return null;
  const block = findBlockRecursive(ctx.blocks, ctx.caretBlockId);
  if (!block) return null;
  const dtext = displayText(block);

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
