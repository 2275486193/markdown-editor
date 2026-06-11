// src/engine/keyboard/enter.ts
import type { Handler } from './types';
import { displayText, blockToMarkdown, applyQuotePrefix, findBlockRecursive } from '../blocks';
import { syncBlockEdit } from '../sync';

export const handleEnter: Handler = (ctx) => {
  if (!ctx.caretBlockId) return null;
  const block = findBlockRecursive(ctx.blocks, ctx.caretBlockId);
  if (!block) return null;

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
