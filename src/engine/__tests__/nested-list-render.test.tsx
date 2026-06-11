import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BlockRenderer } from '../renderer';
import { parseMarkdown } from '../parser';

describe('nested list rendering', () => {
  const noop = () => {};

  it('嵌套列表:第二项内含一个 <ul> 含 2 个 <li>', () => {
    const blocks = parseMarkdown('- 第一项\n- 第二项\n  - 嵌套 A\n  - 嵌套 B\n- 第三项');
    const { container } = render(
      <BlockRenderer blocks={blocks} onBlockClick={noop} activeBlockId={null} activeOffset={0} />,
    );
    const topUl = container.querySelector('ul');
    expect(topUl).not.toBeNull();
    const topLis = topUl!.querySelectorAll(':scope > li');
    expect(topLis.length).toBe(3);

    const item1 = topLis[1];
    const nestedUl = item1.querySelector('ul');
    expect(nestedUl).not.toBeNull();
    const nestedLis = nestedUl!.querySelectorAll(':scope > li');
    expect(nestedLis.length).toBe(2);
    expect(nestedLis[0].textContent).toContain('嵌套 A');
    expect(nestedLis[1].textContent).toContain('嵌套 B');
  });

  it('第三项不会被吸入第二项的子列表', () => {
    const blocks = parseMarkdown('- 第一项\n- 第二项\n  - 嵌套 A\n- 第三项');
    const { container } = render(
      <BlockRenderer blocks={blocks} onBlockClick={noop} activeBlockId={null} activeOffset={0} />,
    );
    const topUl = container.querySelector('ul');
    const directChildLis = topUl!.querySelectorAll(':scope > li');
    expect(directChildLis.length).toBe(3);
    expect(directChildLis[2].textContent).toContain('第三项');
  });

  it('任务列表按钮 ☐ / ☑ 渲染', () => {
    const blocks = parseMarkdown('- [ ] todo\n- [x] done');
    const { container } = render(
      <BlockRenderer blocks={blocks} onBlockClick={noop} activeBlockId={null} activeOffset={0} />,
    );
    const buttons = container.querySelectorAll('button[aria-label]');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toBe('☐');
    expect(buttons[1].textContent).toBe('☑');
  });
});
