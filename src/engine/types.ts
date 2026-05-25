export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'code'
  | 'quote'
  | 'list'
  | 'table'
  | 'hr'
  | 'html';

export interface BlockMeta {
  language?: string;
  ordered?: boolean;
  checked?: boolean;
  header?: boolean;
  align?: string[];
  rows?: number;
  cols?: number;
}

export interface Block {
  id: string;
  type: BlockType;
  level?: number;
  sourceStartLine: number;
  sourceEndLine: number;
  markdown: string;
  children?: Block[];
  meta?: BlockMeta;
}

export interface CursorState {
  blockId: string;
  offset: number;
  anchorBlockId?: string;
  anchorOffset?: number;
}
