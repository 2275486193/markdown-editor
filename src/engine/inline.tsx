import React from 'react';
import katex from 'katex';

// ── types (with source positions for per-segment editing) ──

export type InlineSegment =
  | { type: 'text'; text: string; start: number; end: number }
  | { type: 'strong'; text: string; start: number; end: number }
  | { type: 'em'; text: string; start: number; end: number }
  | { type: 'del'; text: string; start: number; end: number }
  | { type: 'mark'; text: string; start: number; end: number }
  | { type: 'strong_em'; text: string; start: number; end: number }
  | { type: 'sub'; text: string; start: number; end: number }
  | { type: 'sup'; text: string; start: number; end: number }
  | { type: 'code'; text: string; start: number; end: number }
  | { type: 'link'; text: string; url: string; start: number; end: number }
  | { type: 'image'; alt: string; url: string; start: number; end: number }
  | { type: 'math'; tex: string; display: boolean; start: number; end: number }
  | { type: 'html'; raw: string; start: number; end: number };

// ── parser ──

export function parseInline(md: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let i = 0;
  let buf = '';
  let bufStart = 0;

  function flush(end: number) {
    if (buf) {
      segments.push({ type: 'text', text: buf, start: bufStart, end });
      buf = '';
    }
    bufStart = end;
  }

  while (i < md.length) {
    const c = md[i];
    const c2 = md[i + 1];

    if (c === '\\' && c2) {
      buf += c2;
      i += 2;
      continue;
    }

    // *** bold+italic ***
    if ((c === '*' && c2 === '*' && md[i + 2] === '*') ||
        (c === '_' && c2 === '_' && md[i + 2] === '_')) {
      const m = c === '*' ? '***' : '___';
      const end = md.indexOf(m, i + 3);
      if (end > i) {
        flush(i);
        segments.push({ type: 'strong_em', text: md.slice(i + 3, end), start: i, end: end + 3 });
        i = end + 3; bufStart = i;
        continue;
      }
    }

    // ** bold **
    if ((c === '*' && c2 === '*') || (c === '_' && c2 === '_')) {
      const m = c === '*' ? '**' : '__';
      const end = md.indexOf(m, i + 2);
      if (end > i) {
        flush(i);
        segments.push({ type: 'strong', text: md.slice(i + 2, end), start: i, end: end + 2 });
        i = end + 2; bufStart = i;
        continue;
      }
    }

    // == highlight ==
    if (c === '=' && c2 === '=') {
      const end = md.indexOf('==', i + 2);
      if (end > i) {
        flush(i);
        segments.push({ type: 'mark', text: md.slice(i + 2, end), start: i, end: end + 2 });
        i = end + 2; bufStart = i;
        continue;
      }
    }

    // ~~ del ~~
    if (c === '~' && c2 === '~') {
      const end = md.indexOf('~~', i + 2);
      if (end > i) {
        flush(i);
        segments.push({ type: 'del', text: md.slice(i + 2, end), start: i, end: end + 2 });
        i = end + 2; bufStart = i;
        continue;
      }
    }

    // ` code `
    if (c === '`') {
      const end = md.indexOf('`', i + 1);
      if (end > i) {
        flush(i);
        segments.push({ type: 'code', text: md.slice(i + 1, end), start: i, end: end + 1 });
        i = end + 1; bufStart = i;
        continue;
      }
    }

    // ![ image ](url)
    if (c === '!' && c2 === '[') {
      const cb = md.indexOf('](', i + 2);
      const cp = cb > i ? md.indexOf(')', cb + 2) : -1;
      if (cp > cb) {
        flush(i);
        segments.push({ type: 'image', alt: md.slice(i + 2, cb), url: md.slice(cb + 2, cp), start: i, end: cp + 1 });
        i = cp + 1; bufStart = i;
        continue;
      }
    }

    // [ link ](url)
    if (c === '[') {
      const cb = md.indexOf('](', i + 1);
      const cp = cb > i ? md.indexOf(')', cb + 2) : -1;
      if (cp > cb) {
        flush(i);
        segments.push({ type: 'link', text: md.slice(i + 1, cb), url: md.slice(cb + 2, cp), start: i, end: cp + 1 });
        i = cp + 1; bufStart = i;
        continue;
      }
    }

    // *italic* or _italic_
    if ((c === '*' && c2 !== '*') || (c === '_' && c2 !== '_')) {
      const m = c;
      const end = md.indexOf(m, i + 1);
      if (end > i) {
        flush(i);
        segments.push({ type: 'em', text: md.slice(i + 1, end), start: i, end: end + 1 });
        i = end + 1; bufStart = i;
        continue;
      }
    }

    // ^sup^
    if (c === '^') {
      const end = md.indexOf('^', i + 1);
      if (end > i) {
        flush(i);
        segments.push({ type: 'sup', text: md.slice(i + 1, end), start: i, end: end + 1 });
        i = end + 1; bufStart = i;
        continue;
      }
    }

    // ~sub~
    if (c === '~' && c2 !== '~') {
      const end = md.indexOf('~', i + 1);
      if (end > i) {
        flush(i);
        segments.push({ type: 'sub', text: md.slice(i + 1, end), start: i, end: end + 1 });
        i = end + 1; bufStart = i;
        continue;
      }
    }

    // $math$
    if (c === '$') {
      const end = md.indexOf('$', i + 1);
      if (end > i) {
        flush(i);
        segments.push({ type: 'math', tex: md.slice(i + 1, end), display: false, start: i, end: end + 1 });
        i = end + 1; bufStart = i;
        continue;
      }
    }

    // <html>
    if (c === '<') {
      const end = md.indexOf('>', i + 1);
      if (end > i) {
        flush(i);
        segments.push({ type: 'html', raw: md.slice(i, end + 1), start: i, end: end + 1 });
        i = end + 1; bufStart = i;
        continue;
      }
    }

    buf += c;
    i++;
  }

  flush(md.length);
  return segments;
}

// ── renderer ──

function MathSegment({ tex, display }: { tex: string; display: boolean }) {
  try {
    const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <span className="text-red-500">${tex}$</span>;
  }
}

function MdMeta({ marker }: { marker: string }) {
  return <span className="md-meta">{marker}</span>;
}

interface InlineContentProps {
  segments: InlineSegment[];
  onSegmentClick?: (sourcePos: number) => void;
}

export function InlineContent({ segments, onSegmentClick }: InlineContentProps) {
  return (
    <>
      {segments.map((seg, i) => {
        const clickable = seg.type !== 'image' && seg.type !== 'math' && seg.type !== 'html';
        const handleClick = clickable && onSegmentClick
          ? ((e: React.MouseEvent) => { e.stopPropagation(); onSegmentClick(seg.start); })
          : undefined;

        switch (seg.type) {
          case 'text':
            return <span key={i} onClick={handleClick} className="cursor-text">{seg.text}</span>;
          case 'strong':
            return <strong key={i} onClick={handleClick} className="cursor-text"><MdMeta marker="**" />{seg.text}<MdMeta marker="**" /></strong>;
          case 'em':
            return <em key={i} onClick={handleClick} className="cursor-text"><MdMeta marker="*" />{seg.text}<MdMeta marker="*" /></em>;
          case 'del':
            return <del key={i} onClick={handleClick} className="cursor-text opacity-70"><MdMeta marker="~~" />{seg.text}<MdMeta marker="~~" /></del>;
          case 'strong_em':
            return <strong key={i} onClick={handleClick} className="cursor-text"><em><MdMeta marker="***" />{seg.text}<MdMeta marker="***" /></em></strong>;
          case 'sub':
            return <sub key={i} onClick={handleClick} className="cursor-text"><MdMeta marker="~" />{seg.text}<MdMeta marker="~" /></sub>;
          case 'sup':
            return <sup key={i} onClick={handleClick} className="cursor-text"><MdMeta marker="^" />{seg.text}<MdMeta marker="^" /></sup>;
          case 'mark':
            return <mark key={i} onClick={handleClick} className="cursor-text bg-yellow-200 dark:bg-yellow-800 text-inherit"><MdMeta marker="==" />{seg.text}<MdMeta marker="==" /></mark>;
          case 'code':
            return (
              <code key={i} onClick={handleClick} className="cursor-text font-mono text-[0.875em] bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-1 py-0.5 rounded">
                <MdMeta marker="`" />{seg.text}<MdMeta marker="`" />
              </code>
            );
          case 'link':
            return (
              <a key={i} href={seg.url} onClick={handleClick} className="cursor-text text-blue-500 hover:underline">
                <MdMeta marker="[" />{seg.text}<MdMeta marker="](url)" />
              </a>
            );
          case 'image':
            return <img key={i} src={seg.url} alt={seg.alt} className="max-w-full rounded" />;
          case 'math':
            return <MathSegment key={i} tex={seg.tex} display={seg.display} />;
          case 'html':
            return <span key={i} dangerouslySetInnerHTML={{ __html: seg.raw }} />;
          default:
            return null;
        }
      })}
    </>
  );
}
