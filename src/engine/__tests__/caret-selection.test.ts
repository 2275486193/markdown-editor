import { afterEach, describe, expect, it } from 'vitest';
import { segFromPoint, selectionRangeFromWindowSelection } from '../caret';

afterEach(() => {
  Object.defineProperty(document, 'caretPositionFromPoint', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: undefined,
  });
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

describe('selectionRangeFromWindowSelection', () => {
  it('maps a plain text selection inside one block to source offsets', () => {
    document.body.innerHTML = `
      <div data-block-id="p1">
        <span data-seg-start="0" data-seg-end="11" data-seg-type="text">hello world</span>
      </div>
    `;
    const text = document.querySelector('[data-seg-type="text"]')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 11);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(selectionRangeFromWindowSelection()).toEqual({
      blockId: 'p1',
      start: 6,
      end: 11,
    });
  });

  it('maps a styled segment selection to source offsets including opening markers', () => {
    document.body.innerHTML = `
      <div data-block-id="p1">
        <span data-seg-start="0" data-seg-end="6" data-seg-type="text">hello </span>
        <span data-seg-start="6" data-seg-end="15" data-seg-type="strong"><strong>world</strong></span>
      </div>
    `;
    const text = document.querySelector('strong')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(selectionRangeFromWindowSelection()).toEqual({
      blockId: 'p1',
      start: 8,
      end: 13,
    });
  });
});

describe('segFromPoint', () => {
  it('maps code block clicks to code-body offsets', () => {
    document.body.innerHTML = `
      <div data-block-id="c1">
        <pre class="md-code-pre"><code><span data-seg-start="0" data-seg-end="3" data-seg-type="text">abc</span></code></pre>
      </div>
    `;
    const seg = document.querySelector('[data-seg-type="text"]') as HTMLElement;
    const text = seg.firstChild!;
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: () => ({ offsetNode: text, offset: 2 }),
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => seg,
    });

    expect(segFromPoint(10, 10)).toEqual({ blockId: 'c1', offset: 2 });
  });

  it('uses caretPositionFromPoint segment when clicking trailing block whitespace', () => {
    document.body.innerHTML = `
      <div data-block-id="p1">
        <span data-seg-start="0" data-seg-end="4" data-seg-type="text"><span>item</span></span>
      </div>
    `;
    const block = document.querySelector('[data-block-id="p1"]') as HTMLElement;
    const text = document.querySelector('[data-seg-type="text"] span')!.firstChild!;
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: () => ({ offsetNode: text, offset: 4 }),
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => block,
    });

    expect(segFromPoint(10, 10)).toEqual({ blockId: 'p1', offset: 4 });
  });
});
