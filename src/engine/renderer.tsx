import { memo, useRef, useEffect, useCallback } from 'react';
import { useBlocksStore } from '../stores/blocks';
import { useEditorStore } from '../stores/editor';
import { syncBlockEdit } from './sync';
import { BlockDisplay } from './block-display';
import { htmlToMarkdown } from './md-converter';
import { processInlinePatterns } from './rt-parser';
import { registerSegFocus, unregisterSegFocus } from './seg-focus';
import { parseMarkdown } from './parser';
import type { Block } from './types';

// ── helpers ──

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

// ── TableEditor ──

function TableEditor({
  block, content, setContent, setActiveBlock,
}: { block: Block; content: string; setContent: (c: string) => void; setActiveBlock: (id: string | null) => void }) {
  const lines = block.markdown.split('\n').filter(l => l.trim());
  const parseRow = (line: string): string[] => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const header = parseRow(lines[0]);
  const body = lines.length > 2 ? lines.slice(2) : [];
  const colCount = header.length;
  const cellRefs = useRef<(HTMLSpanElement | null)[][]>([]);
  const allRows = [header, ...body]; const totalRows = allRows.length;
  if (cellRefs.current.length !== totalRows) cellRefs.current = Array.from({ length: totalRows }, () => []);

  const commitTable = useCallback(() => {
    const newRows: string[] = [];
    for (let r = 0; r < totalRows; r++) {
      const cells: string[] = [];
      for (let c = 0; c < colCount; c++) cells.push(cellRefs.current[r]?.[c]?.textContent ?? allRows[r]?.[c] ?? '');
      newRows.push('| ' + cells.join(' | ') + ' |');
    }
    if (newRows.length > 0) newRows.splice(1, 0, lines[1]);
    const nc = syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, newRows.join('\n'));
    setActiveBlock(null); if (nc !== content) setContent(nc);
  }, [totalRows, colCount, allRows, lines, block, content, setActiveBlock, setContent]);

  useEffect(() => { cellRefs.current[0]?.[0]?.focus(); }, []);
  useEffect(() => {
    const c = cellRefs.current[0]?.[0]?.closest('table'); if (!c) return;
    const h = (e: FocusEvent) => { const t = e.relatedTarget as HTMLElement | null; if (!t || !c.contains(t)) commitTable(); };
    c.addEventListener('focusout', h); return () => c.removeEventListener('focusout', h);
  }, [commitTable]);

  const moveCell = (r: number, c: number, dr: number, dc: number) => {
    let nr = r + dr, nc = c + dc;
    if (nc >= colCount) { nr++; nc = 0; } if (nc < 0) { nr--; nc = colCount - 1; }
    if (nr >= totalRows) nr = 0; if (nr < 0) nr = totalRows - 1;
    cellRefs.current[nr]?.[nc]?.focus();
  };

  return (<div className="overflow-x-auto my-2"><table className="w-full border-collapse border border-zinc-300 dark:border-zinc-600"><thead><tr>{header.map((h, c) => (<th key={c} className="border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800"><span ref={(el) => { if (!cellRefs.current[0]) cellRefs.current[0] = []; cellRefs.current[0][c] = el; }} className="outline-none" contentEditable suppressContentEditableWarning onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); moveCell(0, c, 0, e.shiftKey ? -1 : 1); } if (e.key === 'Escape') commitTable(); }}>{h}</span></th>))}</tr></thead><tbody>{body.map((row, r) => (<tr key={r}>{parseRow(row).map((cell, c) => (<td key={c} className="border border-zinc-300 dark:border-zinc-600 px-3 py-1.5"><span ref={(el) => { if (!cellRefs.current[r + 1]) cellRefs.current[r + 1] = []; cellRefs.current[r + 1][c] = el; }} className="outline-none" contentEditable suppressContentEditableWarning onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); moveCell(r + 1, c, 0, e.shiftKey ? -1 : 1); } if (e.key === 'Escape') commitTable(); }}>{cell}</span></td>))}</tr>))}</tbody></table></div>);
}

// ── BlockComponent ──

const WYSIWYG_TYPES = new Set(['paragraph', 'heading', 'quote', 'list', 'code', 'html']);
interface BlockProps { block: Block; }

const BlockComponent = memo(function BlockComponent({ block }: BlockProps) {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const setActiveBlock = useBlocksStore((s) => s.setActiveBlock);
  const isActive = useBlocksStore((s) => s.activeBlockId) === block.id;

  if (block.type === 'hr') return <hr className="my-4 border-zinc-300 dark:border-zinc-600" />;

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current; if (!el) return;
    registerSegFocus(el, (el_) => {
      el_.querySelectorAll('.md-active').forEach(e => e.classList.remove('md-active'));
      const sel = window.getSelection(); if (!sel?.rangeCount) return;
      let n: Node | null = sel.getRangeAt(0).startContainer;
      while (n && n !== el_) {
        if (n instanceof HTMLElement && n.matches('strong,em,del,code,mark,sub,sup')) { n.classList.add('md-active'); return; }
        n = n.parentNode;
      }
    });
    return () => unregisterSegFocus(el);
  }, []);

  if (block.type === 'table' && isActive) return <TableEditor block={block} content={content} setContent={setContent} setActiveBlock={setActiveBlock} />;

  const applyBlockCss = useCallback((el: HTMLElement) => {
    const text = el.textContent ?? '';
    const fl = (text.split('\n')[0] ?? '').trimStart();
    el.classList.remove('border-l-4','border-zinc-300','dark:border-zinc-600','pl-4','text-zinc-600','dark:text-zinc-400','text-2xl','font-bold','text-xl','font-semibold','text-lg','font-medium','text-base','text-sm','text-xs');
    if (/^>\s/.test(fl)) el.classList.add('border-l-4','border-zinc-300','dark:border-zinc-600','pl-4','text-zinc-600','dark:text-zinc-400');
    else if (/^#{1}\s/.test(fl)) el.classList.add('text-2xl','font-bold');
    else if (/^#{2}\s/.test(fl)) el.classList.add('text-xl','font-semibold');
    else if (/^#{3}\s/.test(fl)) el.classList.add('text-lg','font-medium');
    else if (/^#{4}\s/.test(fl)) el.classList.add('text-base','font-medium');
    else if (/^#{5}\s/.test(fl)) el.classList.add('text-sm','font-medium');
    else if (/^#{6}\s/.test(fl)) el.classList.add('text-xs','font-medium');
  }, []);

  if (WYSIWYG_TYPES.has(block.type)) {
    return (
      <div
        id={`block-${block.id}`} ref={contentRef}
        contentEditable suppressContentEditableWarning className="outline-none"
        onInput={(e) => { processInlinePatterns(e.currentTarget as HTMLElement); }}
        onKeyUp={(e) => { processInlinePatterns(e.currentTarget as HTMLElement); applyBlockCss(e.currentTarget as HTMLElement); }}
        onBlur={(e) => {
          const el = e.target as HTMLElement;
          const html = el.innerHTML;
          const md = htmlToMarkdown(html);
          if (md === block.markdown) return;
          syncToStore(content, syncBlockEdit(content, block.sourceStartLine, block.sourceEndLine, md));
        }}
        onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLElement).blur(); }}
      >
        <BlockDisplay block={block} />
      </div>
    );
  }

  return <BlockDisplay block={block} />;
});

// ── BlockRenderer ──

export const BlockRenderer = memo(function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return <>{blocks.map((block) => (<BlockComponent key={block.id} block={block} />))}</>;
});
