import { describe, it, expect, beforeEach } from 'vitest';
import { saveCursor, restoreCursor, isComposing } from '../cursor';
import type { CursorState } from '../types';

function createBlockElement(id: string, text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.id = `block-${id}`;
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

function setCaret(el: HTMLElement, offset: number) {
  const range = document.createRange();
  const textNode = el.firstChild as Text;
  range.setStart(textNode, Math.min(offset, textNode.length));
  range.collapse(true);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

describe('saveCursor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when no selection exists', () => {
    createBlockElement('test', 'hello world');
    window.getSelection()?.removeAllRanges();
    const state = saveCursor('test');
    expect(state).toBeNull();
  });

  it('saves cursor position at start of text', () => {
    const el = createBlockElement('test', 'hello');
    setCaret(el, 0);
    const state = saveCursor('test');
    expect(state).not.toBeNull();
    expect(state!.blockId).toBe('test');
    expect(state!.offset).toBe(0);
  });

  it('saves cursor position in middle of text', () => {
    const el = createBlockElement('test', 'hello world');
    setCaret(el, 6);
    const state = saveCursor('test');
    expect(state).not.toBeNull();
    expect(state!.offset).toBe(6);
  });

  it('saves cursor position at end of text', () => {
    const el = createBlockElement('test', 'hi');
    setCaret(el, 2);
    const state = saveCursor('test');
    expect(state!.offset).toBe(2);
  });

  it('returns null when block element not found', () => {
    const el = createBlockElement('exists', 'text');
    setCaret(el, 0);
    const state = saveCursor('nonexistent');
    expect(state).toBeNull();
  });
});

describe('restoreCursor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('restores cursor to saved position', () => {
    const el = createBlockElement('test', 'hello world');
    const state: CursorState = { blockId: 'test', offset: 6 };
    restoreCursor(state);
    const sel = window.getSelection()!;
    expect(sel.rangeCount).toBeGreaterThan(0);
    const range = sel.getRangeAt(0);
    expect(range.collapsed).toBe(true);
    // Read back the restored offset
    const preRange = document.createRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    const offset = preRange.toString().length;
    expect(offset).toBe(6);
  });

  it('restores cursor to start of text', () => {
    createBlockElement('test', 'hello');
    const state: CursorState = { blockId: 'test', offset: 0 };
    restoreCursor(state);
    const sel = window.getSelection()!;
    const range = sel.getRangeAt(0);
    expect(range.startOffset).toBe(0);
  });

  it('does nothing when block element not found', () => {
    const state: CursorState = { blockId: 'ghost', offset: 0 };
    expect(() => restoreCursor(state)).not.toThrow();
  });
});

describe('isComposing', () => {
  it('has a composition flag that is initially false', () => {
    expect(isComposing()).toBe(false);
  });
});
