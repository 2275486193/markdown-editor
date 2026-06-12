// src/engine/shortcuts.ts
import type { Block, BlockMeta, BlockType } from './types';
import { serializeBlocksWithLineMap } from './serialize';

export interface ShortcutCtx {
  content: string;
  block: Block;
  /** 当前行在 block 内的行号(0-based) */
  lineInBlock: number;
  /** 行首到光标的子串,触发器据此匹配 */
  prefix: string;
  /** 顶层 blocks 数组,list 触发器结构化操作需要 */
  blocks?: Block[];
  /** 触发块的 paragraph id(通常 = block.id,显式分离便于未来嵌套场景) */
  paragraphId?: string;
}

export interface ShortcutPatch {
  /** 新 markdown 内容 */
  newContent: string;
  /** 新 caret(由 hub 应用到 module-level 状态) */
  newCaret: { blockId: string; offset: number };
  /** 当 newCaret.blockId 失效时,改用 line 重定位 */
  newCaretLineTarget?: number;
}

export interface ShortcutTrigger {
  /** 行首到光标位置的正则匹配 */
  pattern: RegExp;
  /** 仅在这些 block type 上触发(未指定则任意 block) */
  blockTypes?: BlockType[];
  apply: (ctx: ShortcutCtx) => ShortcutPatch;
}

function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ParagraphToListOpts {
  ordered: boolean;
  taskChecked?: boolean | undefined;
  listMarker?: '-' | '*' | '+';
}

function paragraphToList(
  blocks: Block[],
  paragraphId: string,
  opts: ParagraphToListOpts,
): { newContent: string; newCaretLineTarget: number } | null {
  const idx = blocks.findIndex((b) => b.id === paragraphId);
  if (idx < 0) return null;
  const newBlocks = structuredClone(blocks);
  const newPara: Block = {
    id: genId('paragraph'),
    type: 'paragraph',
    sourceStartLine: 1,
    sourceEndLine: 1,
    markdown: '',
  };
  const itemMeta: BlockMeta = {
    indent: 0,
  };
  if (!opts.ordered) {
    itemMeta.listMarker = opts.listMarker ?? '-';
  }
  if (opts.taskChecked !== undefined) {
    itemMeta.checked = opts.taskChecked;
  }
  const newItem: Block = {
    id: genId('listItem'),
    type: 'listItem',
    sourceStartLine: 1,
    sourceEndLine: 1,
    markdown: '',
    meta: itemMeta,
    children: [newPara],
  };
  const newList: Block = {
    id: genId('list'),
    type: 'list',
    sourceStartLine: 1,
    sourceEndLine: 1,
    markdown: '',
    meta: { ordered: opts.ordered },
    children: [newItem],
  };
  newBlocks.splice(idx, 1, newList);
  const { content, lineMap } = serializeBlocksWithLineMap(newBlocks);
  return { newContent: content, newCaretLineTarget: lineMap.get(newItem.id) ?? 1 };
}

const headingTrigger: ShortcutTrigger = {
  pattern: /^(#{1,6})$/,
  blockTypes: ['paragraph'],
  apply: (ctx) => {
    const m = ctx.prefix.match(/^(#{1,6})$/)!;
    const hashes = m[1];
    const lines = ctx.content.split('\n');
    const lineIdx = ctx.block.sourceStartLine - 1 + ctx.lineInBlock;
    lines[lineIdx] = `${hashes} `;
    return {
      newContent: lines.join('\n'),
      newCaret: { blockId: ctx.block.id, offset: 0 },
    };
  },
};

const unorderedListTrigger: ShortcutTrigger = {
  pattern: /^([-*+])$/,
  blockTypes: ['paragraph'],
  apply: (ctx) => {
    const marker = ctx.prefix.match(/^([-*+])$/)![1] as '-' | '*' | '+';
    if (ctx.blocks && ctx.paragraphId) {
      const r = paragraphToList(ctx.blocks, ctx.paragraphId, {
        ordered: false,
        listMarker: marker,
      });
      if (r) {
        return {
          newContent: r.newContent,
          newCaret: { blockId: '', offset: 0 },
          newCaretLineTarget: r.newCaretLineTarget,
        };
      }
    }
    // fallback: 字符串路径(无 blocks 上下文时)
    const lines = ctx.content.split('\n');
    const lineIdx = ctx.block.sourceStartLine - 1 + ctx.lineInBlock;
    lines[lineIdx] = `${marker} `;
    return {
      newContent: lines.join('\n'),
      newCaret: { blockId: ctx.block.id, offset: 0 },
    };
  },
};

const orderedListTrigger: ShortcutTrigger = {
  pattern: /^(\d+)\.$/,
  blockTypes: ['paragraph'],
  apply: (ctx) => {
    const num = ctx.prefix.match(/^(\d+)\.$/)![1];
    if (ctx.blocks && ctx.paragraphId) {
      const r = paragraphToList(ctx.blocks, ctx.paragraphId, {
        ordered: true,
      });
      if (r) {
        return {
          newContent: r.newContent,
          newCaret: { blockId: '', offset: 0 },
          newCaretLineTarget: r.newCaretLineTarget,
        };
      }
    }
    // fallback: 字符串路径
    const lines = ctx.content.split('\n');
    const lineIdx = ctx.block.sourceStartLine - 1 + ctx.lineInBlock;
    lines[lineIdx] = `${num}. `;
    return {
      newContent: lines.join('\n'),
      newCaret: { blockId: ctx.block.id, offset: 0 },
    };
  },
};

const quoteTrigger: ShortcutTrigger = {
  pattern: /^>$/,
  blockTypes: ['paragraph'],
  apply: (ctx) => {
    const lines = ctx.content.split('\n');
    const lineIdx = ctx.block.sourceStartLine - 1 + ctx.lineInBlock;
    lines[lineIdx] = '> ';
    return {
      newContent: lines.join('\n'),
      newCaret: { blockId: ctx.block.id, offset: 0 },
    };
  },
};

const taskListUncheckedTrigger: ShortcutTrigger = {
  pattern: /^- \[\s?\]$/,
  blockTypes: ['paragraph'],
  apply: (ctx) => {
    if (ctx.blocks && ctx.paragraphId) {
      const r = paragraphToList(ctx.blocks, ctx.paragraphId, {
        ordered: false,
        listMarker: '-',
        taskChecked: false,
      });
      if (r) {
        return {
          newContent: r.newContent,
          newCaret: { blockId: '', offset: 0 },
          newCaretLineTarget: r.newCaretLineTarget,
        };
      }
    }
    const lines = ctx.content.split('\n');
    const lineIdx = ctx.block.sourceStartLine - 1 + ctx.lineInBlock;
    lines[lineIdx] = '- [ ] ';
    return {
      newContent: lines.join('\n'),
      newCaret: { blockId: ctx.block.id, offset: 0 },
    };
  },
};

const taskListCheckedTrigger: ShortcutTrigger = {
  pattern: /^- \[x\]$/i,
  blockTypes: ['paragraph'],
  apply: (ctx) => {
    if (ctx.blocks && ctx.paragraphId) {
      const r = paragraphToList(ctx.blocks, ctx.paragraphId, {
        ordered: false,
        listMarker: '-',
        taskChecked: true,
      });
      if (r) {
        return {
          newContent: r.newContent,
          newCaret: { blockId: '', offset: 0 },
          newCaretLineTarget: r.newCaretLineTarget,
        };
      }
    }
    const lines = ctx.content.split('\n');
    const lineIdx = ctx.block.sourceStartLine - 1 + ctx.lineInBlock;
    lines[lineIdx] = '- [x] ';
    return {
      newContent: lines.join('\n'),
      newCaret: { blockId: ctx.block.id, offset: 0 },
    };
  },
};

const codeFenceTrigger: ShortcutTrigger = {
  pattern: /^```(\w*)$/,
  blockTypes: ['paragraph'],
  apply: (ctx) => {
    const lang = ctx.prefix.match(/^```(\w*)$/)![1];
    const lines = ctx.content.split('\n');
    const lineIdx = ctx.block.sourceStartLine - 1 + ctx.lineInBlock;
    // 替换当前行为三行: ```lang / 空行 / ```
    lines.splice(lineIdx, 1, '```' + lang, '', '```');
    return {
      newContent: lines.join('\n'),
      newCaret: { blockId: ctx.block.id, offset: 0 },
    };
  },
};

const hrTrigger: ShortcutTrigger = {
  pattern: /^(---|\*\*\*)$/,
  blockTypes: ['paragraph'],
  apply: (ctx) => {
    const marker = ctx.prefix; // --- or ***
    const lines = ctx.content.split('\n');
    const lineIdx = ctx.block.sourceStartLine - 1 + ctx.lineInBlock;
    // 替换为 hr + 空行,caret 移到空行(blockId 此时仍指 paragraph;
    // 调用方触发 setContent 后会重新 parse,blockId 失效——
    // 这是已知限制:水平线触发后下一帧由 reposition 处理 caret)
    lines.splice(lineIdx, 1, marker, '');
    return {
      newContent: lines.join('\n'),
      newCaret: { blockId: ctx.block.id, offset: 0 },
    };
  },
};

export const TRIGGERS: ShortcutTrigger[] = [
  taskListUncheckedTrigger,
  taskListCheckedTrigger,
  headingTrigger,
  unorderedListTrigger,
  orderedListTrigger,
  quoteTrigger,
  codeFenceTrigger,
  hrTrigger,
];

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
