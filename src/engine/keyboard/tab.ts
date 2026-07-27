// src/engine/keyboard/tab.ts
import type { Handler } from './types';
import { displayText, blockToMarkdown, findBlockRecursive } from '../blocks';
import { syncBlockEdit } from '../sync';

export const handleTab: Handler = (ctx, event) => {
  if (event.key !== 'Tab') return null;
  if (!ctx.caretBlockId) return { preventDefault: true };
  const block = findBlockRecursive(ctx.blocks, ctx.caretBlockId);
  if (!block || block.type !== 'list') return { preventDefault: true };

  const dtext = displayText(block);
  const lineStart = dtext.lastIndexOf('\n', ctx.caretOffset - 1) + 1;
  const newText = event.shiftKey
    ? dtext.slice(0, lineStart) + dtext.slice(lineStart).replace(/^  /, '')
    : dtext.slice(0, lineStart) + '  ' + dtext.slice(lineStart);
  const newMd = blockToMarkdown(newText, block);
  const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newMd);
  if (newContent === ctx.content) return { preventDefault: true };

  let nextOffset = ctx.caretOffset + (event.shiftKey ? -2 : 2);
  if (nextOffset < lineStart) nextOffset = lineStart;

  return {
    newContent,
    newCaretOffset: nextOffset,
    syncActiveOffset: true,
    repositionAfter: true,
    preventDefault: true,
  };
};
