import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('CodeBlock language switch', () => {
  it('clicking language span turns it into an input', () => {
    render(
      <BlockRenderer
        blocks={[codeBlock]}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
        onContentEdit={() => {}}
        fullContent={'```js\nconst x = 1;\n```'}
      />,
    );
    fireEvent.click(screen.getByText('js'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('blurring input writes new fence line to content', () => {
    const onEdit = vi.fn();
    render(
      <BlockRenderer
        blocks={[codeBlock]}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
        onContentEdit={onEdit}
        fullContent={'```js\nconst x = 1;\n```'}
      />,
    );
    fireEvent.click(screen.getByText('js'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'python' } });
    fireEvent.blur(input);
    expect(onEdit).toHaveBeenCalledWith('```python\nconst x = 1;\n```');
  });
});
