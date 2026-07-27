// src/engine/shortcuts.ts
import type { Block, BlockType } from './types';

export interface ShortcutCtx {
  content: string;
  block: Block;
  /** 当前行在 block 内的行号(0-based) */
  lineInBlock: number;
  /** 行首到光标的子串,触发器据此匹配 */
  prefix: string;
}

export interface ShortcutPatch {
  /** 新 markdown 内容 */
  newContent: string;
  /** 新 caret(由 hub 应用到 module-level 状态) */
  newCaret: { blockId: string; offset: number };
}

export interface ShortcutTrigger {
  /** 行首到光标位置的正则匹配 */
  pattern: RegExp;
  /** 仅在这些 block type 上触发(未指定则任意 block) */
  blockTypes?: BlockType[];
  apply: (ctx: ShortcutCtx) => ShortcutPatch;
}

export const TRIGGERS: ShortcutTrigger[] = [];

/**
 * 在空格输入时调用。返回 null 表示无触发,调用方按原字符输入流程处理。
 * 返回 ShortcutPatch 表示触发命中,调用方应:
 *   1. setContent(patch.newContent)
 *   2. caretBlockId = patch.newCaret.blockId
 *   3. caretOffset = patch.newCaret.offset
 *   4. 不再把空格写入文本
 */
export function tryTrigger(ctx: ShortcutCtx): ShortcutPatch | null {
  for (const t of TRIGGERS) {
    if (t.blockTypes && !t.blockTypes.includes(ctx.block.type)) continue;
    if (t.pattern.test(ctx.prefix)) return t.apply(ctx);
  }
  return null;
}
