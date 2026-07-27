import { describe, it, expect } from 'vitest';
import { handleTab } from '../tab';
import type { Block } from '../../types';

const make = (shift = false) => ({ key: 'Tab', shiftKey: shift, ctrlKey: false, metaKey: false, altKey: false });

describe('handleTab', () => {
  it('非 Tab 键返回 null', () => {
    expect(handleTab(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0 },
      { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false },
    )).toBeNull();
  });

  it('caretBlockId=null preventDefault 不改 content', () => {
    const patch = handleTab(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0 },
      make(),
    );
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });

  it('paragraph(非 list)Tab 不改 content', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const patch = handleTab(
      { content: 'foo', blocks: [p], caretBlockId: 'p1', caretOffset: 1, caretLineTarget: 0 },
      make(),
    );
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });

  it('list Tab 行首缩进 +2 空格', () => {
    const l: Block = { id: 'l1', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '- foo', meta: { ordered: false } };
    const patch = handleTab(
      { content: '- foo', blocks: [l], caretBlockId: 'l1', caretOffset: 0, caretLineTarget: 0 },
      make(false),
    );
    expect(patch!.newContent).toBe('  - foo');
    expect(patch!.newCaretOffset).toBe(2);
    expect(patch!.syncActiveOffset).toBe(true);
    expect(patch!.repositionAfter).toBe(true);
  });

  it('list Shift+Tab 行首移除 2 空格', () => {
    const l: Block = { id: 'l1', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '-   foo', meta: { ordered: false } };
    const patch = handleTab(
      { content: '-   foo', blocks: [l], caretBlockId: 'l1', caretOffset: 4, caretLineTarget: 0 },
      make(true),
    );
    expect(patch!.newContent).toBe('- foo');
    expect(patch!.newCaretOffset).toBe(2);
  });

  it('Shift+Tab 无可移除空格 → content 不变,preventDefault', () => {
    const l: Block = { id: 'l1', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '- foo', meta: { ordered: false } };
    const patch = handleTab(
      { content: '- foo', blocks: [l], caretBlockId: 'l1', caretOffset: 0, caretLineTarget: 0 },
      make(true),
    );
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });
});
