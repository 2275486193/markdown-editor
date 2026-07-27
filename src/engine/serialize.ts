import type { Block } from './types';
import { listItemToMarkdown } from './blocks';

export interface SerializeResult {
  content: string;
  lineMap: Map<string, number>;
}

function serializeBlock(block: Block): string {
  switch (block.type) {
    case 'list':
      return serializeList(block);
    case 'listItem':
      return listItemToMarkdown(block, false, 1);
    default:
      return block.markdown;
  }
}

function serializeList(list: Block): string {
  const ordered = list.meta?.ordered ?? false;
  return (list.children ?? [])
    .map((item, i) => listItemToMarkdown(item, ordered, i + 1))
    .join('\n');
}

export function serializeBlocks(blocks: Block[]): string {
  // 顶层块以单 \n 拼接;空段落本身就是空行,自然贡献空白行间隔
  return blocks.map(serializeBlock).join('\n');
}

function walkListForMap(
  list: Block,
  startLine: number,
  ordered: boolean,
  lineMap: Map<string, number>,
): { text: string } {
  const itemTexts: string[] = [];
  let cursor = startLine;
  (list.children ?? []).forEach((item, i) => {
    lineMap.set(item.id, cursor);
    const indent = '  '.repeat(item.meta?.indent ?? 0);
    const marker = ordered ? `${i + 1}. ` : `${item.meta?.listMarker ?? '-'} `;
    const checked = item.meta?.checked;
    const taskPrefix = checked === undefined ? '' : (checked ? '[x] ' : '[ ] ');
    const markerPrefix = indent + marker + taskPrefix;

    const children = item.children ?? [];
    const firstIsPara = children[0]?.type === 'paragraph';
    const lines: string[] = [
      markerPrefix + (firstIsPara ? children[0].markdown : ''),
    ];
    children.forEach((child, idx) => {
      if (idx === 0 && firstIsPara) return;
      if (child.type === 'list') {
        const subStart = cursor + lines.length;
        const sub = walkListForMap(child, subStart, child.meta?.ordered ?? false, lineMap);
        lines.push(sub.text);
      } else {
        lines.push(child.markdown);
      }
    });
    const itemText = lines.join('\n');
    itemTexts.push(itemText);
    cursor += itemText.split('\n').length;
  });
  return { text: itemTexts.join('\n') };
}

export function serializeBlocksWithLineMap(blocks: Block[]): SerializeResult {
  const lineMap = new Map<string, number>();
  const parts: string[] = [];
  let cursor = 1;
  blocks.forEach((block, idx) => {
    if (idx > 0) cursor += 1; // 块间单 \n
    if (block.type === 'list') {
      const { text } = walkListForMap(block, cursor, block.meta?.ordered ?? false, lineMap);
      parts.push(text);
      cursor += text.split('\n').length - 1;
    } else {
      parts.push(block.markdown);
      cursor += block.markdown.split('\n').length - 1;
    }
  });
  return { content: parts.join('\n'), lineMap };
}
