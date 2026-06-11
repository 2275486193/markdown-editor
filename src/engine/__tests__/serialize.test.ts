import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../parser';
import { serializeBlocks, serializeBlocksWithLineMap } from '../serialize';

describe('serializeBlocks', () => {
  it('单一 paragraph round-trip', () => {
    const md = 'hello';
    expect(serializeBlocks(parseMarkdown(md))).toBe('hello');
  });

  it('paragraph + list round-trip', () => {
    const md = 'hello\n\n- a\n- b';
    expect(serializeBlocks(parseMarkdown(md))).toBe(md);
  });

  it('嵌套列表 round-trip 规范化为 2 空格', () => {
    const md = '- 第一项\n- 第二项\n  - 嵌套 A\n  - 嵌套 B\n- 第三项';
    expect(serializeBlocks(parseMarkdown(md))).toBe(md);
  });

  it('有序列表序号 round-trip 从 1 起', () => {
    const blocks = parseMarkdown('5. a\n6. b\n7. c');
    expect(serializeBlocks(blocks)).toBe('1. a\n2. b\n3. c');
  });
});

describe('serializeBlocksWithLineMap', () => {
  it('lineMap 记录每个 listItem 起始行号', () => {
    const blocks = parseMarkdown('- a\n- b\n  - c');
    const { content, lineMap } = serializeBlocksWithLineMap(blocks);
    expect(content).toBe('- a\n- b\n  - c');
    const list = blocks[0];
    const item0 = list.children![0];
    const item1 = list.children![1];
    expect(lineMap.get(item0.id)).toBe(1);
    expect(lineMap.get(item1.id)).toBe(2);
    const nestedItem = item1.children![1].children![0];
    expect(lineMap.get(nestedItem.id)).toBe(3);
  });

  it('paragraph 在 list 之前时,后续行号偏移正确', () => {
    const blocks = parseMarkdown('hello\n\n- a\n- b');
    const { content, lineMap } = serializeBlocksWithLineMap(blocks);
    expect(content).toBe('hello\n\n- a\n- b');
    const list = blocks.find((b) => b.type === 'list')!;
    expect(lineMap.get(list.children![0].id)).toBe(3);
    expect(lineMap.get(list.children![1].id)).toBe(4);
  });
});
