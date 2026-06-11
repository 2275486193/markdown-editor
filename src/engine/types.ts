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
  /** 表格列对齐 */
  align?: ('left' | 'center' | 'right' | null)[];
  /** 表格 cells 二维数组(含表头行;不含对齐分隔行) */
  cells?: string[][];
  /** 表格行数(含表头) */
  rowCount?: number;
  /** 表格列数 */
  colCount?: number;
  /** @deprecated 请用 rowCount/colCount */
  rows?: number;
  /** @deprecated 请用 rowCount/colCount */
  cols?: number;
  quoteDepth?: number;
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
