import { describe, it, expect } from 'vitest';
import { renumberOrderedList } from '../keyboard/list';

describe('renumberOrderedList', () => {
  it('简单列表从 1. 起重排', () => {
    const content = '1. a\n3. b\n5. c';
    const result = renumberOrderedList(content, 1, 3);
    expect(result).toBe('1. a\n2. b\n3. c');
  });

  it('保留起始数字', () => {
    const content = '5. a\n9. b\n12. c';
    const result = renumberOrderedList(content, 1, 3);
    expect(result).toBe('5. a\n6. b\n7. c');
  });

  it('嵌套子列表独立计数', () => {
    const content = '1. a\n  1. nested\n  3. nested2\n2. b';
    const result = renumberOrderedList(content, 1, 4);
    expect(result).toBe('1. a\n  1. nested\n  2. nested2\n2. b');
  });

  it('混入非列表行(子列表 paragraph)不重排', () => {
    const content = '1. a\nplain\n2. b';
    const result = renumberOrderedList(content, 1, 3);
    expect(result).toBe('1. a\nplain\n2. b');
  });

  it('中间删除项后重排', () => {
    const content = '1. a\n3. c';
    const result = renumberOrderedList(content, 1, 2);
    expect(result).toBe('1. a\n2. c');
  });
});
