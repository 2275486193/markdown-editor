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
  /** 用于代码块语言切换、任务列表 click toggle 等纯渲染交互 */
  onContentEdit?: (newContent: string) => void;
  /** 完整 markdown(SSOT),onContentEdit 计算时需要 */
  fullContent?: string;
  /** 表格 active 单元格坐标(0 = 表头行) */
  activeCell?: { row: number; col: number } | null;
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

function QuoteBlock({ block, onClick, isActive: _isActive, caretOffset: _caretOffset, activeBlockId, activeOffset, onContentEdit, fullContent }: BlockProps) {
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
            onContentEdit={onContentEdit}
            fullContent={fullContent}
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

function CodeBlock({ block, onClick, onContentEdit, fullContent }: BlockProps) {
  const lines = block.markdown.split('\n');
  const inner = lines.length <= 2 ? '' : lines.slice(1, -1).join('\n');
  const initialLang = block.meta?.language ?? '';
  const [copied, setCopied] = useState(false);
  const [editingLang, setEditingLang] = useState(false);
  const [langDraft, setLangDraft] = useState(initialLang);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(inner);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const commitLang = () => {
    setEditingLang(false);
    if (!onContentEdit || fullContent === undefined) return;
    const allLines = fullContent.split('\n');
    const fenceIdx = block.sourceStartLine - 1;
    allLines[fenceIdx] = '```' + langDraft.trim();
    onContentEdit(allLines.join('\n'));
  };

  return (
    <div {...blockAttrs(block, 'my-2', onClick)}>
      <div
        className="flex items-center justify-between bg-[#161b22] text-zinc-400 text-xs px-3 py-1 rounded-t-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {editingLang ? (
          <input
            type="text"
            value={langDraft}
            autoFocus
            onChange={(e) => setLangDraft(e.target.value)}
            onBlur={commitLang}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitLang();
              }
            }}
            className="bg-transparent border border-zinc-600 px-1 text-xs w-24 outline-none"
          />
        ) : (
          <span
            className="cursor-pointer hover:text-zinc-100"
            onClick={() => setEditingLang(true)}
          >
            {initialLang || 'plain'}
          </span>
        )}
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

function ListBlock({ block, onClick, activeBlockId, activeOffset, onContentEdit, fullContent }: BlockProps) {
  const ordered = block.meta?.ordered ?? false;
  const Tag = (ordered ? 'ol' : 'ul') as 'ul' | 'ol';
  const listStyle = ordered ? 'list-decimal' : 'list-disc';

  return (
    <Tag {...blockAttrs(block, `${listStyle} pl-6 my-1`, onClick)}>
      {(block.children ?? []).map((item) => {
        const itemActive = item.id === activeBlockId;
        return (
          <ListItemBlock
            key={item.id}
            block={item}
            onClick={onClick}
            isActive={itemActive}
            caretOffset={itemActive ? activeOffset : 0}
            activeBlockId={activeBlockId}
            activeOffset={activeOffset}
            onContentEdit={onContentEdit}
            fullContent={fullContent}
          />
        );
      })}
    </Tag>
  );
}

// ── ListItemBlock ──

function ListItemBlock({ block, onClick, activeBlockId, activeOffset, onContentEdit, fullContent }: BlockProps) {
  const checked = block.meta?.checked;
  const isTask = checked !== undefined;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onContentEdit || fullContent === undefined) return;
    const lines = fullContent.split('\n');
    const idx = block.sourceStartLine - 1;
    if (idx < 0 || idx >= lines.length) return;
    const m = lines[idx].match(/^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\](\s.*)$/);
    if (!m) return;
    const newMark = m[2] === ' ' ? 'x' : ' ';
    lines[idx] = `${m[1]}[${newMark}]${m[3]}`;
    onContentEdit(lines.join('\n'));
  };

  return (
    <li
      data-block-id={block.id}
      className={isTask ? 'leading-relaxed list-none -ml-6' : 'leading-relaxed'}
      onClick={(e) => onClick(block.id, e)}
    >
      {isTask && (
        <button
          type="button"
          aria-label={checked ? 'checked' : 'unchecked'}
          className="mr-2 hover:text-zinc-700 dark:hover:text-zinc-300"
          onClick={handleToggle}
        >
          {checked ? '☑' : '☐'}
        </button>
      )}
      <BlockRenderer
        blocks={block.children ?? []}
        onBlockClick={onClick}
        activeBlockId={activeBlockId}
        activeOffset={activeOffset}
        onContentEdit={onContentEdit}
        fullContent={fullContent}
      />
    </li>
  );
}

// ── TableBlock ──

function TableBlock({
  block,
  onClick,
  isActive,
  caretOffset,
  activeBlockId,
  activeOffset,
  activeCell,
}: BlockProps) {
  const cells = block.meta?.cells;
  const align = block.meta?.align ?? [];
  if (!cells || cells.length < 1) {
    return <ParagraphBlock {...{ block, onClick, isActive, caretOffset, activeBlockId, activeOffset }} />;
  }
  const header = cells[0];
  const body = cells.slice(1);

  const alignClass = (i: number): string => {
    const a = align[i];
    if (a === 'center') return 'text-center';
    if (a === 'right') return 'text-right';
    return 'text-left';
  };

  const renderCell = (text: string, row: number, col: number, isHeader: boolean) => {
    const isActiveCell = isActive && activeCell?.row === row && activeCell?.col === col;
    const baseClass = `border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 ${alignClass(col)}`;
    const headerClass = isHeader ? ' font-semibold bg-zinc-100 dark:bg-zinc-800' : '';
    const className = baseClass + headerClass;
    if (isHeader) {
      return (
        <th
          key={col}
          data-cell-row={row}
          data-cell-col={col}
          className={className}
        >
          <InlineOrRaw text={text} isActive={isActiveCell} offset={isActiveCell ? caretOffset : -1} />
        </th>
      );
    }
    return (
      <td
        key={col}
        data-cell-row={row}
        data-cell-col={col}
        className={className}
      >
        <InlineOrRaw text={text} isActive={isActiveCell} offset={isActiveCell ? caretOffset : -1} />
      </td>
    );
  };

  return (
    <div {...blockAttrs(block, 'overflow-x-auto my-2', onClick)}>
      <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-600">
        <thead>
          <tr>{header.map((h, i) => renderCell(h, 0, i, true))}</tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>{row.map((c, ci) => renderCell(c, ri + 1, ci, false))}</tr>
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
  onContentEdit?: (newContent: string) => void;
  fullContent?: string;
  activeCell?: { row: number; col: number } | null;
}

export function BlockRenderer({ blocks, onBlockClick, activeBlockId, activeOffset, onContentEdit, fullContent, activeCell }: RendererProps) {
  return (
    <>
      {blocks.map((block) => {
        const isActive = block.id === activeBlockId;
        const props: BlockProps = { block, onClick: onBlockClick, isActive, caretOffset: isActive ? activeOffset : 0, activeBlockId, activeOffset, onContentEdit, fullContent, activeCell };
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
          case 'listItem':
            return <ListItemBlock key={block.id} {...props} />;
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
