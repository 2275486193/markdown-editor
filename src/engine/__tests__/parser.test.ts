import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../parser';

describe('parseMarkdown', () => {
  it('returns empty array for empty input', () => {
    expect(parseMarkdown('')).toEqual([]);
  });

  it('parses a heading', () => {
    const blocks = parseMarkdown('# Hello');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[0].level).toBe(1);
    expect(blocks[0].markdown).toBe('# Hello');
    expect(blocks[0].sourceStartLine).toBe(1);
    expect(blocks[0].sourceEndLine).toBe(1);
  });

  it('parses heading levels h1-h6', () => {
    const blocks = parseMarkdown(
      '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6'
    );
    expect(blocks).toHaveLength(6);
    blocks.forEach((b, i) => {
      expect(b.type).toBe('heading');
      expect(b.level).toBe(i + 1);
    });
  });

  it('parses a paragraph', () => {
    const blocks = parseMarkdown('Hello world');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].markdown.trim()).toBe('Hello world');
  });

  it('parses multiple paragraphs separated by blank lines', () => {
    const blocks = parseMarkdown('First paragraph.\n\nSecond paragraph.');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[1].type).toBe('paragraph');
  });

  it('parses a fenced code block', () => {
    const blocks = parseMarkdown('```js\nconst x = 1;\n```');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('code');
    expect(blocks[0].meta?.language).toBe('js');
  });

  it('parses a blockquote', () => {
    const blocks = parseMarkdown('> This is a quote');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('quote');
  });

  it('parses multi-line blockquote', () => {
    const blocks = parseMarkdown('> Line one\n> Line two');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('quote');
    expect(blocks[0].sourceEndLine).toBe(2);
  });

  it('parses a thematic break', () => {
    const blocks = parseMarkdown('Before\n\n---\n\nAfter');
    expect(blocks.some((b) => b.type === 'hr')).toBe(true);
  });

  it('parses an unordered list', () => {
    const blocks = parseMarkdown('- Item 1\n- Item 2\n- Item 3');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('list');
    expect(blocks[0].meta?.ordered).toBe(false);
    expect(blocks[0].children).toBeDefined();
    expect(blocks[0].children!).toHaveLength(3);
    expect(blocks[0].children![0].type).toBe('paragraph');
  });

  it('parses an ordered list', () => {
    const blocks = parseMarkdown('1. First\n2. Second\n3. Third');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('list');
    expect(blocks[0].meta?.ordered).toBe(true);
  });

  it('parses a mixed document', () => {
    const md = '# Title\n\nSome text.\n\n> A quote\n\n```\ncode\n```\n\nMore text.';
    const blocks = parseMarkdown(md);
    const types = blocks.map((b) => b.type);
    expect(types).toContain('heading');
    expect(types).toContain('paragraph');
    expect(types).toContain('quote');
    expect(types).toContain('code');
  });

  it('sets correct line numbers for each block', () => {
    const md = '# H1\n\nParagraph 1\n\n> Quote';
    const blocks = parseMarkdown(md);
    expect(blocks[0].sourceStartLine).toBe(1);
    expect(blocks[0].sourceEndLine).toBe(1);
    expect(blocks[1].sourceStartLine).toBe(3);
    expect(blocks[1].sourceEndLine).toBe(3);
    expect(blocks[2].sourceStartLine).toBe(5);
    expect(blocks[2].sourceEndLine).toBe(5);
  });

  it('preserves newlines in multi-line blocks', () => {
    const tableMd = '| a | b |\n| --- | --- |\n| 1 | 2 |';
    const tableBlocks = parseMarkdown(tableMd);
    expect(tableBlocks[0].type).toBe('table');
    expect(tableBlocks[0].markdown).toContain('\n');
    expect(tableBlocks[0].markdown.split('\n').length).toBe(3);

    const codeMd = '```js\nconst x = 1;\n```';
    const codeBlocks = parseMarkdown(codeMd);
    expect(codeBlocks[0].type).toBe('code');
    expect(codeBlocks[0].markdown).toContain('\n');
    expect(codeBlocks[0].markdown.split('\n').length).toBe(3);

    const quoteMd = '> line1\n> line2';
    const quoteBlocks = parseMarkdown(quoteMd);
    expect(quoteBlocks[0].type).toBe('quote');
    expect(quoteBlocks[0].markdown).toContain('\n');
    expect(quoteBlocks[0].markdown.split('\n').length).toBe(2);
  });

  it('every block has a unique id', () => {
    const blocks = parseMarkdown('# A\n\n# B\n\n# C');
    const ids = blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
