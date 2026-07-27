import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BlockRenderer } from '../renderer';
import type { Block } from '../types';

const codeBlock: Block = {
  id: 'c1',
  type: 'code',
  sourceStartLine: 1,
  sourceEndLine: 3,
  markdown: '```js\nconst x = 1;\n```',
  meta: { language: 'js' },
};

describe('CodeBlock copy button', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders a copy button', () => {
    render(
      <BlockRenderer
        blocks={[codeBlock]}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
      />,
    );
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('clicking copy writes inner code to clipboard', () => {
    render(
      <BlockRenderer
        blocks={[codeBlock]}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const x = 1;');
  });

  it('after click, button shows ✓ for 1.5s then reverts', async () => {
    vi.useFakeTimers();
    render(
      <BlockRenderer
        blocks={[codeBlock]}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
      />,
    );
    const btn = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(btn);
    expect(btn.textContent).toBe('✓');
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(btn.textContent).toBe('📋');
    vi.useRealTimers();
  });
});
