import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BlockRenderer } from '../renderer';
import { parseMarkdown } from '../parser';

describe('BlockRenderer visual class contract', () => {
  it('renders semantic classes for core markdown blocks', () => {
    const blocks = parseMarkdown([
      '# Title',
      '',
      'Paragraph text',
      '',
      '> Quote text',
      '',
      '```ts',
      'const ok = true;',
      '```',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
    ].join('\n'));
    const { container } = render(
      <BlockRenderer blocks={blocks} onBlockClick={() => {}} activeBlockId={null} activeOffset={0} />,
    );

    expect(container.querySelector('.md-heading-1')).not.toBeNull();
    expect(container.querySelector('.md-paragraph')).not.toBeNull();
    expect(container.querySelector('.md-quote')).not.toBeNull();
    expect(container.querySelector('.md-code-block')).not.toBeNull();
    expect(container.querySelector('.md-table')).not.toBeNull();
  });

  it('renders tables inside blockquotes', () => {
    const blocks = parseMarkdown('> | A |\n> |---|\n> | B |');
    const { container } = render(
      <BlockRenderer blocks={blocks} onBlockClick={() => {}} activeBlockId={null} activeOffset={0} />,
    );

    expect(container.querySelector('.md-quote .md-table')).not.toBeNull();
    expect(container.querySelector('.md-quote .md-table-cell')?.textContent).toBe('A');
  });
});
