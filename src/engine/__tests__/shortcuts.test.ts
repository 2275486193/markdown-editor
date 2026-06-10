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
