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
      stripQuotePrefix(children, 1);
      return {
        id: genId('quote', sourceStartLine),
        type: 'quote',
        sourceStartLine,
        sourceEndLine,
        markdown,
        children,
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

function stripQuotePrefix(blocks: Block[], depth: number): void {
  for (const block of blocks) {
    block.markdown = block.markdown.split('\n').map((l) => l.replace(/^> ?/, '')).join('\n');
    block.meta = { ...block.meta, quoteDepth: (block.meta?.quoteDepth ?? 0) + depth };
    if (block.children) {
      stripQuotePrefix(block.children, depth);
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
