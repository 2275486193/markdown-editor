import type { CursorState } from './types';

let composing = false;

export function setComposing(value: boolean): void {
  composing = value;
}

export function isComposing(): boolean {
  return composing;
}

export function saveCursor(blockId: string): CursorState | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const blockEl = document.getElementById(`block-${blockId}`);
  if (!blockEl) return null;

  const preRange = document.createRange();
  preRange.selectNodeContents(blockEl);
  preRange.setEnd(range.startContainer, range.startOffset);
  const offset = preRange.toString().length;

  return { blockId, offset };
}

export function restoreCursor(state: CursorState): void {
  const blockEl = document.getElementById(`block-${state.blockId}`);
  if (!blockEl) return;

  const range = document.createRange();
  let currentOffset = 0;
  let targetNode: Node | null = null;
  let targetOffset = 0;

  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let textNode: Text | null = walker.nextNode() as Text | null;

  while (textNode) {
    const len = textNode.textContent?.length ?? 0;
    if (currentOffset + len >= state.offset) {
      targetNode = textNode;
      targetOffset = state.offset - currentOffset;
      break;
    }
    currentOffset += len;
    textNode = walker.nextNode() as Text | null;
  }

  if (targetNode) {
    range.setStart(targetNode, targetOffset);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}
