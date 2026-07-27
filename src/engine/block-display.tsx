import React from 'react';
import { parseInline, InlineContent } from './inline';
import type { InlineSegment } from './inline';
import type { Block } from './types';

function renderInline(segs: InlineSegment[], onSegmentClick?: (pos: number) => void) {
  return <InlineContent segments={segs} onSegmentClick={onSegmentClick} />;
}

// ── strip block-level prefix ──

function stripHeadingPrefix(md: string, level: number): string {
  return md.replace(new RegExp(`^#{${level}}\\s+`), '');
}

// Strip `- ` or `1. ` prefix, keeping leading whitespace for indentation
function stripListPrefix(line: string): string {
  return line.replace(/^(\s*)[-*+]\s+/, '$1').replace(/^(\s*)\d+\.\s+/, '$1');
}

// Strip `- [x] ` or `- [ ] ` prefix entirely (checkbox is rendered separately)
function stripTaskPrefix(line: string): string {
  return line.replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/, '$1');
}

// ── component: heading ──

const headingStyle: Record<number, string> = {
  1: 'text-2xl font-bold mt-4 mb-2',
  2: 'text-xl font-semibold mt-4 mb-2',
  3: 'text-lg font-medium mt-3 mb-1',
  4: 'text-base font-medium mt-3 mb-1',
  5: 'text-sm font-medium mt-2 mb-1',
  6: 'text-xs font-medium mt-2 mb-1',
};

function HeadingDisplay({ block, onSegmentClick }: { block: Block; onSegmentClick?: (pos: number) => void }) {
  const lvl = Math.min(block.level ?? 1, 6);
  const inner = stripHeadingPrefix(block.markdown, lvl);
  const prefixLen = block.markdown.length - inner.length;
  const segs = parseInline(inner);
  const handleClick = onSegmentClick ? (pos: number) => onSegmentClick(pos + prefixLen) : undefined;
  return React.createElement(
    `h${lvl}` as keyof JSX.IntrinsicElements,
    { className: headingStyle[lvl] },
    renderInline(segs, handleClick),
  );
}

function ParagraphDisplay({ text, onSegmentClick }: { text: string; onSegmentClick?: (pos: number) => void }) {
  const segs = parseInline(text);
  return (
    <p className="my-1 leading-relaxed">
      {renderInline(segs, onSegmentClick)}
    </p>
  );
}

function QuoteLineDisplay({ rawLine, onSegmentClick }: { rawLine: string; onSegmentClick?: (pos: number) => void }) {
  const depth = (rawLine.match(/^>+/) ?? [''])[0].length;
  const content = rawLine.replace(new RegExp(`^>{${depth}}\\s?`), '');
  const prefixLen = rawLine.length - content.length;
  const segs = parseInline(content);
  const handleClick = onSegmentClick ? (pos: number) => onSegmentClick(pos + prefixLen) : undefined;
  let el: React.ReactNode = (
    <p className="my-0.5 leading-relaxed">
      {renderInline(segs, handleClick)}
    </p>
  );
  for (let d = 1; d < depth; d++) {
    el = <blockquote key={d} className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 my-1 text-zinc-600 dark:text-zinc-400">{el}</blockquote>;
  }
  return <>{el}</>;
}

function QuoteDisplay({ block, onSegmentClick }: { block: Block; onSegmentClick?: (pos: number) => void }) {
  // Children-based rendering for nested quotes
  if (block.children && block.children.length > 0) {
    return (
      <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 my-1 text-zinc-600 dark:text-zinc-400">
        {block.children.map((child) => (
          <BlockDisplay key={child.id} block={child} onSegmentClick={onSegmentClick} />
        ))}
      </blockquote>
    );
  }

  // Fallback: per-line depth detection
  const lines = block.markdown.split('\n');
  let posOffset = 0;
  return (
    <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 my-1 text-zinc-600 dark:text-zinc-400">
      {lines.map((line, i) => {
        const lineStart = posOffset;
        posOffset += line.length + 1;
        const handleClick = onSegmentClick ? (p: number) => onSegmentClick(p + lineStart) : undefined;
        return <QuoteLineDisplay key={i} rawLine={line} onSegmentClick={handleClick} />;
      })}
    </blockquote>
  );
}

function CodeDisplay({ block }: { block: Block }) {
  const lines = block.markdown.split('\n');
  const inner = lines.length <= 2 ? '' : lines.slice(1, -1).join('\n');
  const lang = block.meta?.language;
  return (
    <div className="my-2">
      {lang && <div className="text-xs text-zinc-400 mb-1 px-1">{lang}</div>}
      <pre className="bg-[#0d1117] text-[#e6edf3] p-4 rounded-lg overflow-x-auto text-sm leading-relaxed">
        <code>{inner}</code>
      </pre>
    </div>
  );
}

function ListItemDisplay({ block, idx, onSegmentClick, onTaskToggle }: { block: Block; idx: number; onSegmentClick?: (pos: number) => void; onTaskToggle?: (lineIdx: number) => void }) {
  const line = block.markdown;

  // Complex item with children: render each child individually, no markdown parsing
  if (block.children && block.children.length > 0) {
    const isTask = /^\s*[-*+]\s+\[[ xX]\]/.test(line);
    const checked = /\[[xX]\]/.test(line);
    return (
      <li className="leading-relaxed">
        {isTask && (
          <input type="checkbox" checked={checked} readOnly className="mt-1 mr-1 cursor-pointer align-text-bottom"
            onClick={(e) => { e.stopPropagation(); onTaskToggle?.(idx); }} />
        )}
        {block.children.map((child, ci) => (
          <BlockDisplay key={ci} block={child} onSegmentClick={onSegmentClick} />
        ))}
      </li>
    );
  }

  // Simple item: parse markdown for inline rendering
  if (isTask(line)) {
    const clean = stripTaskPrefix(line);
    const checked = /\[[xX]\]/.test(line);
    const segs = parseInline(clean);
    return (
      <li className="leading-relaxed flex items-start gap-1">
        <input type="checkbox" checked={checked} readOnly className="mt-1 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onTaskToggle?.(idx); }} />
        <span>{renderInline(segs, onSegmentClick)}</span>
      </li>
    );
  }

  const prefixed = stripListPrefix(line);
  const segs = parseInline(prefixed);
  return (
    <li className="leading-relaxed">
      {renderInline(segs, onSegmentClick)}
    </li>
  );
}

function isTask(line: string): boolean {
  return /^\s*[-*+]\s+\[[ xX]\]/.test(line);
}

function ListDisplay({ block, onSegmentClick, onTaskToggle }: { block: Block; onSegmentClick?: (pos: number) => void; onTaskToggle?: (lineIdx: number) => void }) {
  const ordered = block.meta?.ordered ?? false;
  const Tag = ordered ? 'ol' : 'ul';
  const listStyle = ordered ? 'list-decimal' : 'list-disc';
  const items = block.children && block.children.length > 0 ? block.children : [];

  if (items.length > 0) {
    return (
      <Tag className={`${listStyle} pl-6 my-1`}>
        {items.map((child, i) => (
          <ListItemDisplay key={i} block={child} idx={i} onSegmentClick={onSegmentClick} onTaskToggle={onTaskToggle} />
        ))}
      </Tag>
    );
  }

  // Fallback: no children, parse from markdown lines
  const lines = block.markdown.split('\n');
  return (
    <Tag className={`${listStyle} pl-6 my-1`}>
      {lines.map((line, i) => {
        const isTask = /^\s*[-*+]\s+\[[ xX]\]/.test(line);
        if (isTask) {
          const clean = stripTaskPrefix(line);
          const checked = /\[[xX]\]/.test(line);
          const segs = parseInline(clean);
          return (
            <li key={i} className="leading-relaxed flex items-start gap-1">
              <input type="checkbox" checked={checked} readOnly className="mt-1 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onTaskToggle?.(i); }} />
              <span>{renderInline(segs, onSegmentClick)}</span>
            </li>
          );
        }
        const prefixed = stripListPrefix(line);
        const segs = parseInline(prefixed);
        return <li key={i} className="leading-relaxed">{renderInline(segs, onSegmentClick)}</li>;
      })}
    </Tag>
  );
}

function TableDisplay({ block, onSegmentClick }: { block: Block; onSegmentClick?: (pos: number) => void }) {
  const lines = block.markdown.split('\n').filter(l => l.trim());
  if (lines.length < 2) return <ParagraphDisplay text={block.markdown} onSegmentClick={onSegmentClick} />;

  const parseRow = (line: string): string[] =>
    line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());

  const header = parseRow(lines[0]);
  const body = lines.slice(2);

  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-600">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} className="border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-left font-semibold bg-zinc-100 dark:bg-zinc-800">
                {renderInline(parseInline(h), onSegmentClick)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {parseRow(row).map((cell, ci) => (
                <td key={ci} className="border border-zinc-300 dark:border-zinc-600 px-3 py-1.5">
                  {renderInline(parseInline(cell), onSegmentClick)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HtmlDisplay({ block }: { block: Block }) {
  return (
    <div
      className="text-xs text-zinc-400 dark:text-zinc-500 italic my-1"
      dangerouslySetInnerHTML={{ __html: block.markdown }}
    />
  );
}

// ── export: BlockDisplay ──

export function BlockDisplay({ block, onSegmentClick, onTaskToggle }: { block: Block; onSegmentClick?: (pos: number) => void; onTaskToggle?: (lineIdx: number) => void }) {
  switch (block.type) {
    case 'heading':
      return <HeadingDisplay block={block} onSegmentClick={onSegmentClick} />;
    case 'paragraph':
      return <ParagraphDisplay text={block.markdown} onSegmentClick={onSegmentClick} />;
    case 'quote':
      return <QuoteDisplay block={block} onSegmentClick={onSegmentClick} />;
    case 'code':
      return <CodeDisplay block={block} />;
    case 'list':
      return <ListDisplay block={block} onSegmentClick={onSegmentClick} onTaskToggle={onTaskToggle} />;
    case 'table':
      return <TableDisplay block={block} onSegmentClick={onSegmentClick} />;
    case 'hr':
      return <hr className="my-4 border-zinc-300 dark:border-zinc-600" />;
    case 'html':
      return <HtmlDisplay block={block} />;
    default:
      return <ParagraphDisplay text={block.markdown} onSegmentClick={onSegmentClick} />;
  }
}
