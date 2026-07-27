import { describe, it, expect } from 'vitest';
import { deleteLine, syncBlockEdit } from '../sync';

describe('syncBlockEdit', () => {
  it('replaces a single line', () => {
    const content = 'line 1\nline 2\nline 3';
    const result = syncBlockEdit(content, 2, 2, 'modified line 2');
    expect(result).toBe('line 1\nmodified line 2\nline 3');
  });

  it('replaces multiple lines', () => {
    const content = 'a\nb\nc\nd\ne';
    const result = syncBlockEdit(content, 2, 4, 'new b\nnew c\nnew d');
    expect(result).toBe('a\nnew b\nnew c\nnew d\ne');
  });

  it('replaces first line', () => {
    const content = 'old first\nsecond\nthird';
    const result = syncBlockEdit(content, 1, 1, 'new first');
    expect(result).toBe('new first\nsecond\nthird');
  });

  it('replaces last line', () => {
    const content = 'first\nsecond\nold last';
    const result = syncBlockEdit(content, 3, 3, 'new last');
    expect(result).toBe('first\nsecond\nnew last');
  });

  it('handles multi-line new text replacing a single line', () => {
    const content = 'one\nold\nfour';
    const result = syncBlockEdit(content, 2, 2, 'two\nthree');
    expect(result).toBe('one\ntwo\nthree\nfour');
  });

  it('handles single-line new text replacing multiple lines', () => {
    const content = 'one\ntwo\nthree\nfour';
    const result = syncBlockEdit(content, 2, 3, 'TWO-THREE');
    expect(result).toBe('one\nTWO-THREE\nfour');
  });

  it('handles empty new text (block deletion)', () => {
    const content = 'keep\nremove\nkeep';
    const result = syncBlockEdit(content, 2, 2, '');
    expect(result).toBe('keep\n\nkeep');
  });

  it('handles single-line document', () => {
    const content = 'only line';
    const result = syncBlockEdit(content, 1, 1, 'changed');
    expect(result).toBe('changed');
  });

  it('replaces the entire document', () => {
    const content = 'old line 1\nold line 2';
    const result = syncBlockEdit(content, 1, 2, 'new line 1\nnew line 2\nnew line 3');
    expect(result).toBe('new line 1\nnew line 2\nnew line 3');
  });

  it('preserves trailing newline in content', () => {
    const content = 'line 1\nline 2\n';
    const result = syncBlockEdit(content, 2, 2, 'new line 2');
    expect(result).toBe('line 1\nnew line 2\n');
  });

  it('returns unchanged content when range is empty (startLine === endLine and newText matches)', () => {
    const content = 'a\nb\nc';
    const result = syncBlockEdit(content, 2, 2, 'b');
    expect(result).toBe('a\nb\nc');
  });

  it('replaces correct block in a markdown-like document', () => {
    const content = '# Title\n\nHello world\n\n> Quote\n';
    const result = syncBlockEdit(content, 3, 3, 'Hello universe');
    expect(result).toBe('# Title\n\nHello universe\n\n> Quote\n');
  });
});

describe('sync basic editing boundaries', () => {
  it('syncBlockEdit can replace one line with multiple editable lines', () => {
    expect(syncBlockEdit('a\nb\nc', 2, 2, 'x\ny')).toBe('a\nx\ny\nc');
  });

  it('deleteLine removes an editable blank line without touching neighbors', () => {
    expect(deleteLine('a\n\nb', 2)).toBe('a\nb');
  });
});
