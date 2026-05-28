import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Block, BlockMeta } from './types';

interface AstNode {
  type: string;
  depth?: number;
  lang?: string | null;
  ordered?: boolean;
  children?: AstNode[];
  position?: {
    start?: { line?: number; column?: number; offset?: number };
    end?: { line?: number; column?: number; offset?: number };
  };
  value?: string;
}

function genId(type: string, startLine: number): string {
  return `${type}-${startLine}`;
}

function extractMarkdown(content: string, node: AstNode): string {
  // Offset-based: more precise for leaf nodes (paragraphs in list items, etc.)
  const so = node.position?.start?.offset;
  const eo = node.position?.end?.offset;
  if (so !== undefined && eo !== undefined && so < eo) return content.slice(so, eo);
  // Line-based fallback: reliable for multi-line structural nodes
  const sl = node.position?.start?.line;
  const el = node.position?.end?.line;
  if (sl !== undefined && el !== undefined) {
    const lines = content.split('\n');
    return lines.slice(sl - 1, el).join('\n');
  }
  return '';
}

function convertNode(node: AstNode, content: string): Block | null {
  const pos = node.position;
  const sourceStartLine = pos?.start?.line ?? 1;
  const sourceEndLine = pos?.end?.line ?? 1;
  const markdown = extractMarkdown(content, node);

  switch (node.type) {
    case 'heading':
      return {
        id: genId('heading', sourceStartLine),
        type: 'heading',
        level: node.depth,
        sourceStartLine,
        sourceEndLine,
        markdown,
      };
    case 'paragraph':
      return {
        id: genId('paragraph', sourceStartLine),
        type: 'paragraph',
        sourceStartLine,
        sourceEndLine,
        markdown: markdown || '',
      };
    case 'code':
      return {
        id: genId('code', sourceStartLine),
        type: 'code',
        sourceStartLine,
        sourceEndLine,
        markdown,
        meta: { language: node.lang ?? undefined },
      };
    case 'blockquote': {
      const children = convertNodes(node.children ?? [], content);
      const gapBlock = { children, sourceStartLine, sourceEndLine };
      fillQuoteGaps(gapBlock as Block, content);
      stripQuotePrefix(gapBlock.children, 1, true);
      const block: Block = {
        id: genId('quote', sourceStartLine),
        type: 'quote',
        sourceStartLine,
        sourceEndLine,
        markdown,
        children: gapBlock.children,
      };
      splitMixedDepthChildren(block, content);
      trimTrailingBlankLines(block, content);
      splitSameDepthParagraphs(block, content);
      return block;
    }
    case 'list': {
      const meta: BlockMeta = { ordered: node.ordered ?? false };
      const children = (node.children ?? [])
        .map((item) => convertListItem(item, content))
        .filter((b): b is Block => b !== null);
      return {
        id: genId('list', sourceStartLine),
        type: 'list',
        sourceStartLine,
        sourceEndLine,
        markdown,
        meta,
        children,
      };
    }
    case 'thematicBreak':
      return { id: genId('hr', sourceStartLine), type: 'hr', sourceStartLine, sourceEndLine, markdown };
    case 'html':
      return { id: genId('html', sourceStartLine), type: 'html', sourceStartLine, sourceEndLine, markdown };
    case 'table':
      return { id: genId('table', sourceStartLine), type: 'table', sourceStartLine, sourceEndLine, markdown };
    default:
      return null;
  }
}

function convertListItem(node: AstNode, content: string): Block | null {
  const pos = node.position;
  const sourceStartLine = pos?.start?.line ?? 1;
  const sourceEndLine = pos?.end?.line ?? 1;
  const markdown = extractMarkdown(content, node);

  if (node.children && node.children.length === 1 && node.children[0].type === 'paragraph') {
    const p = node.children[0];
    const pStartLine = p.position?.start?.line ?? sourceStartLine;
    return {
      id: genId('paragraph', pStartLine),
      type: 'paragraph',
      sourceStartLine,
      sourceEndLine,
      markdown: extractMarkdown(content, p),
    };
  }

  // Complex: multiple children or non-paragraph → preserve all children
  const children = node.children ? convertNodes(node.children, content) : [];
  return { id: genId('paragraph', sourceStartLine), type: 'paragraph', sourceStartLine, sourceEndLine, markdown, children };
}

function stripLinePrefixes(line: string): string {
  return line.replace(/^(> ?)+/, '');
}

function splitMixedDepthChildren(block: Block, content: string): void {
  if (!block.children) return;

  const contentLines = content.split('\n');
  const result: Block[] = [];

  for (const child of block.children) {
    result.push(child);

    if (child.sourceEndLine <= child.sourceStartLine) {
      if (child.children) splitMixedDepthChildren(child, content);
      continue;
    }

    const firstDepth = countQuoteDepth(contentLines[child.sourceStartLine - 1] ?? '');
    let lastGoodLine = child.sourceStartLine;

    for (let l = child.sourceStartLine + 1; l <= child.sourceEndLine; l++) {
      if (countQuoteDepth(contentLines[l - 1] ?? '') < firstDepth) break;
      lastGoodLine = l;
    }

    if (lastGoodLine < child.sourceEndLine) {
      // Depth decrease detected within child: trim and lift excess lines
      const originalEnd = child.sourceEndLine;
      child.sourceEndLine = lastGoodLine;
      child.markdown = contentLines
        .slice(child.sourceStartLine - 1, lastGoodLine)
        .map((l) => stripLinePrefixes(l))
        .join('\n');

      if (child.children) {
        child.children = child.children.filter((c) => c.sourceStartLine <= lastGoodLine);
        for (const c of child.children) {
          if (c.sourceEndLine > lastGoodLine) {
            c.sourceEndLine = lastGoodLine;
            c.markdown = contentLines
              .slice(c.sourceStartLine - 1, lastGoodLine)
              .map((l) => stripLinePrefixes(l))
              .join('\n');
          }
        }
        splitMixedDepthChildren(child, content);
      }

      // Lift trimmed lines as new children at this level
      for (let l = lastGoodLine + 1; l <= originalEnd; l++) {
        const line = contentLines[l - 1] ?? '';
        const depth = countQuoteDepth(line);
        result.push({
          id: genId('paragraph', l),
          type: 'paragraph' as const,
          sourceStartLine: l,
          sourceEndLine: l,
          markdown: stripLinePrefixes(line),
          meta: { quoteDepth: depth },
        });
      }
    } else {
      if (child.children) splitMixedDepthChildren(child, content);
    }
  }

  block.children = result;
}

function countQuoteDepth(line: string): number {
  const match = line.match(/^(> ?)+/);
  if (!match) return 1;
  return (match[0].match(/>/g) ?? []).length;
}

function trimTrailingBlankLines(block: Block, content: string): void {
  if (!block.children) return;

  const contentLines = content.split('\n');

  for (const child of block.children) {
    if (child.type !== 'paragraph') {
      if (child.children) trimTrailingBlankLines(child, content);
      continue;
    }
    if (child.sourceEndLine <= child.sourceStartLine) continue;

    // Check if the last line of this multi-line paragraph is an empty ">+" line
    const lastLine = contentLines[child.sourceEndLine - 1] ?? '';
    const depth = countQuoteDepth(lastLine);
    if (depth === 0) continue;

    const textAfterPrefix = lastLine.replace(/^> ?/, '');
    if (textAfterPrefix !== '') continue;

    // Last line is an empty continued quote line: trim it
    child.sourceEndLine--;
    child.markdown = contentLines
      .slice(child.sourceStartLine - 1, child.sourceEndLine)
      .map((l) => stripLinePrefixes(l))
      .join('\n');
  }
}

function splitSameDepthParagraphs(block: Block, content: string): void {
  if (!block.children) return;

  const contentLines = content.split('\n');
  const result: Block[] = [];

  for (const child of block.children) {
    if (child.type !== 'paragraph' || child.sourceEndLine <= child.sourceStartLine) {
      result.push(child);
      if (child.children) splitSameDepthParagraphs(child, content);
      continue;
    }

    // Check if all lines have the same ">" depth
    let allSameDepth = true;
    const firstDepth = countQuoteDepth(contentLines[child.sourceStartLine - 1] ?? '');
    for (let l = child.sourceStartLine + 1; l <= child.sourceEndLine; l++) {
      if (countQuoteDepth(contentLines[l - 1] ?? '') !== firstDepth) {
        allSameDepth = false;
        break;
      }
    }

    if (allSameDepth) {
      // Split into single-line paragraphs
      for (let l = child.sourceStartLine; l <= child.sourceEndLine; l++) {
        result.push({
          id: genId('paragraph', l),
          type: 'paragraph' as const,
          sourceStartLine: l,
          sourceEndLine: l,
          markdown: stripLinePrefixes(contentLines[l - 1] ?? ''),
        });
      }
    } else {
      result.push(child);
    }
  }

  block.children = result;
}

function fillQuoteGaps(block: Block, content: string): void {
  if (!block.children) return;

  const result: Block[] = [];
  let expectedLine = block.sourceStartLine;

  for (const child of block.children) {
    while (expectedLine < child.sourceStartLine) {
      result.push({
        id: genId('paragraph', expectedLine),
        type: 'paragraph' as const,
        sourceStartLine: expectedLine,
        sourceEndLine: expectedLine,
        markdown: '',
      });
      expectedLine++;
    }
    result.push(child);
    expectedLine = child.sourceEndLine + 1;

    if (child.type === 'quote') {
      fillQuoteGaps(child, content);
    }
  }

  while (expectedLine <= block.sourceEndLine) {
    result.push({
      id: genId('paragraph', expectedLine),
      type: 'paragraph' as const,
      sourceStartLine: expectedLine,
      sourceEndLine: expectedLine,
      markdown: '',
    });
    expectedLine++;
  }

  if (result.length === 0) {
    result.push({
      id: genId('paragraph', block.sourceStartLine),
      type: 'paragraph' as const,
      sourceStartLine: block.sourceStartLine,
      sourceEndLine: block.sourceEndLine,
      markdown: '',
    });
  }

  block.children = result;
}

function stripQuotePrefix(blocks: Block[], depth: number, strip: boolean): void {
  for (const block of blocks) {
    if (strip) {
      block.markdown = block.markdown.split('\n').map((l) => l.replace(/^> ?/, '')).join('\n');
    }
    block.meta = { ...block.meta, quoteDepth: (block.meta?.quoteDepth ?? 0) + depth };
    if (block.children) {
      stripQuotePrefix(block.children, block.type === 'quote' ? 1 : 0, block.type === 'quote');
    }
  }
}

function convertNodes(nodes: AstNode[], content: string): Block[] {
  return nodes.map((n) => convertNode(n, content)).filter((b): b is Block => b !== null);
}

// Multiple unified versions co-exist (milkdown 11.0.5, react-markdown 11.0.3, remark-parse 11.0.0).
// Runtime behavior is identical; cast to avoid TS seeing them as incompatible types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processor = (unified as any)().use(remarkParse).use(remarkGfm);

export function parseMarkdown(content: string): Block[] {
  if (!content.trim()) return [];
  const tree = processor.parse(content) as unknown as { children: AstNode[] };
  return convertNodes(tree.children, content);
}
