import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BlockRenderer } from '../renderer';
import type { Block } from '../types';

const codeBlock: Block = {
  id: 'c1',
  type: 'code',
  sourceStartLine: 1,
  sourceEndLine: 3,
  markdown: '```js\nabc\n```',
  meta: { language: 'js' },
};

describe('CodeBlock active caret rendering', () => {
  it('renders a raw code-body segment with a visible caret at the body offset', () => {
    const { container } = render(
      <BlockRenderer
        blocks={[codeBlock]}
        onBlockClick={() => {}}
        activeBlockId="c1"
        activeOffset={1}
      />,
    );

    const raw = container.querySelector('[data-seg-raw="1"]') as HTMLElement | null;
    expect(raw).not.toBeNull();
    expect(raw?.dataset.segStart).toBe('0');
    expect(raw?.dataset.segEnd).toBe('3');
    expect(raw?.textContent).toBe('abc');

    const caret = raw?.querySelector('[data-caret="true"]');
    expect(caret).not.toBeNull();
  });
});
