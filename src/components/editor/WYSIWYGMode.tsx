import { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '../../stores/editor';
import { useBlocksStore } from '../../stores/blocks';
import { useUiStore } from '../../stores/ui';
import { parseMarkdown } from '../../engine/parser';
import { BlockRenderer } from '../../engine/renderer';
import { HiddenTextarea } from './HiddenTextarea';
import { pointFromCaret, segFromPoint } from '../../engine/caret';
import {
  findBlockRecursive,
  findBlockAtLine,
} from '../../engine/blocks';
import { handleEnter } from '../../engine/keyboard/enter';
import { handleBackspace } from '../../engine/keyboard/backspace';
import { handleDelete } from '../../engine/keyboard/delete';
import { handleArrows } from '../../engine/keyboard/arrows';
import { handleTab } from '../../engine/keyboard/tab';
import { handleChar as handleCharImpl } from '../../engine/keyboard/char';

let savedScrollTop = 0;

// ── caret state (ephemeral, not in store) ──

let caretBlockId: string | null = null;
let caretOffset = 0;
let caretLineTarget = 0;
let caretCell: { row: number; col: number } | null = null;

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
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

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
    // Resolve line-based caret target after structural edits
    if (caretLineTarget > 0) {
      const target = findBlockAtLine(blocks, caretLineTarget);
      if (target) {
        caretBlockId = target.id;
        setActiveBlockId(target.id);
        setActiveOffset(caretOffset);
      }
      caretLineTarget = 0;
    }
    if (caretBlockId) {
      reposition();
      setTimeout(() => reposition(), 0);
    }
  }, [blocks, activeBlockId, reposition]);

  // ── click on block → set caret ──

  const handleBlockClick = useCallback((blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    caretBlockId = blockId;

    const seg = segFromPoint(e.clientX, e.clientY);
    let offset = seg ? seg.offset : 0;

    const clicked = findBlockRecursive(blocks, blockId);
    if (clicked?.type === 'heading' && blockId === activeBlockId) {
      offset = Math.max(0, offset - ((clicked.level ?? 1) + 1));
    }

    caretOffset = offset;
    setActiveBlockId(blockId);
    setActiveOffset(caretOffset);
    requestAnimationFrame(reposition);
  }, [reposition, blocks, activeBlockId]);

  // ── character input ──

  const handleChar = useCallback(
    (text: string) => {
      const patch = handleCharImpl(
        { content, blocks, caretBlockId, caretOffset, caretLineTarget },
        text,
      );
      if (!patch) return;
      if (patch.newContent !== undefined) setContent(patch.newContent);
      if (patch.newCaretBlockId !== undefined) caretBlockId = patch.newCaretBlockId;
      if (patch.newCaretOffset !== undefined) caretOffset = patch.newCaretOffset;
      if (patch.syncActiveOffset) setActiveOffset(caretOffset);
    },
    [content, blocks, setContent],
  );

  // ── keyboard commands ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const patch = handleEnter(
          { content, blocks, caretBlockId, caretOffset, caretLineTarget },
          { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey },
        );
        if (!patch) return;
        if (patch.newContent !== undefined) setContent(patch.newContent);
        if (patch.newCaretBlockId !== undefined) caretBlockId = patch.newCaretBlockId;
        if (patch.newCaretOffset !== undefined) caretOffset = patch.newCaretOffset;
        if (patch.newCaretLineTarget !== undefined) caretLineTarget = patch.newCaretLineTarget;
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        const patch = handleBackspace(
          { content, blocks, caretBlockId, caretOffset, caretLineTarget },
          { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey },
        );
        if (!patch) return;
        if (patch.newContent !== undefined) setContent(patch.newContent);
        if (patch.newCaretBlockId !== undefined) caretBlockId = patch.newCaretBlockId;
        if (patch.newCaretOffset !== undefined) caretOffset = patch.newCaretOffset;
        if (patch.newCaretLineTarget !== undefined) caretLineTarget = patch.newCaretLineTarget;
        if (patch.syncActiveOffset) setActiveOffset(caretOffset);
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        const patch = handleDelete(
          { content, blocks, caretBlockId, caretOffset, caretLineTarget },
          { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey },
        );
        if (!patch) return;
        if (patch.newContent !== undefined) setContent(patch.newContent);
        if (patch.newCaretBlockId !== undefined) caretBlockId = patch.newCaretBlockId;
        if (patch.newCaretOffset !== undefined) caretOffset = patch.newCaretOffset;
        if (patch.newCaretLineTarget !== undefined) caretLineTarget = patch.newCaretLineTarget;
        if (patch.syncActiveOffset) setActiveOffset(caretOffset);
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const patch = handleTab(
          { content, blocks, caretBlockId, caretOffset, caretLineTarget },
          { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey },
        );
        if (!patch) return;
        if (patch.newContent !== undefined) setContent(patch.newContent);
        if (patch.newCaretBlockId !== undefined) caretBlockId = patch.newCaretBlockId;
        if (patch.newCaretOffset !== undefined) caretOffset = patch.newCaretOffset;
        if (patch.newCaretLineTarget !== undefined) caretLineTarget = patch.newCaretLineTarget;
        if (patch.syncActiveBlockId) setActiveBlockId(caretBlockId);
        if (patch.syncActiveOffset) setActiveOffset(caretOffset);
        if (patch.repositionAfter) requestAnimationFrame(reposition);
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const patch = handleArrows(
          { content, blocks, caretBlockId, caretOffset, caretLineTarget },
          { key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey },
        );
        if (!patch) return;
        if (patch.newContent !== undefined) setContent(patch.newContent);
        if (patch.newCaretBlockId !== undefined) caretBlockId = patch.newCaretBlockId;
        if (patch.newCaretOffset !== undefined) caretOffset = patch.newCaretOffset;
        if (patch.newCaretLineTarget !== undefined) caretLineTarget = patch.newCaretLineTarget;
        if (patch.syncActiveBlockId) setActiveBlockId(caretBlockId);
        if (patch.syncActiveOffset) setActiveOffset(caretOffset);
        if (patch.repositionAfter) requestAnimationFrame(reposition);
        return;
      }
    },
    [content, setContent, blocks, reposition],
  );

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Click on the background (not a block) → clear active block
    const target = e.target as HTMLElement;
    if (!target.closest('[data-block-id]')) {
      caretBlockId = null;
      caretOffset = 0;
      caretCell = null;
      void caretCell;
      setActiveBlockId(null);
      setActiveOffset(0);
      setActiveCell(null);
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
        <BlockRenderer blocks={blocks} onBlockClick={handleBlockClick} activeBlockId={activeBlockId} activeOffset={activeOffset} onContentEdit={setContent} fullContent={content} activeCell={activeCell} />
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
