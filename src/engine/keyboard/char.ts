// src/engine/keyboard/char.ts
import type { KeyContext, Patch } from './types';
import { applyQuotePrefix, displayText, blockToMarkdown, findBlockRecursive, findEnclosingListItem } from '../blocks';
import { syncBlockEdit, syncCellEdit } from '../sync';
import { tryTrigger } from '../shortcuts';
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

/**
 * 字符输入 handler:由 HiddenTextarea.onChange 调用。
 * 与其它 handler 不同,输入是 text:string 而非 KeyEventData。
 * preventDefault 统一返回 false(dispatch 站不需要阻止原生输入)。
 */
export function handleChar(ctx: KeyContext, text: string): Patch | null {
  if (!ctx.caretBlockId) return null;
  const block = findBlockRecursive(ctx.blocks, ctx.caretBlockId);
  if (!block) return null;

  // Table cell 字符输入(必须在速记触发之前,因为 table 不走 paragraph 速记)
  if (block.type === 'table' && ctx.caretCell) {
    const cells = block.meta?.cells;
    if (!cells) return null;
    const { row, col } = ctx.caretCell;
    const cellText = cells[row]?.[col] ?? '';
    const newCellText = cellText.slice(0, ctx.caretOffset) + text + cellText.slice(ctx.caretOffset);
    const newContent = syncCellEdit(ctx.content, block, row, col, newCellText);
    return {
      newContent,
      newCaretOffset: ctx.caretOffset + text.length,
      syncActiveOffset: true,
      preventDefault: false,
    };
  }

  if (block.type === 'heading') {
    const offset = Math.max(0, Math.min(ctx.caretOffset, block.markdown.length));
    const newMd = block.markdown.slice(0, offset) + text + block.markdown.slice(offset);
    if (findEnclosingListItem(ctx.blocks, block.id)) {
      const newBlocks = structuredClone(ctx.blocks) as Block[];
      if (!updateBlockMarkdown(newBlocks, block.id, newMd)) return { preventDefault: false };
      return {
        newContent: serializeBlocks(newBlocks),
        newCaretBlockId: null,
        newCaretLineTarget: block.sourceStartLine,
        newCaretOffset: offset + text.length,
        syncActiveOffset: true,
        preventDefault: false,
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
        newCaretOffset: offset + text.length,
        syncActiveOffset: true,
        preventDefault: false,
      };
    }
    const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newMd);
    return {
      newContent,
      newCaretOffset: offset + text.length,
      syncActiveOffset: true,
      preventDefault: false,
    };
  }

  // 速记触发分派:仅在 paragraph 上输入空格时尝试匹配
  if (block.type === 'paragraph' && findEnclosingListItem(ctx.blocks, block.id)) {
    const dtext = displayText(block);
    const offset = Math.max(0, Math.min(ctx.caretOffset, dtext.length));
    const newText = dtext.slice(0, offset) + text + dtext.slice(offset);
    const newBlocks = structuredClone(ctx.blocks) as Block[];
    if (!updateBlockMarkdown(newBlocks, block.id, newText)) return { preventDefault: false };
    return {
      newContent: serializeBlocks(newBlocks),
      newCaretBlockId: null,
      newCaretLineTarget: block.sourceStartLine,
      newCaretOffset: offset + text.length,
      syncActiveOffset: true,
      preventDefault: false,
    };
  }

  if (text === ' ' && block.type === 'paragraph' && !block.meta?.quoteDepth) {
    const dtext = displayText(block);
    const prefix = dtext.slice(0, ctx.caretOffset);
    const sp = tryTrigger({
      content: ctx.content,
      block,
      blocks: ctx.blocks,
      paragraphId: block.id,
      lineInBlock: 0,
      prefix,
    });
    if (sp) {
      const patch: Patch = {
        newContent: sp.newContent,
        newCaretOffset: sp.newCaret.offset,
        syncActiveOffset: true,
        preventDefault: false,
      };
      if (sp.newCaretLineTarget !== undefined) {
        patch.newCaretBlockId = null;
        patch.newCaretLineTarget = sp.newCaretLineTarget;
      } else {
        patch.newCaretBlockId = sp.newCaret.blockId;
      }
      return patch;
    }
  }

  // 普通字符插入
  const dtext = displayText(block);
  const newText = dtext.slice(0, ctx.caretOffset) + text + dtext.slice(ctx.caretOffset);
  const newMd = blockToMarkdown(newText, block);
  const newContent = syncBlockEdit(ctx.content, block.sourceStartLine, block.sourceEndLine, newMd);
  if (newContent === ctx.content) {
    return { preventDefault: false };
  }
  if (block.meta?.quoteDepth) {
    return {
      newContent,
      newCaretBlockId: null,
      newCaretLineTarget: block.sourceStartLine,
      newCaretOffset: ctx.caretOffset + text.length,
      syncActiveOffset: true,
      preventDefault: false,
    };
  }
  return {
    newContent,
    newCaretOffset: ctx.caretOffset + text.length,
    syncActiveOffset: true,
    preventDefault: false,
  };
}
