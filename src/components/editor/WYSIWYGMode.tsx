import { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '../../stores/editor';
import { useBlocksStore } from '../../stores/blocks';
import { useUiStore } from '../../stores/ui';
import { parseMarkdown } from '../../engine/parser';
import { BlockRenderer } from '../../engine/renderer';
import { HiddenTextarea } from './HiddenTextarea';
import { pointFromCaret, segFromPoint } from '../../engine/caret';
import { syncBlockEdit } from '../../engine/sync';
import type { Block } from '../../engine/types';

let savedScrollTop = 0;

// ── block display ↔ markdown helpers ──

function displayText(block: Block): string {
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

function textToMarkdown(text: string, block: Block): string {
  switch (block.type) {
    case 'heading':
      return '#'.repeat(block.level ?? 1) + ' ' + text;
    case 'quote':
      return text.split('\n').map((l) => '> ' + l).join('\n');
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

// ── caret state (ephemeral, not in store) ──

let caretBlockId: string | null = null;
let caretOffset = 0;

export function WYSIWYGMode() {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const fontSize = useUiStore((s) => s.fontSize);
  const setBlocks = useBlocksStore((s) => s.setBlocks);
  const blocks = useBlocksStore((s) => s.blocks);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [taPos, setTaPos] = useState({ x: 0, y: 0 });
  const [taVisible, setTaVisible] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeOffset, setActiveOffset] = useState(0);

  // ── parse content → blocks ──

  useEffect(() => {
    const parsed = parseMarkdown(content);
    setBlocks(parsed);
  }, [content, setBlocks]);

  // ── scroll restore ──

  useEffect(() => {
    if (scrollRef.current && savedScrollTop > 0) {
      scrollRef.current.scrollTop = savedScrollTop;
    }
    return () => {
      if (scrollRef.current) savedScrollTop = scrollRef.current.scrollTop;
    };
  }, []);

  // ── reposition textarea after render ──

  const reposition = useCallback(() => {
    if (!caretBlockId) {
      setTaVisible(false);
      setActiveBlockId(null);
      return;
    }
    let pt = pointFromCaret(caretBlockId, caretOffset);
    if (!pt) {
      // Fallback: use block element's top-left
      const el = document.querySelector(`[data-block-id="${caretBlockId}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        pt = { x: r.left, y: r.top };
      }
    }
    if (pt) {
      setTaPos(pt);
      setTaVisible(true);
    } else {
      setTaVisible(false);
    }
  }, []);

  // Re-position after blocks change (content edit → re-render)
  useEffect(() => {
    if (caretBlockId) {
      // rAF: wait for React to commit DOM
      requestAnimationFrame(reposition);
    }
  }, [blocks, activeBlockId, reposition]);

  // ── click on block → set caret ──

  // ── find block by id ──

  const findBlock = useCallback(
    (id: string): Block | undefined => blocks.find((b) => b.id === id),
    [blocks],
  );

  const handleBlockClick = useCallback((blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    caretBlockId = blockId;

    // segFromPoint: finds data-seg span → returns segment start (source offset)
    // No caretFromPoint in InlineEditable mode — DOM text ≠ source text
    const seg = segFromPoint(e.clientX, e.clientY);
    caretOffset = seg ? seg.offset : 0;
    setActiveBlockId(blockId);
    setActiveOffset(caretOffset);
    requestAnimationFrame(reposition);
  }, [reposition]);

  // ── character input ──

  const handleChar = useCallback(
    (text: string) => {
      if (!caretBlockId) return;
      const block = findBlock(caretBlockId);
      if (!block) return;
      const dtext = displayText(block);
      const newText = dtext.slice(0, caretOffset) + text + dtext.slice(caretOffset);
      const newMd = textToMarkdown(newText, block);
      const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, newMd);
      if (newContent !== content) {
        setContent(newContent);
        caretOffset += text.length;
        setActiveOffset(caretOffset);
      }
    },
    [content, setContent, findBlock],
  );

  // ── keyboard commands ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!caretBlockId) return;
        const block = findBlock(caretBlockId);
        if (!block) return;
        const dtext = displayText(block);
        const before = dtext.slice(0, caretOffset);
        const after = dtext.slice(caretOffset);

        let newMd: string;
        let nextBlockId: string | null = null;

        if (block.type === 'code') {
          // Stay in code block, just insert newline
          newMd = textToMarkdown(before + '\n' + after, block);
          caretOffset = caretOffset + 1;
        } else if (block.type === 'heading') {
          // Heading → after becomes paragraph (no heading prefix)
          newMd = textToMarkdown(before, block) + '\n\n' + after;
          nextBlockId = `paragraph-${block.sourceStartLine + 2}`;
          caretOffset = 0;
        } else {
          // Paragraph, quote, list: after continues same type
          newMd = textToMarkdown(before, block) + '\n\n' + textToMarkdown(after, block);
          nextBlockId = block.type + '-' + (block.sourceStartLine + 2);
          caretOffset = 0;
        }

        const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, newMd);
        if (newContent !== content) {
          setContent(newContent);
          if (nextBlockId) caretBlockId = nextBlockId;
        }
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        if (!caretBlockId) return;
        const block = findBlock(caretBlockId);
        if (!block) return;
        const dtext = displayText(block);

        // Merge with previous block when at start of current block
        if (caretOffset === 0) {
          const idx = blocks.findIndex((b) => b.id === caretBlockId);
          if (idx <= 0) return;
          const prevBlock = blocks[idx - 1];
          const prevText = displayText(prevBlock);

          if (dtext === '') {
            // Empty block: delete it
            const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, '');
            if (newContent !== content) {
              setContent(newContent);
              caretBlockId = prevBlock.id;
              caretOffset = prevText.length;
              setActiveOffset(caretOffset);
            }
          } else {
            // Non-empty: merge current text onto end of previous block
            const merged = prevText + dtext;
            const mergedMd = textToMarkdown(merged, prevBlock);
            const newContent = syncBlockEdit(content, prevBlock.sourceStartLine, block.sourceEndLine, mergedMd);
            if (newContent !== content) {
              setContent(newContent);
              caretBlockId = prevBlock.id;
              caretOffset = prevText.length;
              setActiveOffset(caretOffset);
            }
          }
          return;
        }

        const newText = dtext.slice(0, caretOffset - 1) + dtext.slice(caretOffset);
        const newMd = textToMarkdown(newText, block);
        const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, newMd);
        if (newContent !== content) {
          setContent(newContent);
          caretOffset = Math.max(0, caretOffset - 1);
          setActiveOffset(caretOffset);
        }
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        if (!caretBlockId) return;
        const block = findBlock(caretBlockId);
        if (!block) return;
        const dtext = displayText(block);

        if (caretOffset < dtext.length) {
          // Delete character at offset
          const newText = dtext.slice(0, caretOffset) + dtext.slice(caretOffset + 1);
          const newMd = textToMarkdown(newText, block);
          const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, newMd);
          if (newContent !== content) setContent(newContent);
        } else {
          // At end of block: merge next block into current
          const idx = blocks.findIndex((b) => b.id === caretBlockId);
          if (idx < 0 || idx >= blocks.length - 1) return;
          const nextBlock = blocks[idx + 1];
          const nextText = displayText(nextBlock);
          if (dtext === '' && nextText === '') {
            // Both empty: delete current
            const newContent = syncBlockEdit(content, block.sourceStartLine, nextBlock.sourceEndLine, '');
            if (newContent !== content) setContent(newContent);
          } else {
            const merged = dtext + nextText;
            const mergedMd = textToMarkdown(merged, block);
            const newContent = syncBlockEdit(content, block.sourceStartLine, nextBlock.sourceEndLine, mergedMd);
            if (newContent !== content) setContent(newContent);
          }
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (!caretBlockId) return;
        const block = findBlock(caretBlockId);
        if (!block || block.type !== 'list') return;
        const dtext = displayText(block);
        const lineStart = dtext.lastIndexOf('\n', caretOffset - 1) + 1;
        const newText = e.shiftKey
          ? dtext.slice(0, lineStart) + dtext.slice(lineStart).replace(/^  /, '')
          : dtext.slice(0, lineStart) + '  ' + dtext.slice(lineStart);
        const newMd = textToMarkdown(newText, block);
        const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, newMd);
        if (newContent !== content) {
          setContent(newContent);
          caretOffset += e.shiftKey ? -2 : 2;
          if (caretOffset < lineStart) caretOffset = lineStart;
          setActiveOffset(caretOffset);
          requestAnimationFrame(reposition);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (caretOffset > 0) {
          caretOffset--;
          setActiveOffset(caretOffset);
          requestAnimationFrame(reposition);
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!caretBlockId) return;
        const block = findBlock(caretBlockId);
        if (!block) return;
        const max = displayText(block).length;
        if (caretOffset < max) {
          caretOffset++;
          setActiveOffset(caretOffset);
          requestAnimationFrame(reposition);
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!caretBlockId) return;
        const idx = blocks.findIndex((b) => b.id === caretBlockId);
        const nextIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
        if (nextIdx >= 0 && nextIdx < blocks.length) {
          const nextBlock = blocks[nextIdx];
          caretBlockId = nextBlock.id;
          caretOffset = Math.min(caretOffset, displayText(nextBlock).length);
          setActiveBlockId(nextBlock.id);
          setActiveOffset(caretOffset);
          requestAnimationFrame(reposition);
        }
        return;
      }
    },
    [content, setContent, findBlock, blocks, reposition],
  );

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Click on the background (not a block) → clear active block
    const target = e.target as HTMLElement;
    if (!target.closest('[data-block-id]')) {
      caretBlockId = null;
      caretOffset = 0;
      setActiveBlockId(null);
      setActiveOffset(0);
      setTaVisible(false);
    }
  }, []);

  // ── empty doc ──

  if (!content.trim()) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        Empty document
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-auto relative">
      <div className="mx-auto max-w-3xl px-8 py-6" style={{ fontSize: `${fontSize}px` }} onClick={handleContainerClick}>
        <BlockRenderer blocks={blocks} onBlockClick={handleBlockClick} activeBlockId={activeBlockId} activeOffset={activeOffset} />
      </div>
      <HiddenTextarea
        x={taPos.x}
        y={taPos.y}
        visible={taVisible}
        onChar={handleChar}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
