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
      return block.markdown.split('\n')
        .map((l) => l.replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/, '$1')
          .replace(/^(\s*)[-*+]\s+/, '$1')
          .replace(/^(\s*)\d+\.\s+/, '$1'))
        .join('\n');
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
    case 'list': {
      const prefix = block.meta?.ordered ? '1. ' : '- ';
      return text.split('\n').map((l) => {
        const m = l.match(/^(\s*)/);
        const indent = m?.[0] ?? '';
        return indent + prefix + l.slice(indent.length);
      }).join('\n');
    }
    default:
      return text;
  }
}

export function blockToMarkdown(text: string, block: Block): string {
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
    if (block.type !== 'quote') {
      result.push(block);
    }
    if (block.children) {
      result.push(...getNavigableBlocks(block.children));
    }
  }
  return result;
}
