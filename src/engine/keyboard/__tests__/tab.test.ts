import { describe, it, expect } from 'vitest';
import { handleTab } from '../tab';
import type { Block } from '../../types';
import { parseMarkdown } from '../../parser';

const make = (shift = false) => ({ key: 'Tab', shiftKey: shift, ctrlKey: false, metaKey: false, altKey: false });

describe('handleTab', () => {
  it('非 Tab 键返回 null', () => {
    expect(handleTab(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false },
    )).toBeNull();
  });

  it('caretBlockId=null preventDefault 不改 content', () => {
    const patch = handleTab(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      make(),
    );
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });

  it('paragraph(非 list)Tab 不改 content', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const patch = handleTab(
      { content: 'foo', blocks: [p], caretBlockId: 'p1', caretOffset: 1, caretLineTarget: 0, caretCell: null },
      make(),
    );
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });

  it('code block Tab 在 caret 处插 2 空格', () => {
    const c: Block = { id: 'c1', type: 'code', sourceStartLine: 1, sourceEndLine: 3, markdown: '```\nfoo\n```', meta: { language: '' } };
    const patch = handleTab(
      { content: '```\nfoo\n```', blocks: [c], caretBlockId: 'c1', caretOffset: 0, caretLineTarget: 0, caretCell: null },
      make(false),
    );
    expect(patch!.newContent).toBe('```\n  foo\n```');
    expect(patch!.newCaretOffset).toBe(2);
    expect(patch!.syncActiveOffset).toBe(true);
    expect(patch!.repositionAfter).toBe(true);
  });

  it('code block Shift+Tab 不操作', () => {
    const c: Block = { id: 'c1', type: 'code', sourceStartLine: 1, sourceEndLine: 3, markdown: '```\nfoo\n```', meta: { language: '' } };
    const patch = handleTab(
      { content: '```\nfoo\n```', blocks: [c], caretBlockId: 'c1', caretOffset: 0, caretLineTarget: 0, caretCell: null },
      make(true),
    );
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });
});

describe('handleTab list (structural)', () => {
  it('第二项 Tab → 嵌入第一项的子列表', () => {
    const content = '- a\n- b';
    const blocks = parseMarkdown(content);
    const list = blocks.find((b) => b.type === 'list')!;
    const item = list.children![1];
    const para = item.children!.find((c) => c.type === 'paragraph')!;
    const patch = handleTab(
      { content, blocks, caretBlockId: para.id, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      make(false),
    );
    expect(patch!.newContent).toBe('- a\n  - b');
    expect(patch!.preventDefault).toBe(true);
  });

  it('首项 Tab no-op(无前 sibling)', () => {
    const content = '- a\n- b';
    const blocks = parseMarkdown(content);
    const list = blocks.find((b) => b.type === 'list')!;
    const item = list.children![0];
    const para = item.children!.find((c) => c.type === 'paragraph')!;
    const patch = handleTab(
      { content, blocks, caretBlockId: para.id, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      make(false),
    );
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });

  it('嵌套项 Shift+Tab → 升出到顶层', () => {
    const content = '- a\n\n  - A';
    const blocks = parseMarkdown(content);
    const list = blocks.find((b) => b.type === 'list')!;
    const topItem = list.children![0];
    const nestedList = topItem.children!.find((c) => c.type === 'list')!;
    const nestedItem = nestedList.children![0];
    const nestedPara = nestedItem.children!.find((c) => c.type === 'paragraph')!;
    const patch = handleTab(
      { content, blocks, caretBlockId: nestedPara.id, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      make(true),
    );
    expect(patch!.newContent).toBe('- a\n- A');
  });
});
