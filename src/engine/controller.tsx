import { useMemo } from 'react';
import { useBlocksStore } from '../stores/blocks';
import { useEditorStore } from '../stores/editor';
import { parseMarkdown } from './parser';

export function useBlockSync() {
  const content = useEditorStore((s) => s.content);
  const blocks = useBlocksStore((s) => s.blocks);
  const setActiveBlock = useBlocksStore((s) => s.setActiveBlock);
  const setBlocks = useBlocksStore((s) => s.setBlocks);
  const activeBlockId = useBlocksStore((s) => s.activeBlockId);

  useMemo(() => {
    const parsed = parseMarkdown(content);
    setBlocks(parsed);
  }, [content, setBlocks]);

  return { blocks, activeBlockId, setActiveBlock };
}
