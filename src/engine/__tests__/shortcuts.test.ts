import { describe, it, expect } from 'vitest';
import { tryTrigger } from '../shortcuts';
import type { Block } from '../types';

function paragraphBlock(markdown: string, line = 1): Block {
  return {
    id: 'b1',
    type: 'paragraph',
    sourceStartLine: line,
    sourceEndLine: line,
    markdown,
  };
}

describe('heading trigger', () => {
  it('# 触发 h1', () => {
    const block = paragraphBlock('#');
    const patch = tryTrigger({
      content: '#',
      block,
      lineInBlock: 0,
      prefix: '#',
    });
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBe('# ');
    expect(patch!.newCaret.offset).toBe(0);
  });

  it('### 触发 h3', () => {
    const block = paragraphBlock('###');
    const patch = tryTrigger({
      content: '###',
      block,
      lineInBlock: 0,
      prefix: '###',
    });
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBe('### ');
  });

  it('####### 不触发(超过 6 级)', () => {
    const block = paragraphBlock('#######');
    const patch = tryTrigger({
      content: '#######',
      block,
      lineInBlock: 0,
      prefix: '#######',
    });
    expect(patch).toBeNull();
  });

  it('paragraph 行中 # 不触发(prefix 必须从 ^)', () => {
    const block = paragraphBlock('foo #');
    const patch = tryTrigger({
      content: 'foo #',
      block,
      lineInBlock: 0,
      prefix: 'foo #',
    });
    expect(patch).toBeNull();
  });

  it('heading 块上 # 不再触发(block guard)', () => {
    const block: Block = {
      id: 'h1',
      type: 'heading',
      level: 1,
      sourceStartLine: 1,
      sourceEndLine: 1,
      markdown: '# foo',
    };
    const patch = tryTrigger({
      content: '# foo',
      block,
      lineInBlock: 0,
      prefix: '# foo #',
    });
    expect(patch).toBeNull();
  });
});

describe('unordered list trigger', () => {
  it('- 触发无序列表', () => {
    const block = paragraphBlock('-');
    const patch = tryTrigger({
      content: '-',
      block,
      lineInBlock: 0,
      prefix: '-',
    });
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBe('- ');
  });

  it('* 触发无序列表', () => {
    const block = paragraphBlock('*');
    const patch = tryTrigger({
      content: '*',
      block,
      lineInBlock: 0,
      prefix: '*',
    });
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBe('* ');
  });

  it('+ 触发无序列表', () => {
    const block = paragraphBlock('+');
    const patch = tryTrigger({
      content: '+',
      block,
      lineInBlock: 0,
      prefix: '+',
    });
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBe('+ ');
  });
});

describe('ordered list trigger', () => {
  it('1. 触发有序列表', () => {
    const block = paragraphBlock('1.');
    const patch = tryTrigger({
      content: '1.',
      block,
      lineInBlock: 0,
      prefix: '1.',
    });
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBe('1. ');
  });

  it('3. 保留起始数字', () => {
    const block = paragraphBlock('3.');
    const patch = tryTrigger({
      content: '3.',
      block,
      lineInBlock: 0,
      prefix: '3.',
    });
    expect(patch).not.toBeNull();
    expect(patch!.newContent).toBe('3. ');
  });

  it('1.5 不触发(必须严格 \\d+\\.)', () => {
    const block = paragraphBlock('1.5');
    const patch = tryTrigger({
      content: '1.5',
      block,
      lineInBlock: 0,
      prefix: '1.5',
    });
    expect(patch).toBeNull();
  });
});
