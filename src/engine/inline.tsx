// ── types ──

export type InlineSegment =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'em'; text: string }
  | { type: 'strong_em'; text: string }
  | { type: 'del'; text: string }
  | { type: 'mark'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'image'; alt: string; url: string };

// ── parser ──

export function parseInline(md: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let i = 0;
  let buf = '';

  function flush() {
    if (buf) { segments.push({ type: 'text', text: buf }); buf = ''; }
  }

  while (i < md.length) {
    const c = md[i];
    const c2 = md[i + 1];

    if (c === '\\' && c2) { buf += c2; i += 2; continue; }

    // *** bold+italic *** or ___
    if ((c === '*' && c2 === '*' && md[i + 2] === '*') || (c === '_' && c2 === '_' && md[i + 2] === '_')) {
      const m = c === '*' ? '***' : '___';
      const end = md.indexOf(m, i + 3);
      if (end > i) { flush(); segments.push({ type: 'strong_em', text: md.slice(i + 3, end) }); i = end + 3; continue; }
    }

    // ** bold ** or __ bold __
    if ((c === '*' && c2 === '*') || (c === '_' && c2 === '_')) {
      const m = c === '*' ? '**' : '__';
      const end = md.indexOf(m, i + 2);
      if (end > i) { flush(); segments.push({ type: 'strong', text: md.slice(i + 2, end) }); i = end + 2; continue; }
    }

    // == highlight ==
    if (c === '=' && c2 === '=') {
      const end = md.indexOf('==', i + 2);
      if (end > i) { flush(); segments.push({ type: 'mark', text: md.slice(i + 2, end) }); i = end + 2; continue; }
    }

    // ~~ del ~~
    if (c === '~' && c2 === '~') {
      const end = md.indexOf('~~', i + 2);
      if (end > i) { flush(); segments.push({ type: 'del', text: md.slice(i + 2, end) }); i = end + 2; continue; }
    }

    // ` code `
    if (c === '`') {
      const end = md.indexOf('`', i + 1);
      if (end > i) { flush(); segments.push({ type: 'code', text: md.slice(i + 1, end) }); i = end + 1; continue; }
    }

    // ![ image ](url)
    if (c === '!' && c2 === '[') {
      const cb = md.indexOf('](', i + 2);
      const cp = cb > i ? md.indexOf(')', cb + 2) : -1;
      if (cp > cb) { flush(); segments.push({ type: 'image', alt: md.slice(i + 2, cb), url: md.slice(cb + 2, cp) }); i = cp + 1; continue; }
    }

    // [ link ](url)
    if (c === '[') {
      const cb = md.indexOf('](', i + 1);
      const cp = cb > i ? md.indexOf(')', cb + 2) : -1;
      if (cp > cb) { flush(); segments.push({ type: 'link', text: md.slice(i + 1, cb), url: md.slice(cb + 2, cp) }); i = cp + 1; continue; }
    }

    // *italic* or _italic_
    if ((c === '*' && c2 !== '*') || (c === '_' && c2 !== '_')) {
      const m = c;
      const end = md.indexOf(m, i + 1);
      if (end > i) { flush(); segments.push({ type: 'em', text: md.slice(i + 1, end) }); i = end + 1; continue; }
    }

    buf += c;
    i++;
  }

  flush();
  return segments;
}

// ── rendered offset → source offset ──

export function renderedOffsetToSource(renderedOffset: number, md: string): number {
  const segs = parseInline(md);
  let rPos = 0;
  let sPos = 0;

  for (const seg of segs) {
    const rawText = seg.type === 'image' ? seg.alt : (seg as any).text as string;
    const rLen = rawText.length;
    const sLen = seg.type === 'text' ? rLen
      : seg.type === 'strong' ? rLen + 4      // **...**
      : seg.type === 'em' ? rLen + 2           // *...*
      : seg.type === 'strong_em' ? rLen + 6    // ***...***
      : seg.type === 'del' ? rLen + 4          // ~~...~~
      : seg.type === 'mark' ? rLen + 4         // ==...==
      : seg.type === 'code' ? rLen + 2         // `...`
      : seg.type === 'link' ? rLen + seg.url.length + 4  // [...](url)
      : seg.type === 'image' ? (seg.alt.length + seg.url.length + 5) // ![alt](url)
      : rLen;

    if (renderedOffset < rPos + rLen) {
      const openLen = seg.type === 'text' ? 0
        : seg.type === 'strong' ? 2
        : seg.type === 'em' ? 1
        : seg.type === 'strong_em' ? 3
        : seg.type === 'del' ? 2
        : seg.type === 'mark' ? 2
        : seg.type === 'code' ? 1
        : seg.type === 'link' ? 1
        : seg.type === 'image' ? 2
        : 0;
      return sPos + openLen + (renderedOffset - rPos);
    }
    rPos += rLen;
    sPos += sLen;
  }
  return sPos;
}

// ── renderer ──

export function InlineRenderer({ text }: { text: string }) {
  if (!text) return null;
  const segs = parseInline(text);
  return <>{segs.map(renderSeg)}</>;
}

function renderSeg(seg: InlineSegment, i: number) {
  switch (seg.type) {
    case 'text':   return <span key={i}>{seg.text}</span>;
    case 'strong': return <strong key={i}>{seg.text}</strong>;
    case 'em':     return <em key={i}>{seg.text}</em>;
    case 'strong_em': return <strong key={i}><em>{seg.text}</em></strong>;
    case 'del':    return <del key={i} className="opacity-70">{seg.text}</del>;
    case 'mark':   return <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit">{seg.text}</mark>;
    case 'code':   return <code key={i} className="font-mono text-[0.875em] bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-1 py-0.5 rounded">{seg.text}</code>;
    case 'link':   return <a key={i} href={seg.url} className="text-blue-500 hover:underline">{seg.text}</a>;
    case 'image':  return <img key={i} src={seg.url} alt={seg.alt} className="max-w-full rounded" />;
  }
}

// ── editable inline: active segment shows raw markers ──

export function InlineEditable({ text, offset, isActive }: { text: string; offset: number; isActive: boolean }) {
  if (!text) return <>{'​'}</>;
  if (!isActive) return <InlineRenderer text={text} />;

  const segs = parseInline(text);
  let sPos = 0;
  let activeIdx = -1;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const sLen = segSrcLen(seg);
    if (offset >= sPos && offset <= sPos + sLen) { activeIdx = i; break; }
    sPos += sLen;
  }

  // If at boundary between segments, prefer the next one if it has markers
  if (activeIdx < 0) {
    // Fallback: find the segment that ENDS at offset (boundary case)
    let sPos2 = 0;
    for (let i = 0; i < segs.length; i++) {
      const sl = segSrcLen(segs[i]);
      if (offset === sPos2 + sl && i + 1 < segs.length && segs[i + 1].type !== 'text') {
        activeIdx = i + 1; break;
      }
      sPos2 += sl;
    }
  }
  // If cursor at boundary of text segment touching a marker segment, prefer the marker one
  if (activeIdx >= 0 && segs[activeIdx].type === 'text') {
    let boundary = 0;
    for (let i = 0; i <= activeIdx; i++) boundary += segSrcLen(segs[i]);
    if (offset === boundary && activeIdx + 1 < segs.length && segs[activeIdx + 1].type !== 'text') {
      activeIdx = activeIdx + 1;
    }
  }
  // Also check start boundary: cursor at start of text segment, prev segment has markers
  if (activeIdx >= 0 && segs[activeIdx].type === 'text') {
    let boundary = 0;
    for (let i = 0; i < activeIdx; i++) boundary += segSrcLen(segs[i]);
    if (offset === boundary && activeIdx > 0 && segs[activeIdx - 1].type !== 'text') {
      activeIdx = activeIdx - 1;
    }
  }

  if (activeIdx < 0) return <InlineRenderer text={text} />;

  let segStart = 0;
  return (
    <>
      {segs.map((seg, i) => {
        const srcLen = segSrcLen(seg);
        const start = segStart;
        segStart += srcLen;
        const type = seg.type;
        if (i === activeIdx) {
          const raw = segToMarkdown(seg);
          return <span key={i} data-seg-start={start} data-seg-end={start + srcLen} data-seg-type={type} data-seg-raw="1">{raw}</span>;
        }
        return <span key={i} data-seg-start={start} data-seg-end={start + srcLen} data-seg-type={type}>{renderSeg(seg, i)}</span>;
      })}
    </>
  );
}

function segSrcLen(seg: InlineSegment): number {
  const inner = seg.type === 'image' ? seg.alt.length : (seg as any).text.length as number;
  if (seg.type === 'text') return inner;
  if (seg.type === 'strong') return inner + 4;
  if (seg.type === 'em') return inner + 2;
  if (seg.type === 'strong_em') return inner + 6;
  if (seg.type === 'del') return inner + 4;
  if (seg.type === 'mark') return inner + 4;
  if (seg.type === 'code') return inner + 2;
  if (seg.type === 'link') return inner + seg.url.length + 4;
  if (seg.type === 'image') return inner + seg.url.length + 5;
  return inner;
}

function segToMarkdown(seg: InlineSegment): string {
  switch (seg.type) {
    case 'text':   return seg.text;
    case 'strong': return '**' + seg.text + '**';
    case 'em':     return '*' + seg.text + '*';
    case 'strong_em': return '***' + seg.text + '***';
    case 'del':    return '~~' + seg.text + '~~';
    case 'mark':   return '==' + seg.text + '==';
    case 'code':   return '`' + seg.text + '`';
    case 'link':   return '[' + seg.text + '](' + seg.url + ')';
    case 'image':  return '![' + seg.alt + '](' + seg.url + ')';
  }
}
