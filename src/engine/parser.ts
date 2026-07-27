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
      const lines = markdown.split('\n');
      return {
        id: genId('quote', sourceStartLine),
        type: 'quote',
        sourceStartLine,
        sourceEndLine,
        markdown,
        children: parseBlockquoteLines(lines, sourceStartLine, 0),
      };
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
      return {
        id: genId('table', sourceStartLine),
        type: 'table',
        sourceStartLine,
        sourceEndLine,
        markdown,
        meta: parseTableMeta(markdown),
      };
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

function countQuoteDepth(line: string): number {
  const match = line.match(/^(> ?)+/);
  if (!match) return 0;
  return (match[0].match(/>/g) ?? []).length;
}

function parseBlockquoteLines(
  lines: string[],
  startLine: number,
  parentDepth: number,
): Block[] {
  const currentDepth = parentDepth + 1;
  const children: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const depth = countQuoteDepth(line);

    if (depth <= parentDepth) break;

    const lineNum = startLine + i;

    if (depth === currentDepth) {
      const text = stripLinePrefixes(line);
      children.push({
        id: genId('paragraph', lineNum),
        type: 'paragraph' as const,
        sourceStartLine: lineNum,
        sourceEndLine: lineNum,
        markdown: text || '',
        meta: { quoteDepth: currentDepth },
      });
      i++;
    } else {
      // Nested quote: depth > currentDepth
      let end = i + 1;
      while (end < lines.length && countQuoteDepth(lines[end]) >= depth) {
        end++;
      }
      const nestedMd = lines.slice(i, end).join('\n');
      children.push({
        id: genId('quote', lineNum),
        type: 'quote' as const,
        sourceStartLine: lineNum,
        sourceEndLine: startLine + end - 1,
        markdown: nestedMd,
        children: parseBlockquoteLines(lines.slice(i, end), lineNum, currentDepth),
        meta: { quoteDepth: currentDepth },
      });
      i = end;
    }
  }

  if (children.length === 0) {
    children.push({
      id: genId('paragraph', startLine),
      type: 'paragraph' as const,
      sourceStartLine: startLine,
      sourceEndLine: startLine,
      markdown: '',
      meta: { quoteDepth: currentDepth },
    });
  }

  return children;
}

function convertNodes(nodes: AstNode[], content: string): Block[] {
  return nodes.map((n) => convertNode(n, content)).filter((b): b is Block => b !== null);
}

// Multiple unified versions co-exist (milkdown 11.0.5, react-markdown 11.0.3, remark-parse 11.0.0).
// Runtime behavior is identical; cast to avoid TS seeing them as incompatible types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processor = (unified as any)().use(remarkParse).use(remarkGfm);

function normalizeLines(content: string): string[] {
  const lines = content.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

function splitParagraphLines(blocks: Block[], content: string): Block[] {
  if (blocks.length === 0) return blocks;
  const lines = normalizeLines(content);

  const structuralLines = new Set<number>();
  const structuralStartMap = new Map<number, Block>();

  for (const block of blocks) {
    if (block.type !== 'paragraph') {
      structuralStartMap.set(block.sourceStartLine, block);
      for (let l = block.sourceStartLine; l <= block.sourceEndLine; l++) {
        structuralLines.add(l);
      }
    }
  }

  const paraTextByLine = new Map<number, string>();
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      const paraLines = block.markdown.split('\n');
      for (let i = 0; i < paraLines.length; i++) {
        paraTextByLine.set(block.sourceStartLine + i, paraLines[i]);
      }
    }
  }

  const result: Block[] = [];

  for (let line = 1; line <= lines.length; line++) {
    if (structuralLines.has(line)) {
      if (structuralStartMap.has(line)) {
        result.push(structuralStartMap.get(line)!);
      }
      continue;
    }

    const md = paraTextByLine.get(line) ?? (lines[line - 1] ?? '');
    result.push({
      id: genId('paragraph', line),
      type: 'paragraph' as const,
      sourceStartLine: line,
      sourceEndLine: line,
      markdown: md,
    });
  }

  return result;
}

function parseTableMeta(markdown: string): BlockMeta {
  const lines = markdown.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return {};

  const splitCells = (line: string): string[] => {
    const trimmed = line.replace(/^\||\|$/g, '');
    const parts: string[] = [];
    let buf = '';
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '\\' && trimmed[i + 1] === '|') {
        buf += '\\|';
        i++;
      } else if (trimmed[i] === '|') {
        parts.push(buf.trim());
        buf = '';
      } else {
        buf += trimmed[i];
      }
    }
    parts.push(buf.trim());
    return parts;
  };

  const header = splitCells(lines[0]);
  const alignLine = splitCells(lines[1]);
  const align = alignLine.map((c): 'left' | 'center' | 'right' | null => {
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) return 'center';
    if (left) return 'left';
    if (right) return 'right';
    return null;
  });
  const body = lines.slice(2).map(splitCells);
  const cells = [header, ...body];

  return {
    cells,
    align,
    rowCount: cells.length,
    colCount: header.length,
  };
}

export function parseMarkdown(content: string): Block[] {
  if (!content.trim()) return [];
  const tree = processor.parse(content) as unknown as { children: AstNode[] };
  const blocks = convertNodes(tree.children, content);
  return splitParagraphLines(blocks, content);
}
