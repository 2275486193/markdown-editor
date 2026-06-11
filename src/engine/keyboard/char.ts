// src/engine/keyboard/char.ts
import type { KeyContext, Patch } from './types';
import { displayText, blockToMarkdown, findBlockRecursive } from '../blocks';
import { syncBlockEdit } from '../sync';
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

  // 速记触发分派:仅在 paragraph 上输入空格时尝试匹配
  if (text === ' ' && block.type === 'paragraph') {
    const dtext = displayText(block);
    const prefix = dtext.slice(0, ctx.caretOffset);
    const sp = tryTrigger({ content: ctx.content, block, lineInBlock: 0, prefix });
    if (sp) {
      return {
        newContent: sp.newContent,
        newCaretBlockId: sp.newCaret.blockId,
        newCaretOffset: sp.newCaret.offset,
        syncActiveOffset: true,
        preventDefault: false,
      };
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
