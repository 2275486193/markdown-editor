import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineEditable, parseInline, renderedOffsetToSource } from '../inline';

describe('inline HTML rendering', () => {
  it('renders whitelisted kbd and mark tags as semantic elements', () => {
    const { container } = render(
      <InlineEditable
        text="<kbd>Ctrl</kbd> + <kbd>S</kbd> 保存 <mark>高亮文本</mark>"
        offset={-1}
        isActive={false}
      />,
    );

    const kbd = container.querySelectorAll('kbd');
    expect(kbd).toHaveLength(2);
    expect(kbd[0].textContent).toBe('Ctrl');
    expect(kbd[1].textContent).toBe('S');

    const mark = container.querySelector('mark');
    expect(mark?.textContent).toBe('高亮文本');
  });

  it('keeps unknown inline HTML escaped as text', () => {
    const { container } = render(
      <InlineEditable text="<span>raw</span>" offset={-1} isActive={false} />,
    );

    expect(container.querySelector('span[data-seg-type="text"]')?.textContent).toBe('<span>raw</span>');
    expect(container.querySelector('kbd')).toBeNull();
    expect(container.querySelector('mark')).toBeNull();
    expect(container.querySelector('[data-seg-type="html_kbd"]')).toBeNull();
    expect(container.querySelector('[data-seg-type="html_mark"]')).toBeNull();
  });

  it('preserves raw HTML source while editing a whitelisted segment', () => {
    const source = '<kbd>Ctrl</kbd> + <mark>高亮文本</mark>';
    const { container } = render(
      <InlineEditable text={source} offset={1} isActive={true} />,
    );

    const raw = container.querySelector('[data-seg-raw="1"]');
    expect(raw?.textContent).toBe('<kbd>Ctrl</kbd>');
    expect(raw?.querySelector('[data-caret="true"]')).not.toBeNull();
  });

  it('maps rendered offsets through HTML tag source markers', () => {
    expect(renderedOffsetToSource(0, '<kbd>Ctrl</kbd> + <mark>高亮</mark>')).toBe(5);
    expect(renderedOffsetToSource(4, '<kbd>Ctrl</kbd> + <mark>高亮</mark>')).toBe(15);
    expect(renderedOffsetToSource(7, '<kbd>Ctrl</kbd> + <mark>高亮</mark>')).toBe(24);
  });

  it('parses whitelisted tags without treating markdown mark syntax as HTML', () => {
    expect(parseInline('<kbd>Ctrl</kbd>')[0]).toMatchObject({ type: 'html_kbd', text: 'Ctrl' });
    expect(parseInline('==高亮==')[0]).toMatchObject({ type: 'mark', text: '高亮' });
  });
});

describe('inline link editing behavior', () => {
  it('prevents default navigation so WYSIWYG clicks can edit links in place', () => {
    const { container } = render(
      <InlineEditable text="[GitHub](https://github.com)" offset={-1} isActive={false} />,
    );
    const link = container.querySelector('a')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
