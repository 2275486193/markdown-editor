import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockRenderer } from '../renderer';
import type { Block } from '../types';

const taskList: Block = {
  id: 'tl1',
  type: 'list',
  sourceStartLine: 1,
  sourceEndLine: 2,
  markdown: '- [ ] foo\n- [x] bar',
  meta: { ordered: false },
  children: [
    {
      id: 't1',
      type: 'paragraph',
      sourceStartLine: 1,
      sourceEndLine: 1,
      markdown: '- [ ] foo',
    },
    {
      id: 't2',
      type: 'paragraph',
      sourceStartLine: 2,
      sourceEndLine: 2,
      markdown: '- [x] bar',
    },
  ],
};

describe('Task list checkbox', () => {
  it('renders ☐ for unchecked items', () => {
    render(
      <BlockRenderer
        blocks={[taskList]}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
        onContentEdit={() => {}}
        fullContent={'- [ ] foo\n- [x] bar'}
      />,
    );
    expect(screen.getByRole('button', { name: /unchecked/i })).toHaveTextContent('☐');
  });

  it('renders ☑ for checked items', () => {
    render(
      <BlockRenderer
        blocks={[taskList]}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
        onContentEdit={() => {}}
        fullContent={'- [ ] foo\n- [x] bar'}
      />,
    );
    expect(screen.getByRole('button', { name: /^checked$/i })).toHaveTextContent('☑');
  });

  it('clicking ☐ toggles to [x] in content', () => {
    const onEdit = vi.fn();
    render(
      <BlockRenderer
        blocks={[taskList]}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
        onContentEdit={onEdit}
        fullContent={'- [ ] foo\n- [x] bar'}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /unchecked/i }));
    expect(onEdit).toHaveBeenCalledWith('- [x] foo\n- [x] bar');
  });

  it('clicking ☑ toggles to [ ] in content', () => {
    const onEdit = vi.fn();
    render(
      <BlockRenderer
        blocks={[taskList]}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
        onContentEdit={onEdit}
        fullContent={'- [ ] foo\n- [x] bar'}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^checked$/i }));
    expect(onEdit).toHaveBeenCalledWith('- [ ] foo\n- [ ] bar');
  });
});
