import { getMarkerOpenLen } from './inline';
import type { SelectionRange } from './types';

export interface CaretPosition {
  blockId: string;
  offset: number;
}

interface CaretPos { offsetNode: Node; offset: number; }

interface CaretPointDocument extends Document {
  caretPositionFromPoint?: (x: number, y: number) => CaretPos | null;
}

function findBlockEl(node: Node): HTMLElement | null {
  let el: Node | null = node;
  while (el) {
    if (el instanceof HTMLElement && el.dataset.blockId) return el;
    el = el.parentElement;
  }
  return null;
}

function findSegSpan(el: HTMLElement): HTMLElement | null {
  let e: HTMLElement | null = el;
  while (e) {
    if (e.dataset.segStart !== undefined) return e;
    e = e.parentElement;
  }
  return null;
}

function sourceOffsetFromSelectionNode(node: Node, nodeOffset: number): { blockId: string; offset: number } | null {
  const blockEl = findBlockEl(node);
  if (!blockEl) return null;
  const element = node.nodeType === Node.ELEMENT_NODE
    ? node as HTMLElement
    : node.parentElement;
  if (!element) return { blockId: blockEl.dataset.blockId!, offset: 0 };
  const seg = findSegSpan(element);
  if (!seg) return { blockId: blockEl.dataset.blockId!, offset: nodeOffset };

  let localDom = 0;
  if (node.nodeType === Node.TEXT_NODE) {
    const walker = document.createTreeWalker(seg, NodeFilter.SHOW_TEXT);
    let tn: Text | null = walker.nextNode() as Text | null;
    while (tn) {
      if (tn === node) {
        localDom += nodeOffset;
        break;
      }
      localDom += tn.length;
      tn = walker.nextNode() as Text | null;
    }
  } else {
    localDom = nodeOffset;
  }

  const segStart = Number(seg.dataset.segStart ?? 0);
  const segType = seg.dataset.segType ?? 'text';
  const isRaw = seg.getAttribute('data-seg-raw') === '1';
  const markerOffset = isRaw ? 0 : getMarkerOpenLen(segType);
  return { blockId: blockEl.dataset.blockId!, offset: segStart + markerOffset + localDom };
}

export function selectionRangeFromWindowSelection(): SelectionRange | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const anchor = sourceOffsetFromSelectionNode(selection.anchorNode!, selection.anchorOffset);
  const focus = sourceOffsetFromSelectionNode(selection.focusNode!, selection.focusOffset);
  if (!anchor || !focus || anchor.blockId !== focus.blockId) return null;
  return {
    blockId: anchor.blockId,
    start: Math.min(anchor.offset, focus.offset),
    end: Math.max(anchor.offset, focus.offset),
  };
}

// Click: find which segment was clicked + local offset within that segment
export function segFromPoint(x: number, y: number): CaretPosition | null {
  let blockEl: HTMLElement | null = null;
  let targetNode: Node | null = null;
  let targetOff = 0;

  if ('caretPositionFromPoint' in document) {
    const pos = (document as CaretPointDocument).caretPositionFromPoint?.(x, y) ?? null;
    if (pos) {
      blockEl = findBlockEl(pos.offsetNode);
      targetNode = pos.offsetNode;
      targetOff = pos.offset;
    }
  }
  if (!blockEl) {
    const el = document.elementFromPoint(x, y);
    if (el) blockEl = findBlockEl(el);
  }
  if (!blockEl) return null;

  const el = document.elementFromPoint(x, y);
  let seg = el ? findSegSpan(el as HTMLElement) : null;
  if (!seg && targetNode) {
    const targetElement = targetNode.nodeType === Node.ELEMENT_NODE
      ? targetNode as HTMLElement
      : targetNode.parentElement;
    if (targetElement) seg = findSegSpan(targetElement);
  }
  const segStart = seg ? Number(seg.dataset.segStart) : 0;
  const segType = seg ? (seg.dataset.segType || 'text') : 'text';

  // Compute local DOM offset within the clicked segment
  let localDom = 0;
  if (targetNode && seg) {
    const walker = document.createTreeWalker(seg, NodeFilter.SHOW_TEXT);
    let tn: Text | null = walker.nextNode() as Text | null;
    while (tn) {
      if (tn === targetNode) { localDom += targetOff; break; }
      localDom += tn.length;
      tn = walker.nextNode() as Text | null;
    }
    if (!tn) localDom = 0; // targetNode not in this seg, fallback to start
  }

  // Convert DOM offset within segment to source offset
  const isRaw = seg?.getAttribute('data-seg-raw') === '1';
  const openLen = !isRaw ? getMarkerOpenLen(segType) : 0;

  const offset = segStart + openLen + localDom;
  return { blockId: blockEl.dataset.blockId!, offset };
}

// Cursor pos → pixel: find active segment (data-seg-raw), position within its text
export function pointFromCaret(blockId: string, offset: number): { x: number; y: number } | null {
  const el = document.querySelector(`[data-block-id="${blockId}"]`);
  if (!el) return null;

  // Find the active raw segment containing this offset
  const rawSegs = el.querySelectorAll('[data-seg-raw="1"]');
  for (const rawSeg of rawSegs) {
    const start = Number(rawSeg.getAttribute('data-seg-start')!);
    const end = Number(rawSeg.getAttribute('data-seg-end')!);
    if (offset >= start && offset <= end) {
      const localOff = Math.max(0, offset - start);
      const tn = rawSeg.firstChild;
      if (tn && tn.nodeType === Node.TEXT_NODE) {
        const range = document.createRange();
        range.setStart(tn, Math.min(localOff, (tn as Text).length));
        range.collapse(true);
        const rect = range.getClientRects()[0];
        if (rect) return { x: rect.left, y: rect.top };
      }
      const r = rawSeg.getBoundingClientRect();
      return { x: r.left, y: r.top };
    }
  }

  // Plain text: walk all text nodes
  let remaining = offset;
  let targetNode: Node | null = null;
  let targetOffset = 0;
  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node as Text).length;
      if (remaining <= len) { targetNode = node; targetOffset = remaining; return true; }
      remaining -= len;
    } else {
      for (const child of node.childNodes) { if (walk(child)) return true; }
    }
    return false;
  }
  walk(el);
  if (targetNode) {
    const range = document.createRange();
    range.setStart(targetNode, Math.min(targetOffset, (targetNode as Text).length));
    range.collapse(true);
    const rect = range.getClientRects()[0];
    if (rect) return { x: rect.left, y: rect.top };
  }
  const elRect = el.getBoundingClientRect();
  return { x: elRect.left, y: elRect.top };
}

// Standard caretFromPoint for already-active blocks (raw text, 1:1 mapping)
export function caretFromPoint(x: number, y: number): CaretPosition | null {
  if ('caretPositionFromPoint' in document) {
    const pos = (document as CaretPointDocument).caretPositionFromPoint?.(x, y) ?? null;
    if (pos) {
      const targetNode = pos.offsetNode;
      const targetOffset = pos.offset;
      const blockEl = findBlockEl(targetNode);
      if (blockEl) {
        const blockId = blockEl.dataset.blockId!;
        let offset = 0;
        function walk(node: Node): boolean {
          if (node === targetNode) { offset += targetOffset; return true; }
          if (node.nodeType === Node.TEXT_NODE) { offset += (node as Text).length; return false; }
          for (const child of node.childNodes) { if (walk(child)) return true; }
          return false;
        }
        walk(blockEl);
        return { blockId, offset: Math.min(offset, (blockEl.textContent ?? '').length) };
      }
    }
  }
  const el = document.elementFromPoint(x, y);
  if (el) {
    const blockEl = findBlockEl(el);
    if (blockEl) return { blockId: blockEl.dataset.blockId!, offset: 0 };
  }
  return null;
}

/**
 * 计算指定 cell 内 offset 位置的像素坐标(给 HiddenTextarea 用)。
 */
export function pointFromCell(
  blockId: string,
  row: number,
  col: number,
  offset: number,
): { x: number; y: number; height: number } | null {
  const cellEl = document.querySelector(
    `[data-block-id="${blockId}"] [data-cell-row="${row}"][data-cell-col="${col}"]`,
  );
  if (!cellEl) return null;

  // cell 内可能是 InlineEditable 渲染的 data-seg-raw spans
  const rawSeg = cellEl.querySelector('[data-seg-raw="1"]');
  if (rawSeg && rawSeg.firstChild) {
    const range = document.createRange();
    const textNode = rawSeg.firstChild;
    const len = textNode.textContent?.length ?? 0;
    range.setStart(textNode, Math.min(offset, len));
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    return { x: rect.left, y: rect.top, height: rect.height || 16 };
  }

  // Fallback: cell 包围盒左上
  const r = cellEl.getBoundingClientRect();
  return { x: r.left, y: r.top, height: r.height || 16 };
}

/**
 * 在 (x, y) 找 cell 命中,返回 blockId / row / col / offset。
 */
export function cellFromPoint(
  x: number,
  y: number,
): { blockId: string; row: number; col: number; offset: number } | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const cell = el.closest('[data-cell-row]');
  if (!cell) return null;
  const tableEl = cell.closest('[data-block-id]');
  if (!tableEl) return null;

  const blockId = tableEl.getAttribute('data-block-id')!;
  const row = parseInt(cell.getAttribute('data-cell-row')!, 10);
  const col = parseInt(cell.getAttribute('data-cell-col')!, 10);

  // 在 cell 内通过 caretRangeFromPoint 找字符 offset
  let offset = 0;
  const caretRange = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null })
    .caretRangeFromPoint?.(x, y);
  if (caretRange && cell.contains(caretRange.startContainer)) {
    offset = caretRange.startOffset;
  }
  return { blockId, row, col, offset };
}
