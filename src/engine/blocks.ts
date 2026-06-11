import type { Block } from './types';

export function displayText(block: Block): string {
  switch (block.type) {
    case 'heading':
      return block.markdown.replace(new RegExp(`^#{${block.level ?? 1}}\\s+`), '');
    case 'quote':
      return block.markdown.split('\n').map((l) => l.replace(/^>+\s?/, '')).join('\n');
    case 'code': {
      const lines = block.markdown.split('\n');
      return lines.length <= 2 ? '' : lines.slice(1, -1).join('\n');
    }
    case 'list':
      return (block.children ?? []).map(displayText).join('\n');
    case 'listItem': {
      const firstPara = block.children?.find((c) => c.type === 'paragraph');
      return firstPara ? firstPara.markdown : '';
    }
    default:
      return block.markdown;
  }
}

export function applyQuotePrefix(markdown: string, quoteDepth: number): string {
  const prefix = '> '.repeat(quoteDepth);
  return markdown.split('\n').map((l) => prefix + l).join('\n');
}

export function textToMarkdown(text: string, block: Block): string {
  switch (block.type) {
    case 'heading':
      return '#'.repeat(block.level ?? 1) + ' ' + text;
    case 'quote':
      return applyQuotePrefix(text, block.meta?.quoteDepth ?? 1);
    case 'code': {
      const lang = block.meta?.language ?? '';
      return '```' + lang + '\n' + text + '\n```';
    }
    default:
      return text;
  }
}

export function blockToMarkdown(text: string, block: Block): string {
  if (block.type === 'list') return listToMarkdown(block);
  if (block.type === 'listItem') return listItemToMarkdown(block, false, 1);
  const md = textToMarkdown(text, block);
  if (block.meta?.quoteDepth) {
    return applyQuotePrefix(md, block.meta.quoteDepth);
  }
  return md;
}

export function findBlockRecursive(blocks: Block[], id: string): Block | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.children) {
      const found = findBlockRecursive(block.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function findParentQuote(blocks: Block[], childId: string): Block | undefined {
  for (const block of blocks) {
    if (block.type === 'quote' && block.children) {
      if (block.children.some((c) => c.id === childId)) return block;
      const found = findParentQuote(block.children, childId);
      if (found) return found;
    }
  }
  return undefined;
}

export function flattenBlocks(blocks: Block[]): Block[] {
  const result: Block[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.children) {
      result.push(...flattenBlocks(block.children));
    }
  }
  return result;
}

export function findBlockAtLine(blocks: Block[], line: number): Block | undefined {
  for (const block of blocks) {
    if (block.children) {
      const found = findBlockAtLine(block.children, line);
      if (found) return found;
    }
    if (block.type !== 'quote' && block.sourceStartLine <= line && block.sourceEndLine >= line) return block;
  }
  return undefined;
}

export function getNavigableBlocks(blocks: Block[]): Block[] {
  const result: Block[] = [];
  for (const block of blocks) {
    if (block.type === 'quote' || block.type === 'list' || block.type === 'listItem') {
      if (block.children) result.push(...getNavigableBlocks(block.children));
    } else {
      result.push(block);
      if (block.children) result.push(...getNavigableBlocks(block.children));
    }
  }
  return result;
}

export function listItemToMarkdown(item: Block, ordered: boolean, ordinal: number): string {
  const indent = '  '.repeat(item.meta?.indent ?? 0);
  const rawMarker = item.meta?.listMarker ?? '-';
  const marker = ordered ? `${ordinal}. ` : `${rawMarker} `;
  const checked = item.meta?.checked;
  const taskPrefix = checked === undefined ? '' : (checked ? '[x] ' : '[ ] ');
  const markerPrefix = indent + marker + taskPrefix;

  const children = item.children ?? [];
  const firstIsPara = children[0]?.type === 'paragraph';
  const lines: string[] = [
    markerPrefix + (firstIsPara ? children[0].markdown : ''),
  ];
  children.forEach((child, idx) => {
    if (idx === 0 && firstIsPara) return; // 已经合入 marker 行
    if (child.type === 'list') {
      lines.push(listToMarkdown(child));
    } else {
      lines.push(child.markdown);
    }
  });
  return lines.join('\n');
}

export function listToMarkdown(list: Block): string {
  const ordered = list.meta?.ordered ?? false;
  return (list.children ?? [])
    .map((item, i) => listItemToMarkdown(item, ordered, i + 1))
    .join('\n');
}

export function findEnclosingListItem(blocks: Block[], targetId: string): Block | undefined {
  for (const block of blocks) {
    if (block.type === 'listItem') {
      if (block.id === targetId) return block;
      if (block.children?.some((c) => c.id === targetId)) return block;
      const deep = findEnclosingListItem(block.children ?? [], targetId);
      if (deep) return deep;
    } else if (block.children) {
      const found = findEnclosingListItem(block.children, targetId);
      if (found) return found;
    }
  }
  return undefined;
}

export function findParentList(blocks: Block[], listItemId: string): Block | undefined {
  for (const block of blocks) {
    if (block.type === 'list' && block.children?.some((c) => c.id === listItemId)) return block;
    if (block.children) {
      const found = findParentList(block.children, listItemId);
      if (found) return found;
    }
  }
  return undefined;
}
