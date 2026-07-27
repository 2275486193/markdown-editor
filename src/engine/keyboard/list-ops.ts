import type { Block } from '../types';
import type { KeyContext, Patch } from './types';
import { serializeBlocksWithLineMap } from '../serialize';

function clone(blocks: Block[]): Block[] {
  return structuredClone(blocks);
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 在树中找到含给定 listItem id 的 list,返回该 list 与 item 在 children 内 idx */
function findItemLoc(blocks: Block[], itemId: string): { list: Block; idx: number } | null {
  for (const b of blocks) {
    if (b.type === 'list' && b.children) {
      const i = b.children.findIndex((c) => c.id === itemId);
      if (i >= 0) return { list: b, idx: i };
    }
    if (b.children) {
      const deep = findItemLoc(b.children, itemId);
      if (deep) return deep;
    }
  }
  return null;
}

/** 在 blocks 树中找含给定 list id 的容器(顶层数组 / 某 listItem 的 children) */
function findListContainer(blocks: Block[], listId: string): { arr: Block[]; idx: number } | null {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === listId) return { arr: blocks, idx: i };
    const ch = blocks[i].children;
    if (ch) {
      const deep = findListContainer(ch, listId);
      if (deep) return deep;
    }
  }
  return null;
}

function buildPatch(newBlocks: Block[], targetItemId: string | null, targetOffset = 0): Patch {
  const { content, lineMap } = serializeBlocksWithLineMap(newBlocks);
  const patch: Patch = {
    newContent: content,
    newCaretBlockId: null,
    newCaretOffset: targetOffset,
    preventDefault: true,
  };
  if (targetItemId) {
    const line = lineMap.get(targetItemId);
    if (line) patch.newCaretLineTarget = line;
  }
  return patch;
}

export function exitListToParagraph(ctx: KeyContext, item: Block, list: Block): Patch {
  const newBlocks = clone(ctx.blocks);
  const listLoc = findListContainer(newBlocks, list.id);
  if (!listLoc) return { preventDefault: true };
  const newList = listLoc.arr[listLoc.idx];
  const itemIdx = newList.children!.findIndex((c) => c.id === item.id);
  if (itemIdx < 0) return { preventDefault: true };
  newList.children!.splice(itemIdx, 1);

  const newPara: Block = {
    id: newId('paragraph'),
    type: 'paragraph',
    sourceStartLine: 1,
    sourceEndLine: 1,
    markdown: '',
  };
  if (newList.children!.length === 0) {
    listLoc.arr.splice(listLoc.idx, 1, newPara);
  } else {
    // 在 list 后插入空白行隔离 + 目标 paragraph,避免被解析为 list 续行
    const blank: Block = {
      id: newId('paragraph'),
      type: 'paragraph',
      sourceStartLine: 1,
      sourceEndLine: 1,
      markdown: '',
    };
    listLoc.arr.splice(listLoc.idx + 1, 0, blank, newPara);
  }
  return buildPatch(newBlocks, newPara.id, 0);
}

export function indentListItem(ctx: KeyContext, item: Block, _parentList: Block): Patch {
  const newBlocks = clone(ctx.blocks);
  const loc = findItemLoc(newBlocks, item.id);
  if (!loc) return { preventDefault: true };
  const { list: pl, idx } = loc;
  if (idx === 0) return { preventDefault: true }; // 首项无前兄弟
  const movedItem = pl.children![idx];
  movedItem.meta = { ...movedItem.meta, indent: (movedItem.meta?.indent ?? 0) + 1 };
  pl.children!.splice(idx, 1);
  const prevSib = pl.children![idx - 1];
  prevSib.children = prevSib.children ?? [];
  const lastChild = prevSib.children[prevSib.children.length - 1];
  if (lastChild?.type === 'list') {
    lastChild.children = [...(lastChild.children ?? []), movedItem];
  } else {
    const childList: Block = {
      id: newId('list'),
      type: 'list',
      sourceStartLine: 1,
      sourceEndLine: 1,
      markdown: '',
      meta: { ordered: pl.meta?.ordered ?? false },
      children: [movedItem],
    };
    prevSib.children.push(childList);
  }
  return buildPatch(newBlocks, movedItem.id, ctx.caretOffset);
}

export function dedentListItem(ctx: KeyContext, item: Block, parentList: Block): Patch {
  const indent = item.meta?.indent ?? 0;
  if (indent <= 0) {
    // 0 缩进 dedent === 退出列表
    return exitListToParagraph(ctx, item, parentList);
  }
  const newBlocks = clone(ctx.blocks);
  const loc = findItemLoc(newBlocks, item.id);
  if (!loc) return { preventDefault: true };
  const { list: innerList, idx } = loc;

  // 把 idx 起所有 children 摘出 (含 movedItem 自己)
  const removed = innerList.children!.splice(idx);
  const movedItem = removed.shift()!;
  const trailing = removed; // 后续 sibling
  movedItem.meta = { ...movedItem.meta, indent: (movedItem.meta?.indent ?? 1) - 1 };

  if (trailing.length > 0) {
    const childList: Block = {
      id: newId('list'),
      type: 'list',
      sourceStartLine: 1,
      sourceEndLine: 1,
      markdown: '',
      meta: { ordered: innerList.meta?.ordered ?? false },
      children: trailing,
    };
    movedItem.children = [...(movedItem.children ?? []), childList];
  }

  // 找到 innerList 在 grandparent listItem 中的位置,把 movedItem 插到 grandparent list 的 idx+1
  function insertMoved(blocks: Block[]): boolean {
    for (const b of blocks) {
      if (b.type === 'list' && b.children) {
        for (let gi = 0; gi < b.children.length; gi++) {
          const gpItem = b.children[gi];
          if (gpItem.type === 'listItem' && gpItem.children?.some((c) => c.id === innerList.id)) {
            b.children.splice(gi + 1, 0, movedItem);
            // 若 innerList 已空,从 gpItem.children 移除
            if (innerList.children!.length === 0) {
              gpItem.children = gpItem.children!.filter((c) => c.id !== innerList.id);
            }
            return true;
          }
        }
      }
      if (b.children && insertMoved(b.children)) return true;
    }
    return false;
  }
  const inserted = insertMoved(newBlocks);
  if (!inserted) return { preventDefault: true };
  return buildPatch(newBlocks, movedItem.id, ctx.caretOffset);
}

export function splitListItem(
  ctx: KeyContext,
  item: Block,
  _list: Block,
  before: string,
  after: string,
): Patch {
  const newBlocks = clone(ctx.blocks);
  const loc = findItemLoc(newBlocks, item.id);
  if (!loc) return { preventDefault: true };
  const { list: pl, idx } = loc;
  const oldItem = pl.children![idx];
  const oldPara = oldItem.children!.find((c) => c.type === 'paragraph');
  if (oldPara) oldPara.markdown = before;

  const newPara: Block = {
    id: newId('paragraph'),
    type: 'paragraph',
    sourceStartLine: 1,
    sourceEndLine: 1,
    markdown: after,
  };
  const newItemMeta: NonNullable<Block['meta']> = {
    indent: oldItem.meta?.indent ?? 0,
    listMarker: oldItem.meta?.listMarker ?? '-',
  };
  if (oldItem.meta?.checked !== undefined) newItemMeta.checked = false;
  const newItem: Block = {
    id: newId('listItem'),
    type: 'listItem',
    sourceStartLine: 1,
    sourceEndLine: 1,
    markdown: '',
    meta: newItemMeta,
    children: [newPara],
  };
  pl.children!.splice(idx + 1, 0, newItem);
  return buildPatch(newBlocks, newItem.id, 0);
}

export function mergeListItemBackward(ctx: KeyContext, item: Block, list: Block): Patch {
  const newBlocks = clone(ctx.blocks);
  const loc = findItemLoc(newBlocks, item.id);
  if (!loc) return { preventDefault: true };
  const { list: pl, idx } = loc;
  if (idx === 0) {
    // 首项 → 退出列表
    return exitListToParagraph(ctx, item, list);
  }
  const cur = pl.children![idx];
  const prev = pl.children![idx - 1];
  const curPara = cur.children!.find((c) => c.type === 'paragraph');
  const prevPara = prev.children!.find((c) => c.type === 'paragraph');
  const prevLen = prevPara?.markdown.length ?? 0;
  if (prevPara && curPara) prevPara.markdown = prevPara.markdown + curPara.markdown;
  // 把 cur 的非 paragraph children(嵌套 list 等)移到 prev
  const tail = cur.children!.filter((c) => c.type !== 'paragraph');
  prev.children = [...(prev.children ?? []), ...tail];
  pl.children!.splice(idx, 1);
  return buildPatch(newBlocks, prev.id, prevLen);
}

export function toggleTaskItem(ctx: KeyContext, itemId: string): Patch {
  const newBlocks = clone(ctx.blocks);
  const loc = findItemLoc(newBlocks, itemId);
  if (!loc) return { preventDefault: true };
  const it = loc.list.children![loc.idx];
  if (it.meta?.checked === undefined) return { preventDefault: true };
  it.meta = { ...it.meta, checked: !it.meta.checked };
  return buildPatch(newBlocks, it.id, 0);
}
