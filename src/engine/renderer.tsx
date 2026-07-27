import { memo, useRef } from 'react';
import { useBlocksStore } from '../stores/blocks';
import { useEditorStore } from '../stores/editor';
import { syncBlockEdit } from './sync';
import { BlockDisplay } from './block-display';
import { processInlinePatterns } from './rt-parser';
import { parseMarkdown } from './parser';
import type { Block } from './types';

// Exported for tests
export function codeInnerText(block: Block): string {
  const lines = block.markdown.split('\n');
  return lines.length <= 2 ? '' : lines.slice(1, -1).join('\n');
}
export function codeReconstructMd(block: Block, innerText: string): string {
  const lang = block.meta?.language ?? '';
  return '```' + lang + '\n' + innerText + '\n```';
}

function syncToStore(content: string, newContent: string) {
  if (newContent === content) return;
  useEditorStore.getState().setContentNoHistory(newContent);
  useBlocksStore.getState().setBlocks(parseMarkdown(newContent));
}

const WYSIWYG_TYPES = new Set(['paragraph', 'heading', 'quote', 'list', 'code', 'html']);
interface BlockProps { block: Block; }

const BlockComponent = memo(function BlockComponent({ block }: BlockProps) {
  const content = useEditorStore((s) => s.content);
  const setActiveBlock = useBlocksStore((s) => s.setActiveBlock);
  const isActive = useBlocksStore((s) => s.activeBlockId) === block.id;
  const contentRef = useRef<HTMLDivElement>(null);

  if (block.type === 'hr') return <hr className="my-4 border-zinc-300 dark:border-zinc-600" />;

  if (!WYSIWYG_TYPES.has(block.type)) return <BlockDisplay block={block} />;

  return (
    <div
      id={`block-${block.id}`} ref={contentRef}
      contentEditable suppressContentEditableWarning className="outline-none"
      onFocus={() => { if (!isActive) setActiveBlock(block.id); }}
      onInput={(e) => { processInlinePatterns(e.currentTarget as HTMLElement); }}
      onBlur={(e) => {
        const md = (e.target as HTMLElement).textContent ?? '';
        if (md === block.markdown) return;
        syncToStore(content, syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, md));
      }}
    >
      <BlockDisplay block={block} />
    </div>
  );
});

export const BlockRenderer = memo(function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return <>{blocks.map((block) => (<BlockComponent key={block.id} block={block} />))}</>;
});
