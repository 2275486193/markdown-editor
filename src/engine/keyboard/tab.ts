// src/engine/keyboard/tab.ts
import type { Handler } from './types';
import {
  displayText,
  blockToMarkdown,
  findBlockRecursive,
  findEnclosingListItem,
  findParentList,
} from '../blocks';
import { syncBlockEdit } from '../sync';
import { handleTableNav } from './table';
import { indentListItem, dedentListItem } from './list-ops';

export const handleTab: Handler = (ctx, event) => {
  if (event.key !== 'Tab') return null;
  if (ctx.caretCell) {
    return handleTableNav(ctx, event);
  }
  if (!ctx.caretBlockId) return { preventDefault: true };

  // ── list (structural):caret 在 listItem 内 paragraph 上 ──
  const enclosingItem = findEnclosingListItem(ctx.blocks, ctx.caretBlockId);
  if (enclosingItem) {
    const parentList = findParentList(ctx.blocks, enclosingItem.id);
    if (!parentList) return { preventDefault: true };
    return event.shiftKey
      ? dedentListItem(ctx, enclosingItem, parentList)
      : indentListItem(ctx, enclosingItem, parentList);
  }

  const block = findBlockRecursive(ctx.blocks, ctx.caretBlockId);
  if (!block) return { preventDefault: true };

  if (block.type === 'code') {
    if (event.shiftKey) return { preventDefault: true };
    const dtext = displayText(block);
    const newText = dtext.slice(0, ctx.caretOffset) + '  ' + dtext.slice(ctx.caretOffset);
    const newMd = blockToMarkdown(newText, block);
    const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newMd);
    if (newContent === ctx.content) return { preventDefault: true };
    return {
      newContent,
      newCaretOffset: ctx.caretOffset + 2,
      syncActiveOffset: true,
      repositionAfter: true,
      preventDefault: true,
    };
  }

  return { preventDefault: true };
};
