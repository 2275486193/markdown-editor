import { describe, it, expect } from 'vitest';
import { displayText, textToMarkdown, applyQuotePrefix, findBlockRecursive, listToMarkdown, listItemToMarkdown, findEnclosingListItem, findParentList, getNavigableBlocks } from '../blocks';
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

  it('空 listItem(无 children)仍输出 marker 行', () => {
    const item: Block = {
      id: 'i1', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { indent: 0, listMarker: '-' },
      children: [],
    };
    expect(listItemToMarkdown(item, false, 1)).toBe('- ');
  });
});

describe('findEnclosingListItem / findParentList', () => {
  it('paragraph 在 listItem 内时 findEnclosingListItem 返回该 listItem', () => {
    const p: Block = { id: 'p', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'foo' };
    const item: Block = {
      id: 'i', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '- foo',
      meta: { indent: 0, listMarker: '-' }, children: [p],
    };
    const list: Block = {
      id: 'l', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '- foo',
      meta: { ordered: false }, children: [item],
    };
    expect(findEnclosingListItem([list], 'p')?.id).toBe('i');
    expect(findEnclosingListItem([list], 'i')?.id).toBe('i');
    expect(findEnclosingListItem([list], 'l')).toBeUndefined();
  });

  it('深度嵌套的 paragraph 也能找到', () => {
    const deepPara: Block = { id: 'dp', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'deep' };
    const deepItem: Block = {
      id: 'di', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { indent: 1, listMarker: '-' }, children: [deepPara],
    };
    const nestedList: Block = {
      id: 'nl', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { ordered: false }, children: [deepItem],
    };
    const outerItem: Block = {
      id: 'oi', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { indent: 0, listMarker: '-' },
      children: [
        { id: 'op', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'outer' },
        nestedList,
      ],
    };
    const outer: Block = {
      id: 'ol', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { ordered: false }, children: [outerItem],
    };
    expect(findEnclosingListItem([outer], 'dp')?.id).toBe('di');
    expect(findEnclosingListItem([outer], 'op')?.id).toBe('oi');
  });

  it('findParentList 返回包含该 listItem 的 list', () => {
    const item: Block = {
      id: 'i', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '- foo',
      meta: { indent: 0, listMarker: '-' }, children: [],
    };
    const list: Block = {
      id: 'l', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '- foo',
      meta: { ordered: false }, children: [item],
    };
    expect(findParentList([list], 'i')?.id).toBe('l');
  });

  it('findParentList 在嵌套时返回最近的 list 父', () => {
    const innerItem: Block = {
      id: 'ii', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { indent: 1, listMarker: '-' }, children: [],
    };
    const innerList: Block = {
      id: 'il', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { ordered: false }, children: [innerItem],
    };
    const outerItem: Block = {
      id: 'oi', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { indent: 0, listMarker: '-' }, children: [innerList],
    };
    const outerList: Block = {
      id: 'ol', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { ordered: false }, children: [outerItem],
    };
    expect(findParentList([outerList], 'ii')?.id).toBe('il');
    expect(findParentList([outerList], 'oi')?.id).toBe('ol');
  });
});

describe('getNavigableBlocks recurse into listItem', () => {
  it('展平 list/listItem,只暴露 listItem.children 内的 paragraph', () => {
    const mkItem = (id: string, text: string): Block => ({
      id, type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { indent: 0, listMarker: '-' },
      children: [{ id: id + 'p', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: text }],
    });
    const list: Block = {
      id: 'l', type: 'list', sourceStartLine: 1, sourceEndLine: 2, markdown: '',
      meta: { ordered: false },
      children: [mkItem('i1', 'a'), mkItem('i2', 'b')],
    };
    const nav = getNavigableBlocks([list]);
    expect(nav.map((b) => b.id)).toEqual(['i1p', 'i2p']);
  });

  it('嵌套 list 也展平为最深 paragraph', () => {
    const mkItem = (id: string, text: string, extra: Block[] = []): Block => ({
      id, type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { indent: 0, listMarker: '-' },
      children: [
        { id: id + 'p', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: text },
        ...extra,
      ],
    });
    const nested: Block = {
      id: 'nl', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { ordered: false },
      children: [mkItem('ni', '嵌')],
    };
    const list: Block = {
      id: 'l', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { ordered: false },
      children: [
        mkItem('i1', '一'),
        mkItem('i2', '二', [nested]),
        mkItem('i3', '三'),
      ],
    };
    const nav = getNavigableBlocks([list]);
    expect(nav.map((b) => b.id)).toEqual(['i1p', 'i2p', 'nip', 'i3p']);
  });

  it('paragraph 外含 list,顶层 paragraph 与 list 内 paragraph 都暴露', () => {
    const top: Block = { id: 't', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'top' };
    const item: Block = {
      id: 'i', type: 'listItem', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { indent: 0, listMarker: '-' },
      children: [{ id: 'ip', type: 'paragraph', sourceStartLine: 1, sourceEndLine: 1, markdown: 'inner' }],
    };
    const list: Block = {
      id: 'l', type: 'list', sourceStartLine: 1, sourceEndLine: 1, markdown: '',
      meta: { ordered: false }, children: [item],
    };
    expect(getNavigableBlocks([top, list]).map((b) => b.id)).toEqual(['t', 'ip']);
  });
});
