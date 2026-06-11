import { useMemo, useState } from 'react';
import type { Block } from './types';
import { InlineEditable } from './inline';

// ── heading styles ──

const headingStyle: Record<number, string> = {
  1: 'text-2xl font-bold mt-4 mb-2',
  2: 'text-xl font-semibold mt-4 mb-2',
  3: 'text-lg font-medium mt-3 mb-1',
  4: 'text-base font-medium mt-3 mb-1',
  5: 'text-sm font-medium mt-2 mb-1',
  6: 'text-xs font-medium mt-2 mb-1',
};

// ── shared block props ──

interface BlockProps {
  block: Block;
  onClick: (blockId: string, e: React.MouseEvent) => void;
  isActive: boolean;
  caretOffset: number;
  activeBlockId: string | null;
  activeOffset: number;
}

const blockAttrs = (block: Block, className: string, onClick: BlockProps['onClick']) => ({
  'data-block-id': block.id,
  className,
  onClick: (e: React.MouseEvent) => onClick(block.id, e),
});

function InlineOrRaw({ text, isActive, offset }: { text: string; isActive: boolean; offset: number }) {
  if (!text) return (
    <>
      {isActive && (
        <span data-caret="true" className="caret-blink inline-block w-0 border-l-2 border-current h-[1em] align-text-bottom" />
      )}
      {' '}
    </>
  );
  // Always use InlineEditable so data-seg spans exist for click targeting
  return <InlineEditable text={text} offset={isActive ? offset : -1} isActive={isActive} />;
}

// ── HeadingBlock ──

function HeadingBlock({ block, onClick, isActive, caretOffset }: BlockProps) {
  const displayText = useMemo(
    () => block.markdown.replace(new RegExp(`^#{${block.level ?? 1}}\\s+`), ''),
    [block.markdown, block.level],
  );
  const level = Math.min(block.level ?? 1, 6);
  const prefixLen = (block.level ?? 1) + 1;

  if (isActive) {
    return (
      <div {...blockAttrs(block, headingStyle[level], onClick)}>
        <InlineOrRaw text={block.markdown} isActive={isActive} offset={caretOffset + prefixLen} />
      </div>
    );
  }

  return (
    <div {...blockAttrs(block, headingStyle[level], onClick)}>
      <InlineOrRaw text={displayText} isActive={isActive} offset={caretOffset} />
    </div>
  );
}

// ── ParagraphBlock ──

function ParagraphBlock({ block, onClick, isActive, caretOffset }: BlockProps) {
  return (
    <div {...blockAttrs(block, 'my-1 leading-relaxed min-h-[1.25em] whitespace-pre-wrap', onClick)}>
      <InlineOrRaw text={block.markdown} isActive={isActive} offset={caretOffset} />
    </div>
  );
}

// ── QuoteBlock ──

function QuoteBlock({ block, onClick, isActive: _isActive, caretOffset: _caretOffset, activeBlockId, activeOffset }: BlockProps) {
  return (
    <blockquote
      className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 my-2 text-zinc-600 dark:text-zinc-400"
    >
      {block.children && block.children.length > 0 ? (
        <div className="flex flex-col gap-2">
          <BlockRenderer
            blocks={block.children}
            onBlockClick={onClick}
            activeBlockId={activeBlockId}
            activeOffset={activeOffset}
          />
        </div>
      ) : (
        <div
          data-block-id={block.id}
          className="my-1 leading-relaxed min-h-[1.25em]"
          onClick={(e) => onClick(block.id, e)}
        >{' '}</div>
      )}
    </blockquote>
  );
}

// ── CodeBlock ──

function CodeBlock({ block, onClick }: BlockProps) {
  const lines = block.markdown.split('\n');
  const inner = lines.length <= 2 ? '' : lines.slice(1, -1).join('\n');
  const lang = block.meta?.language ?? '';
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(inner);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div {...blockAttrs(block, 'my-2', onClick)}>
      <div className="flex items-center justify-between bg-[#161b22] text-zinc-400 text-xs px-3 py-1 rounded-t-lg">
        <span>{lang || 'plain'}</span>
        <button
          type="button"
          aria-label="copy"
          className="hover:text-zinc-100"
          onClick={handleCopy}
        >
          {copied ? '✓' : '📋'}
        </button>
      </div>
      <pre className="bg-[#0d1117] text-[#e6edf3] p-4 rounded-b-lg overflow-x-auto text-sm leading-relaxed">
        <code>{inner}</code>
      </pre>
    </div>
  );
}

// ── ListBlock ──

function ListBlock({ block, onClick, isActive, caretOffset }: BlockProps) {
  const ordered = block.meta?.ordered ?? false;
  const Tag = ordered ? 'ol' : 'ul';
  const listStyle = ordered ? 'list-decimal' : 'list-disc';
  const items = block.children?.length ? block.children : null;

  if (items) {
    return (
      <Tag {...blockAttrs(block, `${listStyle} pl-6 my-1`, onClick)}>
        {items.map((item, i) => {
          const cleaned = item.markdown
            .replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/, '$1')
            .replace(/^(\s*)[-*+]\s+/, '$1')
            .replace(/^(\s*)\d+\.\s+/, '$1');
          return (
            <li key={i} className="leading-relaxed">
              <InlineOrRaw text={cleaned} isActive={isActive} offset={caretOffset} />
            </li>
          );
        })}
      </Tag>
    );
  }

  // Fallback: parse from markdown lines
  const lines = block.markdown.split('\n');
  return (
    <Tag {...blockAttrs(block, `${listStyle} pl-6 my-1`, onClick)}>
      {lines.map((line, i) => {
        const cleaned = line
          .replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/, '$1')
          .replace(/^(\s*)[-*+]\s+/, '$1')
          .replace(/^(\s*)\d+\.\s+/, '$1');
        return <li key={i} className="leading-relaxed"><InlineOrRaw text={cleaned} isActive={isActive} offset={caretOffset} /></li>;
      })}
    </Tag>
  );
}

// ── TableBlock ──

function TableBlock({ block, onClick, isActive, caretOffset, activeBlockId, activeOffset }: BlockProps) {
  const lines = block.markdown.split('\n').filter((l) => l.trim());
  if (lines.length < 2) {
    return <ParagraphBlock {...{block, onClick, isActive, caretOffset, activeBlockId, activeOffset}} />;
  }
  const parseRow = (line: string) =>
    line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = parseRow(lines[0]);
  const body = lines.slice(2);

  return (
    <div {...blockAttrs(block, 'overflow-x-auto my-2', onClick)}>
      <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-600">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} className="border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-left font-semibold bg-zinc-100 dark:bg-zinc-800">
                <InlineOrRaw text={h} isActive={isActive} offset={caretOffset} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {parseRow(row).map((cell, ci) => (
                <td key={ci} className="border border-zinc-300 dark:border-zinc-600 px-3 py-1.5">
                  <InlineOrRaw text={cell} isActive={isActive} offset={caretOffset} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── HtmlBlock ──

function HtmlBlock({ block, onClick }: BlockProps) {
  return (
    <div
      {...blockAttrs(block, 'text-xs text-zinc-400 dark:text-zinc-500 italic my-1', onClick)}
      dangerouslySetInnerHTML={{ __html: block.markdown }}
    />
  );
}

// ── BlockRenderer ──

interface RendererProps {
  blocks: Block[];
  onBlockClick: (blockId: string, e: React.MouseEvent) => void;
  activeBlockId: string | null;
  activeOffset: number;
}

export function BlockRenderer({ blocks, onBlockClick, activeBlockId, activeOffset }: RendererProps) {
  return (
    <>
      {blocks.map((block) => {
        const isActive = block.id === activeBlockId;
        const props: BlockProps = { block, onClick: onBlockClick, isActive, caretOffset: isActive ? activeOffset : 0, activeBlockId, activeOffset };
        switch (block.type) {
          case 'heading':
            return <HeadingBlock key={block.id} {...props} />;
          case 'paragraph':
            return <ParagraphBlock key={block.id} {...props} />;
          case 'quote':
            return <QuoteBlock key={block.id} {...props} />;
          case 'code':
            return <CodeBlock key={block.id} {...props} />;
          case 'list':
            return <ListBlock key={block.id} {...props} />;
          case 'table':
            return <TableBlock key={block.id} {...props} />;
          case 'hr':
            return <hr key={block.id} className="my-4 border-zinc-300 dark:border-zinc-600" />;
          case 'html':
            return <HtmlBlock key={block.id} {...props} />;
          default:
            return <ParagraphBlock key={block.id} {...props} />;
        }
      })}
    </>
  );
}
