import { describe, it, expect } from 'vitest';
import { displayText, textToMarkdown, applyQuotePrefix, findBlockRecursive, listToMarkdown, listItemToMarkdown } from '../blocks';
import type { Block } from '../types';

describe('displayText', () => {
  it('heading 剥前缀', () => {
    const b: Block = { id: 'h', type: 'heading', level: 2, sourceStartLine: 1, sourceEndLine: 1, markdown: '## Title' };
    expect(displayText(b)).toBe('Title');
  });

  it('paragraph 直接返回 markdown', () => {
    const b: Block = { id: 'p', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo bar' };
    expect(displayText(b)).toBe('foo bar');
  });

  it('code 剥围栏行', () => {
    const b: Block = { id: 'c', type: 'code', sourceStartLine: 1, sourceEndLine: 3, markdown: '```js\nconst x;\n```', meta: { language: 'js' } };
    expect(displayText(b)).toBe('const x;');
  });

  it('quote 剥 > 前缀', () => {
    const b: Block = { id: 'q', type: 'quote', sourceStartLine: 1, sourceEndLine: 1, markdown: '> hello', meta: { quoteDepth: 1 } };
    expect(displayText(b)).toBe('hello');
  });

  it('list 剥 - / 1. / [ ] 前缀', () => {
    const b: Block = { id: 'l', type: 'list', sourceStartLine: 1, sourceEndLine: 2, markdown: '- foo\n- [ ] bar' };
    expect(displayText(b)).toBe('foo\nbar');
  });
});

describe('displayText list/listItem', () => {
  it('listItem 返回其 paragraph child 的 markdown', () => {
    const item: Block = {
      id: 'i1', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '- foo',
      meta: { indent: 0, listMarker: '-' },
      children: [{ id: 'p1', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' }],
    };
    expect(displayText(item)).toBe('foo');
  });

  it('list 返回所有 listItem children displayText 用 \\n 连接', () => {
    const mkItem = (id: string, text: string): Block => ({
      id, type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: `- ${text}`,
      meta: { indent: 0, listMarker: '-' },
      children: [{ id: id + 'p', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: text }],
    });
    const list: Block = {
      id: 'l1', type: 'list', sourceStartLine: 1, sourceEndLine: 2, markdown: '- a\n- b',
      meta: { ordered: false },
      children: [mkItem('i1', 'a'), mkItem('i2', 'b')],
    };
    expect(displayText(list)).toBe('a\nb');
  });

  it('listItem 无 paragraph child 返回空串', () => {
    const item: Block = {
      id: 'i1', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '- ',
      meta: { indent: 0, listMarker: '-' },
      children: [],
    };
    expect(displayText(item)).toBe('');
  });
});

describe('textToMarkdown', () => {
  it('heading 加 # 前缀', () => {
    const b: Block = { id: 'h', type: 'heading', level: 3, sourceStartLine: 1, sourceEndLine: 1, markdown: '### old' };
    expect(textToMarkdown('new', b)).toBe('### new');
  });

  it('code 包围栏', () => {
    const b: Block = { id: 'c', type: 'code', sourceStartLine: 1, sourceEndLine: 3, markdown: '```js\nold\n```', meta: { language: 'js' } };
    expect(textToMarkdown('new', b)).toBe('```js\nnew\n```');
  });
});

describe('applyQuotePrefix', () => {
  it('depth=1 单行', () => {
    expect(applyQuotePrefix('hello', 1)).toBe('> hello');
  });
  it('depth=2 多行', () => {
    expect(applyQuotePrefix('a\nb', 2)).toBe('> > a\n> > b');
  });
});

describe('findBlockRecursive', () => { it('深度查找 children', () => {
    const blocks: Block[] = [
      { id: 'q', type: 'quote', sourceStartLine: 1, sourceEndLine: 2, markdown: '> a', children: [
        { id: 'p', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'a' },
      ]},
    ];
    expect(findBlockRecursive(blocks, 'p')?.id).toBe('p');
  });
});

describe('listToMarkdown / listItemToMarkdown', () => {
  const mkPara = (id: string, text: string): Block =>
    ({ id, type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: text });

  const mkItem = (id: string, text: string, indent = 0, marker = '-', extra: Block[] = []): Block => ({
    id, type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: `- ${text}`,
    meta: { indent, listMarker: marker },
    children: [mkPara(id + 'p', text), ...extra],
  });

  it('无序简单列表', () => {
    const list: Block = {
      id: 'l', type: 'list', sourceStartLine: 1, sourceEndLine: 2, markdown: '',
      meta: { ordered: false },
      children: [mkItem('i1', 'foo'), mkItem('i2', 'bar')],
    };
    expect(listToMarkdown(list)).toBe('- foo\n- bar');
  });

  it('有序列表序号从 1 起递增', () => {
    const list: Block = {
      id: 'l', type: 'list', sourceStartLine: 1, sourceEndLine: 3, markdown: '',
      meta: { ordered: true },
      children: [mkItem('i1', 'a'), mkItem('i2', 'b'), mkItem('i3', 'c')],
    };
    expect(listToMarkdown(list)).toBe('1. a\n2. b\n3. c');
  });

  it('嵌套子列表序列化为 2 空格缩进', () => {
    const nested: Block = {
      id: 'nl', type: 'list', sourceStartLine: 1, sourceEndLine: 2, markdown: '',
      meta: { ordered: false },
      children: [mkItem('n1', '嵌套 A', 1), mkItem('n2', '嵌套 B', 1)],
    };
    const list: Block = {
      id: 'l', type: 'list', sourceStartLine: 1, sourceEndLine: 5, markdown: '',
      meta: { ordered: false },
      children: [mkItem('i1', '第一项'), mkItem('i2', '第二项', 0, '-', [nested]), mkItem('i3', '第三项')],
    };
    expect(listToMarkdown(list)).toBe('- 第一项\n- 第二项\n  - 嵌套 A\n  - 嵌套 B\n- 第三项');
  });

  it('任务列表 [ ]/[x]', () => {
    const item: Block = {
      id: 'i', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { indent: 0, listMarker: '-', checked: false },
      children: [mkPara('p', 'todo')],
    };
    expect(listItemToMarkdown(item, false, 1)).toBe('- [ ] todo');

    const item2 = { ...item, meta: { ...item.meta!, checked: true } } as Block;
    expect(listItemToMarkdown(item2, false, 1)).toBe('- [x] todo');
  });
});
