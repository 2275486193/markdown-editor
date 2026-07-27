import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockRenderer } from '../renderer';
import { parseMarkdown } from '../parser';

const md = '- [ ] foo\n- [x] bar';

describe('Task list checkbox', () => {
  it('renders ☐ for unchecked items', () => {
    const blocks = parseMarkdown(md);
    render(
      <BlockRenderer
        blocks={blocks}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
        onContentEdit={() => {}}
        fullContent={md}
      />,
    );
    expect(screen.getByRole('button', { name: /unchecked/i })).toHaveTextContent('☐');
  });

  it('renders ☑ for checked items', () => {
    const blocks = parseMarkdown(md);
    render(
      <BlockRenderer
        blocks={blocks}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
        onContentEdit={() => {}}
        fullContent={md}
      />,
    );
    expect(screen.getByRole('button', { name: /^checked$/i })).toHaveTextContent('☑');
  });

  it('clicking ☐ toggles to [x] in content', () => {
    const blocks = parseMarkdown(md);
    const onEdit = vi.fn();
    render(
      <BlockRenderer
        blocks={blocks}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
        onContentEdit={onEdit}
        fullContent={md}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /unchecked/i }));
    expect(onEdit).toHaveBeenCalledWith('- [x] foo\n- [x] bar');
  });

  it('clicking ☑ toggles to [ ] in content', () => {
    const blocks = parseMarkdown(md);
    const onEdit = vi.fn();
    render(
      <BlockRenderer
        blocks={blocks}
        onBlockClick={() => {}}
        activeBlockId={null}
        activeOffset={0}
        onContentEdit={onEdit}
        fullContent={md}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^checked$/i }));
    expect(onEdit).toHaveBeenCalledWith('- [ ] foo\n- [ ] bar');
  });
});
