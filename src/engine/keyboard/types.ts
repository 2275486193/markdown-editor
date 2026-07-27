// src/engine/keyboard/types.ts
import type { Block } from '../types';

/** 键盘事件抽象(避免 handler 直接依赖 React 类型) */
export interface KeyEventData {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/** 派发上下文:所有 handler 输入 */
export interface KeyContext {
  /** 当前 markdown(SSOT) */
  content: string;
  /** 解析缓存 */
  blocks: Block[];
  /** 当前 caret block id (可能为 null,handler 应早返回) */
  caretBlockId: string | null;
  /** 当前 caret offset */
  caretOffset: number;
  /** 上下方向键的列保持 */
  caretLineTarget: number;
}

/** Handler 返回的修改集合 */
export interface Patch {
  /** 新 markdown,undefined = 不改 content */
  newContent?: string;
  /** 新 caret blockId(undefined = 不改) */
  newCaretBlockId?: string | null;
  /** 新 caret offset(undefined = 不改) */
  newCaretOffset?: number;
  /** 新 line target(undefined = 不改) */
  newCaretLineTarget?: number;
  /** 是否 preventDefault 浏览器原生行为 */
  preventDefault: boolean;
}

/** Handler 签名: 返回 null 表示不处理(交给浏览器/下游) */
export type Handler = (ctx: KeyContext, event: KeyEventData) => Patch | null;
