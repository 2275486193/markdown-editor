import { describe, it, expect } from 'vitest';
import { handleDelete } from '../delete';
import type { Block } from '../../types';
import { parseMarkdown } from '../../parser';

const evt = { key: 'Delete', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

describe('handleDelete', () => {
  it('caretBlockId=null 返回 null', () => {
    expect(handleDelete(
      { content: '', blocks: [], caretBlockId: null, caretOffset: 0, caretLineTarget: 0, caretCell: null },
      evt,
    )).toBeNull();
  });

  it('paragraph 中段删字符', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'abc' };
    const patch = handleDelete(
      { content: 'abc', blocks: [p], caretBlockId: 'p1', caretOffset: 1, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('ac');
    expect(patch!.preventDefault).toBe(true);
  });

  it('paragraph 末尾合并下一段', () => {
    const p1: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const p2: Block = { id: 'p2', type: 'paragraph', sourceStartLine: 2, sourceEndLine: 2, markdown: 'bar' };
    const patch = handleDelete(
      { content: 'foo\nbar', blocks: [p1, p2], caretBlockId: 'p1', caretOffset: 3, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('foobar');
  });

  it('末块末尾 Delete 不变', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const patch = handleDelete(
      { content: 'foo', blocks: [p], caretBlockId: 'p1', caretOffset: 3, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBeUndefined();
    expect(patch!.preventDefault).toBe(true);
  });
});

describe('handleDelete selection deletion', () => {
  it('deletes selected text inside the active block', () => {
    const p: Block = { id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'hello world' };
    const patch = handleDelete(
      {
        content: 'hello world',
        blocks: [p],
        caretBlockId: 'p1',
        caretOffset: 0,
        caretLineTarget: 0,
        caretCell: null,
        selectionRange: { blockId: 'p1', start: 0, end: 5 },
      },
      { key: 'Delete', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false },
    );
    expect(patch!.newContent).toBe(' world');
    expect(patch!.newCaretOffset).toBe(0);
  });

  it('deletes a selected heading marker from raw heading text', () => {
    const h: Block = { id: 'h1', type: 'heading', level: 1, sourceStartLine: 1, sourceEndLine: 1, markdown: '# Title' };
    const patch = handleDelete(
      {
        content: '# Title',
        blocks: [h],
        caretBlockId: 'h1',
        caretOffset: 0,
        caretLineTarget: 0,
        caretCell: null,
        selectionRange: { blockId: 'h1', start: 0, end: 2 },
      },
      evt,
    );
    expect(patch!.newContent).toBe('Title');
    expect(patch!.newCaretBlockId).toBeNull();
    expect(patch!.newCaretLineTarget).toBe(1);
    expect(patch!.newCaretOffset).toBe(0);
  });
});

describe('handleDelete nested editing boundaries', () => {
  it('heading inside a list item Delete preserves the list marker', () => {
    const content = '- # X';
    const blocks = parseMarkdown(content, { deferBareShortcutMarkers: true });
    const heading = blocks[0].children![0].children![0];
    const patch = handleDelete(
      { content, blocks, caretBlockId: heading.id, caretOffset: 2, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('- # ');
    expect(patch!.newCaretBlockId).toBeNull();
    expect(patch!.newCaretLineTarget).toBe(1);
    expect(patch!.newCaretOffset).toBe(2);
  });

  it('heading inside a quote Delete preserves the quote prefix', () => {
    const content = '> # X';
    const blocks = parseMarkdown(content, { deferBareShortcutMarkers: true });
    const heading = blocks[0].children![0];
    const patch = handleDelete(
      { content, blocks, caretBlockId: heading.id, caretOffset: 2, caretLineTarget: 0, caretCell: null },
      evt,
    );
    expect(patch!.newContent).toBe('> # ');
    expect(patch!.newCaretBlockId).toBeNull();
    expect(patch!.newCaretLineTarget).toBe(1);
    expect(patch!.newCaretOffset).toBe(2);
  });

  it('table cell Delete deletes within the active cell without corrupting table syntax', () => {
    const content = '| A |\n|---|\n| # |';
    const blocks = parseMarkdown(content);
    const table = blocks[0];
    const patch = handleDelete(
      { content, blocks, caretBlockId: table.id, caretOffset: 0, caretLineTarget: 0, caretCell: { row: 1, col: 0 } },
      evt,
    );
    expect(patch!.newContent).toBe('| A |\n|---|\n|  |');
    expect(patch!.newCaretCell).toEqual({ row: 1, col: 0 });
    expect(patch!.newCaretOffset).toBe(0);
  });
});
