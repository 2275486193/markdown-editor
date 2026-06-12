// src/engine/keyboard/char.ts
import type { KeyContext, Patch } from './types';
import { displayText, blockToMarkdown, findBlockRecursive } from '../blocks';
import { syncBlockEdit, syncCellEdit } from '../sync';
import { tryTrigger } from '../shortcuts';

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

  // 速记触发分派:仅在 paragraph 上输入空格时尝试匹配
  if (text === ' ' && block.type === 'paragraph') {
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
  return {
    newContent,
    newCaretOffset: ctx.caretOffset + text.length,
    syncActiveOffset: true,
    preventDefault: false,
  };
}
