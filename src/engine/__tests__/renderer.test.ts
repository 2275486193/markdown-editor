import { describe, it, expect } from 'vitest';
import { codeInnerText, codeReconstructMd } from '../renderer';
import { parseInline } from '../inline';
import { parseMarkdown } from '../parser';
import { syncBlockEdit } from '../sync';
import type { Block } from '../types';

function block(overrides: Partial<Block> = {}): Block {
  return {
    id: 'test-1',
    type: 'code',
    sourceStartLine: 1,
    sourceEndLine: 3,
    markdown: '```\ncode\n```',
    ...overrides,
  };
}

// ── code helpers ──

describe('codeInnerText', () => {
  it('extracts inner text from code fence', () => {
    expect(codeInnerText(block({ markdown: '```js\nconst x = 1;\n```' }))).toBe('const x = 1;');
  });

  it('returns empty for empty code block', () => {
    expect(codeInnerText(block({ markdown: '```\n```' }))).toBe('');
  });

  it('handles multi-line code', () => {
    expect(codeInnerText(block({ markdown: '```\nline1\nline2\nline3\n```' }))).toBe(
      'line1\nline2\nline3',
    );
  });
});

describe('codeReconstructMd', () => {
  it('reconstructs with language', () => {
    expect(codeReconstructMd(block({ meta: { language: 'ts' } }), 'const x = 1;')).toBe(
      '```ts\nconst x = 1;\n```',
    );
  });

  it('reconstructs without language', () => {
    expect(codeReconstructMd(block({}), 'code')).toBe('```\ncode\n```');
  });

  it('round-trips', () => {
    const b = block({ meta: { language: 'js' }, markdown: '```js\nconst x = 1;\n```' });
    const inner = codeInnerText(b);
    const md = codeReconstructMd(b, inner);
    expect(md).toBe('```js\nconst x = 1;\n```');
  });
});

// ── inline parser ──

describe('parseInline', () => {
  it('returns text segment for plain text', () => {
    expect(parseInline('hello')).toMatchObject([{ type: 'text', text: 'hello' }]);
  });

  it('returns empty for empty string', () => {
    expect(parseInline('')).toMatchObject([]);
  });

  it('parses bold with **', () => {
    const segs = parseInline('Hello **bold** world');
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ type: 'text', text: 'Hello ' });
    expect(segs[1]).toMatchObject({ type: 'strong', text: 'bold' });
    expect(segs[2]).toMatchObject({ type: 'text', text: ' world' });
  });

  it('parses bold with __', () => {
    const segs = parseInline('__bold__');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ type: 'strong', text: 'bold' });
  });

  it('parses italic with *', () => {
    const segs = parseInline('a *italic* b');
    expect(segs).toHaveLength(3);
    expect(segs[1]).toMatchObject({ type: 'em', text: 'italic' });
  });

  it('parses italic with _', () => {
    const segs = parseInline('_em_');
    expect(segs[0]).toMatchObject({ type: 'em', text: 'em' });
  });

  it('parses strikethrough', () => {
    const segs = parseInline('~~deleted~~');
    expect(segs[0]).toMatchObject({ type: 'del', text: 'deleted' });
  });

  it('parses inline code', () => {
    const segs = parseInline('use `const` keyword');
    expect(segs[1]).toMatchObject({ type: 'code', text: 'const' });
  });

  it('parses link', () => {
    const segs = parseInline('[click](https://x.com)');
    expect(segs[0]).toMatchObject({ type: 'link', text: 'click', url: 'https://x.com' });
  });

  it('parses image', () => {
    const segs = parseInline('![alt](img.png)');
    expect(segs[0]).toMatchObject({ type: 'image', alt: 'alt', url: 'img.png' });
  });

  it('parses bold+italic ***text***', () => {
    expect(parseInline('***bold italic***')).toMatchObject([
      { type: 'strong_em', text: 'bold italic' },
    ]);
  });

  it('parses bold+italic with ___', () => {
    expect(parseInline('___bold italic___')).toMatchObject([
      { type: 'strong_em', text: 'bold italic' },
    ]);
  });

  it('parses ***text*** mixed with regular text', () => {
    const segs = parseInline('before ***bold italic*** after');
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ type: 'text', text: 'before ' });
    expect(segs[1]).toMatchObject({ type: 'strong_em', text: 'bold italic' });
    expect(segs[2]).toMatchObject({ type: 'text', text: ' after' });
  });

  it('parses subscript ~text~', () => {
    expect(parseInline('H~2~O')).toMatchObject([
      { type: 'text', text: 'H' },
      { type: 'sub', text: '2' },
      { type: 'text', text: 'O' },
    ]);
  });

  it('parses superscript ^text^', () => {
    expect(parseInline('X^2^')).toMatchObject([
      { type: 'text', text: 'X' },
      { type: 'sup', text: '2' },
    ]);
  });

  it('does not confuse ~subscript~ with ~~strikethrough~~', () => {
    const segs = parseInline('~~del~~ and ~sub~');
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ type: 'del', text: 'del' });
    expect(segs[2]).toMatchObject({ type: 'sub', text: 'sub' });
  });

  it('parses highlight ==text==', () => {
    const segs = parseInline('==highlighted==');
    expect(segs[0]).toMatchObject({ type: 'mark', text: 'highlighted' });
  });

  it('parses inline math', () => {
    const segs = parseInline('$E=mc^2$');
    expect(segs[0]).toMatchObject({ type: 'math', tex: 'E=mc^2', display: false });
  });

  it('parses HTML tag passthrough', () => {
    const segs = parseInline('<span>hi</span>');
    expect(segs[0]).toMatchObject({ type: 'html', raw: '<span>' });
    // nested tags: inner detected as text (no closing bracket in tag name)
  });

  it('handles escaped characters', () => {
    expect(parseInline('\\*star\\*')).toMatchObject([{ type: 'text', text: '*star*' }]);
  });

  it('parses mixed formatting', () => {
    const segs = parseInline('**bold** and *italic* and `code` and ~~del~~');
    expect(segs).toHaveLength(7);
    expect(segs[0]).toMatchObject({ type: 'strong', text: 'bold' });
    expect(segs[2]).toMatchObject({ type: 'em', text: 'italic' });
    expect(segs[4]).toMatchObject({ type: 'code', text: 'code' });
    expect(segs[6]).toMatchObject({ type: 'del', text: 'del' });
  });

  it('parses link mixed with text', () => {
    const segs = parseInline('see [link](url) here');
    expect(segs).toHaveLength(3);
    expect(segs[1]).toMatchObject({ type: 'link', text: 'link', url: 'url' });
  });
});

// ── block-display helpers ──

// Replicate the fixed strip functions to test them
function stripQuote(line: string): string {
  let r = line;
  while (/^>\s?/.test(r)) r = r.replace(/^>\s?/, '');
  return r;
}

function stripList(line: string): string {
  return line.replace(/^(\s*)[-*+]\s+/, '$1').replace(/^(\s*)\d+\.\s+/, '$1');
}

function stripTask(line: string): string {
  return line.replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/, '$1');
}

describe('quote prefix stripping', () => {
  it('strips single >', () => {
    expect(stripQuote('> hello')).toBe('hello');
  });

  it('strips double >>', () => {
    expect(stripQuote('> > nested')).toBe('nested');
  });

  it('strips triple >>>', () => {
    expect(stripQuote('> > > deep')).toBe('deep');
  });

  it('preserves inline formatting inside quote', () => {
    const inner = stripQuote('> **bold** and *italic*');
    expect(parseInline(inner)).toMatchObject([
      { type: 'strong', text: 'bold' },
      { type: 'text', text: ' and ' },
      { type: 'em', text: 'italic' },
    ]);
  });

  it('preserves links inside quote', () => {
    const inner = stripQuote('> > [link](url)');
    expect(parseInline(inner)).toMatchObject([
      { type: 'link', text: 'link', url: 'url' },
    ]);
  });
});

describe('list prefix stripping', () => {
  it('strips unordered prefix', () => {
    expect(stripList('- item')).toBe('item');
  });

  it('strips ordered prefix', () => {
    expect(stripList('1. first')).toBe('first');
  });

  it('preserves indentation for nested lists', () => {
    expect(stripList('  - nested')).toBe('  nested');
  });

  it('preserves inline formatting in list item', () => {
    const inner = stripList('- **bold** `code`');
    expect(parseInline(inner)).toMatchObject([
      { type: 'strong', text: 'bold' },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'code' },
    ]);
  });

  it('strips task prefix completely', () => {
    expect(stripTask('- [ ] todo')).toBe('todo');
    expect(stripTask('- [x] done')).toBe('done');
    expect(stripTask('- [X] also done')).toBe('also done');
  });
});

// ── round-trip: parse → display → edit → sync → re-parse ──

describe('block round-trip', () => {
  function roundTrip(markdown: string): string {
    const blocks = parseMarkdown(markdown);
    let result = markdown;
    for (const b of blocks) {
      const inner = b.markdown;
      result = syncBlockEdit(result, b.sourceStartLine, b.sourceEndLine, inner);
    }
    return result;
  }

  it('preserves heading with inline formatting', () => {
    expect(roundTrip('## Hello **world**')).toBe('## Hello **world**');
  });

  it('preserves paragraph with mixed formatting', () => {
    const md = 'Text with **bold**, *italic*, `code`, ~~strike~~, and [link](url).';
    expect(roundTrip(md)).toBe(md);
  });

  it('preserves nested blockquote', () => {
    expect(roundTrip('> > nested quote')).toBe('> > nested quote');
  });

  it('preserves multi-line blockquote', () => {
    expect(roundTrip('> line one\n> line two')).toBe('> line one\n> line two');
  });

  it('preserves unordered list', () => {
    expect(roundTrip('- item 1\n- item 2')).toBe('- item 1\n- item 2');
  });

  it('preserves ordered list', () => {
    expect(roundTrip('1. first\n2. second')).toBe('1. first\n2. second');
  });

  it('preserves nested list', () => {
    expect(roundTrip('- item 1\n  - nested')).toBe('- item 1\n  - nested');
  });

  it('preserves table', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |';
    expect(roundTrip(md)).toBe(md);
  });

  it('preserves task list', () => {
    expect(roundTrip('- [ ] todo\n- [x] done')).toBe('- [ ] todo\n- [x] done');
  });

  it('preserves code block', () => {
    expect(roundTrip('```\ncode here\n```')).toBe('```\ncode here\n```');
  });

  it('preserves HTML block', () => {
    expect(roundTrip('<div>html</div>')).toBe('<div>html</div>');
  });

  it('preserves strikethrough in table', () => {
    const md = '| a | b |\n| --- | --- |\n| ~~x~~ | y |';
    expect(roundTrip(md)).toBe(md);
  });
});
