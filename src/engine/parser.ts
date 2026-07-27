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

interface ParseOptions {
  deferBareShortcutMarkers?: boolean;
  quoteDepthBase?: number;
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

function shouldDeferBareShortcutMarker(content: string, node: AstNode, options: ParseOptions): boolean {
  if (!options.deferBareShortcutMarkers || node.type !== 'thematicBreak') return false;
  const markdown = extractMarkdown(content, node);
  const sourceEndOffset = node.position?.end?.offset;
  const trailing = sourceEndOffset === undefined ? '' : content.slice(sourceEndOffset);
  return isBareShortcutMarker(markdown) && (trailing === '' || trailing === '\n');
}

function shouldDeferBareHeadingMarker(content: string, node: AstNode, options: ParseOptions): boolean {
  if (!options.deferBareShortcutMarkers || node.type !== 'heading') return false;
  const markdown = extractMarkdown(content, node);
  const sourceEndOffset = node.position?.end?.offset;
  const trailing = sourceEndOffset === undefined ? '' : content.slice(sourceEndOffset);
  return /^#{1,6}$/.test(markdown) && /^\n*$/.test(trailing);
}

function shouldDeferBareCodeFence(content: string, node: AstNode, options: ParseOptions): boolean {
  if (!options.deferBareShortcutMarkers || node.type !== 'code') return false;
  const markdown = extractMarkdown(content, node);
  const sourceEndOffset = node.position?.end?.offset;
  const trailing = sourceEndOffset === undefined ? '' : content.slice(sourceEndOffset);
  return /^```[\w-]*\n*$/.test(markdown) && /^\n*$/.test(trailing);
}

function paragraphFromNode(type: string, sourceStartLine: number, sourceEndLine: number, markdown: string): Block {
  return {
    id: genId(type, sourceStartLine),
    type: 'paragraph',
    sourceStartLine,
    sourceEndLine,
    markdown,
  };
}

function isDashedSetextHeading(markdown: string): boolean {
  const lines = markdown.split('\n');
  if (lines.length < 2) return false;
  return isBareShortcutMarker(lines[lines.length - 1]);
}

function convertDashedSetextHeading(node: AstNode, content: string, options: ParseOptions): Block[] {
  const sourceStartLine = node.position?.start?.line ?? 1;
  const sourceEndLine = node.position?.end?.line ?? sourceStartLine;
  const sourceEndOffset = node.position?.end?.offset;
  const lines = extractMarkdown(content, node).split('\n');
  const markerLine = sourceEndLine;
  const marker = lines[lines.length - 1] ?? '';
  const textLines = lines.slice(0, -1);

  const blocks: Block[] = textLines.map((line, i) => ({
    id: genId('paragraph', sourceStartLine + i),
    type: 'paragraph',
    sourceStartLine: sourceStartLine + i,
    sourceEndLine: sourceStartLine + i,
    markdown: line,
  }));

  if (options.deferBareShortcutMarkers && sourceEndOffset === content.length) {
    blocks.push({
      id: genId('paragraph', markerLine),
      type: 'paragraph',
      sourceStartLine: markerLine,
      sourceEndLine: markerLine,
      markdown: marker,
    });
  } else {
    blocks.push({
      id: genId('hr', markerLine),
      type: 'hr',
      sourceStartLine: markerLine,
      sourceEndLine: markerLine,
      markdown: marker,
    });
  }

  return blocks;
}

function convertNode(node: AstNode, content: string, options: ParseOptions = {}): Block | Block[] | null {
  const pos = node.position;
  const sourceStartLine = pos?.start?.line ?? 1;
  const sourceEndLine = pos?.end?.line ?? 1;
  const markdown = extractMarkdown(content, node);

  switch (node.type) {
    case 'heading':
      if (shouldDeferBareHeadingMarker(content, node, options)) {
        return {
          id: genId('paragraph', sourceStartLine),
          type: 'paragraph',
          sourceStartLine,
          sourceEndLine,
          markdown,
        };
      }
      if (isDashedSetextHeading(markdown)) {
        return convertDashedSetextHeading(node, content, options);
      }
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
      if (shouldDeferBareCodeFence(content, node, options)) {
        return paragraphFromNode('paragraph', sourceStartLine, sourceEndLine, markdown);
      }
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
      if (options.deferBareShortcutMarkers && markdown === '>') {
        return paragraphFromNode('paragraph', sourceStartLine, sourceEndLine, markdown.trimEnd());
      }
      return {
        id: genId('quote', sourceStartLine),
        type: 'quote',
        sourceStartLine,
        sourceEndLine,
        markdown,
        children: parseBlockquoteLines(lines, sourceStartLine, options.quoteDepthBase ?? 0, options),
      };
    }
    case 'list': {
      if (options.deferBareShortcutMarkers && /^(\s*)([-*+]|\d+\.)$/.test(markdown)) {
        return paragraphFromNode('paragraph', sourceStartLine, sourceEndLine, markdown);
      }
      const meta: BlockMeta = { ordered: node.ordered ?? false };
      const children = (node.children ?? []).map((item) => convertListItem(item, content, options));
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
      if (shouldDeferBareShortcutMarker(content, node, options)) {
        return {
          id: genId('paragraph', sourceStartLine),
          type: 'paragraph',
          sourceStartLine,
          sourceEndLine,
          markdown,
        };
      }
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

function convertListItem(node: AstNode, content: string, options: ParseOptions = {}): Block {
  const pos = node.position;
  const sourceStartLine = pos?.start?.line ?? 1;
  const sourceEndLine = pos?.end?.line ?? 1;
  const startColumn = pos?.start?.column ?? 1;
  const markdown = extractMarkdown(content, node);

  const firstLine = markdown.split('\n')[0] ?? '';
  const m = firstLine.match(/^(\s*)([-*+]|\d+\.)\s/);
  const indent = Math.floor(Math.max(0, startColumn - 1) / 2);
  const listMarker = m?.[2] ?? '-';

  const children = node.children ? convertNodes(node.children, content, options) : [];
  if (children.length === 0) {
    children.push({
      id: genId('paragraph', sourceStartLine),
      type: 'paragraph',
      sourceStartLine,
      sourceEndLine,
      markdown: '',
    });
  }
  const checked = (node as AstNode & { checked?: boolean | null }).checked;
  const meta: BlockMeta = { indent, listMarker };
  if (checked === true || checked === false) meta.checked = checked;
  const emptyTask = firstLine.match(/^(\s*)([-*+]|\d+\.)\s+\[([ xX])\](\s*)$/);
  if (emptyTask && (!options.deferBareShortcutMarkers || emptyTask[4].length > 0)) {
    meta.checked = emptyTask[3].toLowerCase() === 'x';
    if (children.length > 0) {
      children[0] = {
        ...children[0],
        type: 'paragraph',
        markdown: '',
      };
    }
  }

  return {
    id: genId('listItem', sourceStartLine),
    type: 'listItem',
    sourceStartLine,
    sourceEndLine,
    markdown,
    meta,
    children,
  };
}

function stripOneQuotePrefix(line: string): string {
  return line.replace(/^> ?/, '');
}

function stripQuotePrefixes(line: string, depth: number): string {
  let stripped = line;
  for (let i = 0; i < depth; i++) {
    stripped = stripOneQuotePrefix(stripped);
  }
  return stripped;
}

function countQuoteDepth(line: string): number {
  let depth = 0;
  let rest = line;
  while (rest.startsWith('>')) {
    depth++;
    rest = rest.slice(1);
    if (rest.startsWith(' ')) rest = rest.slice(1);
  }
  return depth;
}

function remapQuotedBlock(block: Block, lineMap: number[], quoteDepth: number): Block {
  const remapLine = (line: number): number => lineMap[line - 1] ?? line;
  const sourceStartLine = remapLine(block.sourceStartLine);
  const sourceEndLine = remapLine(block.sourceEndLine);
  const children = block.children?.map((child) => remapQuotedBlock(child, lineMap, quoteDepth));

  return {
    ...block,
    id: genId(block.type, sourceStartLine),
    sourceStartLine,
    sourceEndLine,
    ...(children ? { children } : {}),
    meta: {
      ...block.meta,
      quoteDepth: block.type === 'quote' ? quoteDepth : block.meta?.quoteDepth ?? quoteDepth,
    },
  };
}

function parseQuotedSegment(lines: string[], startLine: number, quoteDepth: number, options: ParseOptions): Block[] {
  const lineMap = lines.map((_, i) => startLine + i);
  const innerContent = lines.map((line) => stripQuotePrefixes(line, quoteDepth)).join('\n');
  const innerLines = innerContent.split('\n');
  const tree = processor.parse(innerContent) as unknown as { children: AstNode[] };
  const innerBlocks = splitParagraphLinesForRawLines(
    convertNodes(tree.children, innerContent, { ...options, quoteDepthBase: quoteDepth }),
    innerLines,
  );
  return innerBlocks.map((block) => remapQuotedBlock(block, lineMap, quoteDepth));
}

function parseBlockquoteLines(
  lines: string[],
  startLine: number,
  depthBase: number,
  options: ParseOptions,
): Block[] {
  const quoteDepth = depthBase + 1;
  const children: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const depth = countQuoteDepth(lines[i]);

    if (depth === quoteDepth) {
      const segmentStart = i;
      i++;
      while (i < lines.length && countQuoteDepth(lines[i]) === quoteDepth) {
        i++;
      }
      children.push(...parseQuotedSegment(
        lines.slice(segmentStart, i),
        startLine + segmentStart,
        quoteDepth,
        options,
      ));
      continue;
    }

    if (depth > quoteDepth) {
      const segmentStart = i;
      i++;
      while (i < lines.length && countQuoteDepth(lines[i]) > quoteDepth) {
        i++;
      }
      const lineNum = startLine + segmentStart;
      const nestedLines = lines.slice(segmentStart, i);
      children.push({
        id: genId('quote', lineNum),
        type: 'quote' as const,
        sourceStartLine: lineNum,
        sourceEndLine: startLine + i - 1,
        markdown: nestedLines.join('\n'),
        children: parseBlockquoteLines(nestedLines, lineNum, quoteDepth, options),
        meta: { quoteDepth: quoteDepth + 1 },
      });
      continue;
    }

    i++;
  }

  if (children.length > 0) return children;

  return [{
    id: genId('paragraph', startLine),
    type: 'paragraph' as const,
    sourceStartLine: startLine,
    sourceEndLine: startLine,
    markdown: '',
    meta: { quoteDepth },
  }];
}

function convertNodes(nodes: AstNode[], content: string, options: ParseOptions = {}): Block[] {
  return nodes.flatMap((n) => {
    const block = convertNode(n, content, options);
    if (!block) return [];
    return Array.isArray(block) ? block : [block];
  });
}

interface MarkdownProcessor {
  use(plugin: unknown): MarkdownProcessor;
  parse(content: string): unknown;
}

// Multiple unified versions co-exist through editor dependencies.
// Runtime behavior is identical; keep a narrow unknown boundary for plugin typing.
const createProcessor = unified as unknown as () => MarkdownProcessor;
const processor = createProcessor().use(remarkParse).use(remarkGfm);

function normalizeLines(content: string): string[] {
  const lines = content.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

function splitParagraphLines(blocks: Block[], content: string): Block[] {
  const lines = normalizeLines(content);
  if (lines.length === 0) return blocks;
  return splitParagraphLinesForRawLines(blocks, lines);
}

function splitParagraphLinesForRawLines(blocks: Block[], lines: string[]): Block[] {
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

function isBareShortcutMarker(content: string): boolean {
  return content === '---' || content === '***';
}

export function parseMarkdown(content: string, options: ParseOptions = {}): Block[] {
  if (content.length === 0) return [];
  const tree = processor.parse(content) as unknown as { children: AstNode[] };
  const blocks = convertNodes(tree.children, content, options);
  return splitParagraphLines(blocks, content);
}
