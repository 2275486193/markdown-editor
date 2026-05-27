import { getMarkerOpenLen } from './inline';

export interface CaretPosition {
  blockId: string;
  offset: number;
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

// Click: find which segment was clicked + local offset within that segment
export function segFromPoint(x: number, y: number): CaretPosition | null {
  let blockEl: HTMLElement | null = null;
  let targetNode: Node | null = null;
  let targetOff = 0;

  if ('caretPositionFromPoint' in document) {
    const pos = (document as any).caretPositionFromPoint(x, y) as CaretPos | null;
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
  const seg = el ? findSegSpan(el as HTMLElement) : null;
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
interface CaretPos { offsetNode: Node; offset: number; }

export function caretFromPoint(x: number, y: number): CaretPosition | null {
  if ('caretPositionFromPoint' in document) {
    const pos = (document as any).caretPositionFromPoint(x, y) as CaretPos | null;
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
