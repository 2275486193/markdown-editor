import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BlockRenderer } from '../renderer';
import type { Block } from '../types';

describe('heading active rendering', () => {
  it('uses raw markdown offsets so the marker can be selected and edited', () => {
    const heading: Block = {
      id: 'h1',
      type: 'heading',
      level: 1,
      sourceStartLine: 1,
      sourceEndLine: 1,
      markdown: '# Title',
    };
    const { container } = render(
      <BlockRenderer blocks={[heading]} onBlockClick={() => {}} activeBlockId="h1" activeOffset={0} />,
    );
    const raw = container.querySelector('[data-seg-raw="1"]')!;
    expect(raw.textContent).toBe('# Title');
    expect(raw.firstChild?.textContent).toBe('');
    expect(raw.querySelector('[data-caret="true"]')).not.toBeNull();
  });
});
