import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../parser';
import {
  exitListToParagraph,
  dedentListItem,
  indentListItem,
  splitListItem,
  mergeListItemBackward,
  toggleTaskItem,
} from '../list-ops';
import type { KeyContext } from '../types';

const mkCtx = (
  content: string,
  caretBlockId: string,
  caretOffset = 0,
): KeyContext => {
  const blocks = parseMarkdown(content);
  return { content, blocks, caretBlockId, caretOffset, caretLineTarget: 0, caretCell: null };
};

describe('exitListToParagraph', () => {
  it('单项空列表 → 退出为空 paragraph', () => {
    const blocks = parseMarkdown('- ');
    const list = blocks[0];
    const item = list.children![0];
    const ctx = mkCtx('- ', item.children![0]?.id ?? item.id, 0);
    const patch = exitListToParagraph(ctx, item, list);
    expect(patch.newContent).toBe('');
    expect(patch.preventDefault).toBe(true);
  });

  it('多项末尾空 item → 退出为 paragraph 接在 list 后', () => {
    const md = '- a\n- ';
    const blocks = parseMarkdown(md);
    const list = blocks[0];
    const item = list.children![1];
    const ctx = mkCtx(md, item.children![0]?.id ?? item.id, 0);
    const patch = exitListToParagraph(ctx, item, list);
    expect(patch.newContent).toBe('- a\n\n');
  });
});

describe('indentListItem', () => {
  it('首项不可升级 → no-op patch (newContent undefined)', () => {
    const md = '- a\n- b';
    const blocks = parseMarkdown(md);
    const list = blocks[0];
    const item = list.children![0];
    const ctx = mkCtx(md, item.children![0].id, 0);
    const patch = indentListItem(ctx, item, list);
    expect(patch.newContent).toBeUndefined();
    expect(patch.preventDefault).toBe(true);
  });

  it('第二项 Tab → 嵌入第一项的子列表', () => {
    const md = '- a\n- b';
    const blocks = parseMarkdown(md);
    const list = blocks[0];
    const item = list.children![1];
    const ctx = mkCtx(md, item.children![0].id, 0);
    const patch = indentListItem(ctx, item, list);
    expect(patch.newContent).toBe('- a\n  - b');
  });
});

describe('dedentListItem', () => {
  it('嵌套项降级 → 与父同级,后续 sibling 跟随降级', () => {
    const md = '- a\n- b\n  - A\n  - B\n- c';
    const blocks = parseMarkdown(md);
    const outer = blocks[0];
    const item2 = outer.children![1];
    const nestedList = item2.children!.find((c) => c.type === 'list')!;
    const nestedFirst = nestedList.children![0]; // '嵌套 A'
    const ctx = mkCtx(md, nestedFirst.children![0].id, 0);
    const patch = dedentListItem(ctx, nestedFirst, nestedList);
    expect(patch.newContent).toBe('- a\n- b\n- A\n  - B\n- c');
  });
});

describe('splitListItem', () => {
  it('caret 处分裂为两个 listItem', () => {
    const md = '- abcdef';
    const blocks = parseMarkdown(md);
    const list = blocks[0];
    const item = list.children![0];
    const ctx = mkCtx(md, item.children![0].id, 3);
    const patch = splitListItem(ctx, item, list, 'abc', 'def');
    expect(patch.newContent).toBe('- abc\n- def');
  });

  it('任务项续项默认未勾', () => {
    const md = '- [x] done';
    const blocks = parseMarkdown(md);
    const list = blocks[0];
    const item = list.children![0];
    const ctx = mkCtx(md, item.children![0].id, 4);
    const patch = splitListItem(ctx, item, list, 'done', '');
    expect(patch.newContent).toBe('- [x] done\n- [ ] ');
  });
});

describe('mergeListItemBackward', () => {
  it('非首项 行首 Backspace → 合并到前 sibling', () => {
    const md = '- foo\n- bar';
    const blocks = parseMarkdown(md);
    const list = blocks[0];
    const item = list.children![1];
    const ctx = mkCtx(md, item.children![0].id, 0);
    const patch = mergeListItemBackward(ctx, item, list);
    expect(patch.newContent).toBe('- foobar');
    expect(patch.newCaretOffset).toBe(3);
  });
});

describe('toggleTaskItem', () => {
  it('未勾 → 勾选', () => {
    const md = '- [ ] todo';
    const blocks = parseMarkdown(md);
    const item = blocks[0].children![0];
    const ctx = mkCtx(md, item.id, 0);
    const patch = toggleTaskItem(ctx, item.id);
    expect(patch.newContent).toBe('- [x] todo');
  });
});
