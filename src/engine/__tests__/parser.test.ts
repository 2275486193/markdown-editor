import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../parser';
import { renderedOffsetToSource } from '../inline';

describe('renderedOffsetToSource', () => {
  it('converts start of bold', () => {
    expect(renderedOffsetToSource(0, '**bold** text')).toBe(2); // after **
  });
  it('converts middle of bold', () => {
    expect(renderedOffsetToSource(2, '**bold** text')).toBe(4); // b=0,o=1,l=2 → source: **b=2,o=3,l=4
  });
  it('converts end of bold', () => {
    // rendered offset 4 = space after bold. source offset 8 = space after "**bold**"
    expect(renderedOffsetToSource(4, '**bold** text')).toBe(8);
  });
  it('converts space after bold to first text char', () => {
    // rendered offset 5 = 't'. source offset 9 = 't'
    expect(renderedOffsetToSource(5, '**bold** text')).toBe(9);
  });
  it('converts start of italic', () => {
    // "a *b* c": rendered "a b c". offset 2 = 'b'. source offset 3 = 'b'
    expect(renderedOffsetToSource(2, 'a *b* c')).toBe(3);
  });
  it('converts after italic', () => {
    // offset 3 = ' ' after b. source offset 5 = space after *b*
    expect(renderedOffsetToSource(3, 'a *b* c')).toBe(5);
  });
  it('handles inline code', () => {
    // "a `b` c": rendered "a b c". offset 2 = 'b'. source offset 3 = 'b'
    expect(renderedOffsetToSource(2, 'a `b` c')).toBe(3);
  });
  it('handles plain text', () => {
    expect(renderedOffsetToSource(3, 'abcdef')).toBe(3);
  });
  it('handles mixed strong + em', () => {
    // "**bold** and *italic*" → styled: "bold and italic"
    // offset 5 = 'a' of "and". source: offset 9 = 'a' of " and "
    expect(renderedOffsetToSource(5, '**bold** and *italic*')).toBe(9);
  });
  it('clamps past-end offset', () => {
    expect(renderedOffsetToSource(999, 'abc')).toBe(3);
  });
  it('round-trip: styled offset → source → back to styled position', () => {
    const md = '**bold** and *italic* `code`';
    const rendered = 'bold and italic code';
    for (let i = 0; i < rendered.length; i++) {
      const src = renderedOffsetToSource(i, md);
      expect(src).toBeGreaterThanOrEqual(0);
      expect(src).toBeLessThanOrEqual(md.length);
    }
  });
  it('plain text in mixed block', () => {
    // styled "bold text": offset 5 = 't'. source offset 9 = 't'
    expect(renderedOffsetToSource(5, '**bold** text')).toBe(9);
  });
  it('plain text after styled, at boundary', () => {
    // styled "bold text": offset 4 = space after bold. source offset 8 = space
    expect(renderedOffsetToSource(4, '**bold** text')).toBe(8);
  });
  it('pure plain text identity', () => {
    expect(renderedOffsetToSource(0, 'hello')).toBe(0);
    expect(renderedOffsetToSource(2, 'hello')).toBe(2);
    expect(renderedOffsetToSource(5, 'hello')).toBe(5);
  });
  it('mixed Chinese with multiple inlines - 2nd separator', () => {
    const md = '普通段落。**粗体**、*斜体*、***粗斜体***、~~删除线~~、`行内代码`。';
    // styled: "普通段落。粗体、斜体、粗斜体、删除线、行内代码。"
    // 2nd 、at rendered offset 10 → source
    const r = renderedOffsetToSource(10, md);
    // Source seg positions: text(5)+strong(6)+text(1)=12, em starts at 12.
    // em(4) ends at 16. text(、) starts at 16. So 、is at source offset 16.
    expect(r).toBe(16);
  });
  it('mixed Chinese - 4th separator', () => {
    const md = '普通段落。**粗体**、*斜体*、***粗斜体***、~~删除线~~、`行内代码`。';
    // styled: 4th 、at rendered offset 18
    const r = renderedOffsetToSource(18, md);
    // Source: text(5)+strong(6)+、(1)+em(4)+、(1)+strong_em(9)+、(1)+del(7)=34
    // 、at source offset 34
    expect(r).toBe(34);
  });
});

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
    expect(blocks).toHaveLength(3); // p1, empty, p2
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].markdown).toBe('First paragraph.');
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[1].markdown).toBe('');
    expect(blocks[2].type).toBe('paragraph');
    expect(blocks[2].markdown).toBe('Second paragraph.');
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
    expect(blocks[0].type).toBe('heading');
    expect(blocks[0].sourceStartLine).toBe(1);
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[1].sourceStartLine).toBe(2);
    expect(blocks[1].markdown).toBe('');
    expect(blocks[2].type).toBe('paragraph');
    expect(blocks[2].sourceStartLine).toBe(3);
    expect(blocks[2].markdown).toBe('Paragraph 1');
    expect(blocks[3].type).toBe('paragraph');
    expect(blocks[3].sourceStartLine).toBe(4);
    expect(blocks[3].markdown).toBe('');
    expect(blocks[4].type).toBe('quote');
    expect(blocks[4].sourceStartLine).toBe(5);
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
    expect(ids.length).toBe(5); // heading, empty, heading, empty, heading
  });

  it('creates paragraph for zero-width space after heading', () => {
    const blocks = parseMarkdown('## Hello\n\n​');
    expect(blocks).toHaveLength(3); // heading, empty, zwsp
    expect(blocks[0].type).toBe('heading');
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[1].markdown).toBe('');
    expect(blocks[2].type).toBe('paragraph');
    expect(blocks[2].markdown).toBe('​');
  });

  it('creates paragraph for trailing line with content', () => {
    const blocks = parseMarkdown('## Hello\n\nworld');
    expect(blocks).toHaveLength(3); // heading, empty, paragraph
    expect(blocks[0].type).toBe('heading');
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[1].markdown).toBe('');
    expect(blocks[2].type).toBe('paragraph');
    expect(blocks[2].markdown).toBe('world');
  });

  it('splits consecutive non-blank lines into separate paragraphs', () => {
    const blocks = parseMarkdown('line one\nline two\nline three');
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].markdown).toBe('line one');
    expect(blocks[1].type).toBe('paragraph');
    expect(blocks[1].markdown).toBe('line two');
    expect(blocks[2].type).toBe('paragraph');
    expect(blocks[2].markdown).toBe('line three');
  });

  it('multiple trailing blank lines each become empty paragraphs', () => {
    const blocks = parseMarkdown('hello\n\n\n');
    expect(blocks).toHaveLength(3); // hello, empty, empty
    expect(blocks[0].markdown).toBe('hello');
    expect(blocks[1].markdown).toBe('');
    expect(blocks[2].markdown).toBe('');
  });

  it('single trailing newline does not produce extra empty paragraph', () => {
    const blocks = parseMarkdown('hello\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].markdown).toBe('hello');
  });
});
