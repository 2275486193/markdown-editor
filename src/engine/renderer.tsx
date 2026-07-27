import { useMemo, useState } from 'react';
import type { Block } from './types';
import { InlineEditable } from './inline';

// ── heading styles ──

const headingStyle: Record<number, string> = {
  1: 'md-block md-heading md-heading-1',
  2: 'md-block md-heading md-heading-2',
  3: 'md-block md-heading md-heading-3',
  4: 'md-block md-heading md-heading-4',
  5: 'md-block md-heading md-heading-5',
  6: 'md-block md-heading md-heading-6',
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

  if (isActive) {
    return (
      <div {...blockAttrs(block, headingStyle[level], onClick)}>
        <InlineOrRaw text={block.markdown} isActive={isActive} offset={caretOffset} />
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
    <div {...blockAttrs(block, 'md-block md-paragraph', onClick)}>
      <InlineOrRaw text={block.markdown} isActive={isActive} offset={caretOffset} />
    </div>
  );
}

// ── QuoteBlock ──

function QuoteBlock({ block, onClick, isActive: _isActive, caretOffset: _caretOffset, activeBlockId, activeOffset, onContentEdit, fullContent }: BlockProps) {
  return (
    <blockquote
      className="md-block md-quote"
    >
      {block.children && block.children.length > 0 ? (
        <div className="md-quote-content">
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
          className="md-block md-paragraph"
          onClick={(e) => onClick(block.id, e)}
        >{' '}</div>
      )}
    </blockquote>
  );
}

// ── CodeBlock ──

function CodeBody({ text, isActive, offset }: { text: string; isActive: boolean; offset: number }) {
  const clampedOffset = Math.max(0, Math.min(offset, text.length));
  const commonAttrs = {
    'data-seg-start': 0,
    'data-seg-end': text.length,
    'data-seg-type': 'text',
  };

  if (!isActive) {
    return <span {...commonAttrs}>{text}</span>;
  }

  const before = text.slice(0, clampedOffset);
  const after = text.slice(clampedOffset);
  return (
    <span {...commonAttrs} data-seg-raw="1">
      {before}
      <span data-caret="true" className="caret-blink inline-block w-0 border-l-2 border-current h-[1em] align-text-bottom" />
      {after}
    </span>
  );
}

function CodeBlock({ block, onClick, isActive, caretOffset, onContentEdit, fullContent }: BlockProps) {
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
    <div {...blockAttrs(block, 'md-block md-code-block', onClick)}>
      <div
        className="md-code-toolbar"
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
            className="md-code-lang-input"
          />
        ) : (
          <span
            className="md-code-language"
            onClick={() => setEditingLang(true)}
          >
            {initialLang || 'plain'}
          </span>
        )}
        <button
          type="button"
          aria-label="copy"
          className="md-code-copy"
          onClick={handleCopy}
        >
          {copied ? '✓' : '📋'}
        </button>
      </div>
      <pre className="md-code-pre">
        <code>
          <CodeBody text={inner} isActive={isActive} offset={caretOffset} />
        </code>
      </pre>
    </div>
  );
}

// ── ListBlock ──

function ListBlock({ block, onClick, activeBlockId, activeOffset, onContentEdit, fullContent }: BlockProps) {
  const ordered = block.meta?.ordered ?? false;
  const Tag = (ordered ? 'ol' : 'ul') as 'ul' | 'ol';
  const listStyle = ordered ? 'md-list-ordered' : 'md-list-unordered';

  return (
    <Tag {...blockAttrs(block, `md-block md-list ${listStyle}`, onClick)}>
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
      className={isTask ? 'md-list-item md-task-item' : 'md-list-item'}
      onClick={(e) => onClick(block.id, e)}
    >
      {isTask && (
        <button
          type="button"
          aria-label={checked ? 'checked' : 'unchecked'}
          className="md-task-checkbox"
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
    const baseClass = `md-table-cell ${alignClass(col)}`;
    const headerClass = isHeader ? ' md-table-head' : '';
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
    <div {...blockAttrs(block, 'md-block md-table-wrap', onClick)}>
      <table className="md-table">
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
      {...blockAttrs(block, 'md-block md-html', onClick)}
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
            return <hr key={block.id} className="md-block md-hr" />;
          case 'html':
            return <HtmlBlock key={block.id} {...props} />;
          default:
            return <ParagraphBlock key={block.id} {...props} />;
        }
      })}
    </>
  );
}
