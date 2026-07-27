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

function applyQuotePrefix(markdown: string, quoteDepth: number): string {
  const prefix = '> '.repeat(quoteDepth);
  return markdown.split('\n').map((l) => prefix + l).join('\n');
}

function blockToMarkdown(text: string, block: Block): string {
  const md = textToMarkdown(text, block);
  if (block.meta?.quoteDepth) {
    return applyQuotePrefix(md, block.meta.quoteDepth);
  }
  return md;
}

function textToMarkdown(text: string, block: Block): string {
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

// ── caret state (ephemeral, not in store) ──

let caretBlockId: string | null = null;
let caretOffset = 0;

function findBlockRecursive(blocks: Block[], id: string): Block | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.children) {
      const found = findBlockRecursive(block.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function findParentQuote(blocks: Block[], childId: string): Block | undefined {
  for (const block of blocks) {
    if (block.type === 'quote' && block.children) {
      if (block.children.some((c) => c.id === childId)) return block;
      const found = findParentQuote(block.children, childId);
      if (found) return found;
    }
  }
  return undefined;
}

function flattenBlocks(blocks: Block[]): Block[] {
  const result: Block[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.children) {
      result.push(...flattenBlocks(block.children));
    }
  }
  return result;
}

export function WYSIWYGMode() {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const fontSize = useUiStore((s) => s.fontSize);
  const setBlocks = useBlocksStore((s) => s.setBlocks);
  const blocks = useBlocksStore((s) => s.blocks);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [taPos, setTaPos] = useState({ x: 0, y: 0 });
  const [taVisible, setTaVisible] = useState(false);
  const [taHeight, setTaHeight] = useState(16);
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
    // Priority 1: use the caret DOM element's bounding rect
    const caretEl = document.querySelector('[data-caret="true"]');
    if (caretEl) {
      const r = caretEl.getBoundingClientRect();
      setTaPos({ x: r.left, y: r.top });
      setTaHeight(r.height);
      setTaVisible(true);
      return;
    }
    // Priority 2: fallback — pointFromCaret for code blocks etc.
    let pt = pointFromCaret(caretBlockId, caretOffset);
    if (!pt) {
      const el = document.querySelector(`[data-block-id="${caretBlockId}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        pt = { x: r.left, y: r.top };
      }
    }
    if (pt) {
      setTaPos(pt);
      setTaHeight(16);
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
    (id: string): Block | undefined => findBlockRecursive(blocks, id),
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
      const newMd = blockToMarkdown(newText, block);
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

        // ── quote child: exit or split within quote ──
        if (block.meta?.quoteDepth) {
          const qd = block.meta.quoteDepth;

          if (dtext === '') {
            // Empty paragraph inside quote → exit quote for this line
            const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, '');
            if (newContent !== content) {
              setContent(newContent);
              caretBlockId = null;
              caretOffset = 0;
            }
            return;
          }

          // Non-empty: split within quote
          let newMd: string;
          let nextLineOffset: number;
          if (after) {
            newMd = applyQuotePrefix(before, qd) + '\n' + applyQuotePrefix('', qd) + '\n' + applyQuotePrefix(after, qd);
            nextLineOffset = 3;
          } else {
            newMd = applyQuotePrefix(before, qd) + '\n' + applyQuotePrefix('', qd);
            nextLineOffset = 2;
          }
          const nextBlockId = block.type + '-' + (block.sourceStartLine + nextLineOffset - 1);
          const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, newMd);
          if (newContent !== content) {
            setContent(newContent);
            caretBlockId = nextBlockId;
            caretOffset = 0;
          }
          return;
        }

        let newMd: string;
        let nextBlockId: string | null = null;

        if (block.type === 'code') {
          // Stay in code block, just insert newline
          newMd = blockToMarkdown(before + '\n' + after, block);
          caretOffset = caretOffset + 1;
        } else if (block.type === 'heading') {
          // Heading → after becomes paragraph (no heading prefix)
          newMd = blockToMarkdown(before, block) + '\n\n' + after;
          nextBlockId = `paragraph-${block.sourceStartLine + 2}`;
          caretOffset = 0;
        } else {
          // Paragraph, quote, list: after continues same type
          newMd = blockToMarkdown(before, block) + '\n\n' + blockToMarkdown(after, block);
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
          // ── quote child specific ──
          if (block.meta?.quoteDepth) {
            const parentQuote = findParentQuote(blocks, block.id);
            const siblings = parentQuote?.children ?? [];
            const siblingIdx = siblings.findIndex((c) => c.id === block.id);

            if (dtext === '') {
              // Empty block: delete this child
              const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, '');
              if (newContent !== content) {
                setContent(newContent);
                if (siblingIdx > 0) {
                  const prev = siblings[siblingIdx - 1];
                  caretBlockId = prev.id;
                  caretOffset = displayText(prev).length;
                } else {
                  caretBlockId = parentQuote?.id ?? null;
                  caretOffset = 0;
                }
                setActiveOffset(caretOffset);
              }
              return;
            }

            if (siblingIdx === 0) {
              // First child with content: strip quote prefix → exit quote
              const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, block.markdown);
              if (newContent !== content) {
                setContent(newContent);
                caretBlockId = null;
                caretOffset = 0;
              }
              return;
            }

            // Not first child: merge with previous sibling
            const prevSibling = siblings[siblingIdx - 1];
            const prevText = displayText(prevSibling);
            const merged = prevText + dtext;
            const mergedMd = blockToMarkdown(merged, prevSibling);
            const newContent = syncBlockEdit(content, prevSibling.sourceStartLine, block.sourceEndLine, mergedMd);
            if (newContent !== content) {
              setContent(newContent);
              caretBlockId = prevSibling.id;
              caretOffset = prevText.length;
              setActiveOffset(caretOffset);
            }
            return;
          }

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
            const mergedMd = blockToMarkdown(merged, prevBlock);
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
        const newMd = blockToMarkdown(newText, block);
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
          const newMd = blockToMarkdown(newText, block);
          const newContent = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, newMd);
          if (newContent !== content) setContent(newContent);
        } else {
          // At end of block: merge next block into current
          const flat = flattenBlocks(blocks);
          const idx = flat.findIndex((b) => b.id === caretBlockId);
          if (idx < 0 || idx >= flat.length - 1) return;
          const nextBlock = flat[idx + 1];
          const nextText = displayText(nextBlock);
          if (dtext === '' && nextText === '') {
            // Both empty: delete current
            const newContent = syncBlockEdit(content, block.sourceStartLine, nextBlock.sourceEndLine, '');
            if (newContent !== content) setContent(newContent);
          } else {
            const merged = dtext + nextText;
            const mergedMd = blockToMarkdown(merged, block);
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
        const newMd = blockToMarkdown(newText, block);
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
        } else {
          // At start of block → jump to end of previous block
          const flat = flattenBlocks(blocks);
          const idx = flat.findIndex((b) => b.id === caretBlockId);
          if (idx > 0) {
            const prev = flat[idx - 1];
            caretBlockId = prev.id;
            caretOffset = displayText(prev).length;
            setActiveBlockId(prev.id);
            setActiveOffset(caretOffset);
            requestAnimationFrame(reposition);
          }
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
        } else {
          // At end of block → jump to start of next block
          const flat = flattenBlocks(blocks);
          const idx = flat.findIndex((b) => b.id === caretBlockId);
          if (idx >= 0 && idx < flat.length - 1) {
            const next = flat[idx + 1];
            caretBlockId = next.id;
            caretOffset = 0;
            setActiveBlockId(next.id);
            setActiveOffset(0);
            requestAnimationFrame(reposition);
          }
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!caretBlockId) return;
        const flat = flattenBlocks(blocks);
        const idx = flat.findIndex((b) => b.id === caretBlockId);
        const nextIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
        if (nextIdx >= 0 && nextIdx < flat.length) {
          const nextBlock = flat[nextIdx];
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
        height={taHeight}
        visible={taVisible}
        onChar={handleChar}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
