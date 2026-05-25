// Real-time inline markdown parser. On every input, scans text around cursor
// for complete patterns (**text**, *text*, `code`, ~~del~~, ***text***)
// and replaces text nodes with formatted HTML elements.

const PATTERNS: { open: string; close: string; tag: string; reciprocal?: boolean }[] = [
  { open: '***', close: '***', tag: 'b' },       // placeholder for reciprocal
  { open: '~~',  close: '~~',  tag: 'del' },
  { open: '**',  close: '**',  tag: 'strong' },
  { open: '__',  close: '__',  tag: 'strong' },
  { open: '`',   close: '`',   tag: 'code' },
  { open: '*',   close: '*',   tag: 'em' },
  { open: '_',   close: '_',   tag: 'em' },
];

function placeCursorAtEnd(el: Element) {
  requestAnimationFrame(() => {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let last: Text | null = null;
    let n: Text | null = walker.nextNode() as Text | null;
    while (n) { last = n; n = walker.nextNode() as Text | null; }
    if (last) {
      range.setStart(last, last.length);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
}

export function processInlinePatterns(_root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return false;

  const range = sel.getRangeAt(0);
  const container = range.startContainer;

  // Only process text nodes
  if (container.nodeType !== Node.TEXT_NODE) return false;

  const text = container.textContent ?? '';
  const off = range.startOffset;

  // Get the text around cursor within this node
  const before = text.slice(0, off);
  const after = text.slice(off);

  // Try each pattern
  for (const p of PATTERNS) {
    if (p.open === '***') continue; // handled separately below

    const fullText = before + after;

    // Find ALL occurrences of the opening marker
    let searchFrom = 0;
    while (true) {
      const openIdx = fullText.indexOf(p.open, searchFrom);
      if (openIdx < 0) break;

      // Find closing marker after the opening
      const closeIdx = fullText.indexOf(p.close, openIdx + p.open.length);
      if (closeIdx < 0) { searchFrom = openIdx + 1; continue; }

      // Content between markers
      const innerText = fullText.slice(openIdx + p.open.length, closeIdx);
      if (!innerText.trim()) { searchFrom = closeIdx + p.close.length; continue; }

      // Cursor should be at or after the closing marker
      const closeEnd = closeIdx + p.close.length;
      if (off < closeIdx || off > closeEnd) { searchFrom = closeEnd; continue; }

      // Found a complete pattern! Replace in DOM.
      const parent = container.parentNode;
      if (!parent) { searchFrom = closeEnd; continue; }

      const beforeTxt = fullText.slice(0, openIdx);
      const afterTxt = fullText.slice(closeEnd);

      // Create wrapper
      const wrapper = document.createElement(p.tag);
      wrapper.textContent = innerText;

      // Create md-meta markers
      const om = document.createElement('span');
      om.className = 'md-meta'; om.textContent = p.open;
      const cm = document.createElement('span');
      cm.className = 'md-meta'; cm.textContent = p.close;

      // Replace: remove old text node, insert new nodes
      if (beforeTxt) parent.insertBefore(document.createTextNode(beforeTxt), container);
      parent.insertBefore(om, container);
      parent.insertBefore(wrapper, container);
      parent.insertBefore(cm, container);
      if (afterTxt) parent.insertBefore(document.createTextNode(afterTxt), container);
      parent.removeChild(container);

      placeCursorAtEnd(wrapper);
      return true;
    }
  }

  // Handle *** pattern (bold+italic reciprocal)
  const fullText = before + after;
  const openIdx3 = fullText.lastIndexOf('***');
  if (openIdx3 >= 0) {
    const closeIdx3 = fullText.indexOf('***', openIdx3 + 3);
    if (closeIdx3 >= 0) {
      const innerText = fullText.slice(openIdx3 + 3, closeIdx3);
      if (innerText.trim() && off >= closeIdx3 && off <= closeIdx3 + 3) {
        const parent = container.parentNode;
        if (parent) {
          const beforeTxt = fullText.slice(0, openIdx3);
          const afterTxt = fullText.slice(closeIdx3 + 3);
          const em = document.createElement('em');
          const strong = document.createElement('strong');
          strong.textContent = innerText;
          em.appendChild(strong);
          const om = document.createElement('span');
          om.className = 'md-meta'; om.textContent = '***';
          const cm = document.createElement('span');
          cm.className = 'md-meta'; cm.textContent = '***';
          if (beforeTxt) parent.insertBefore(document.createTextNode(beforeTxt), container);
          parent.insertBefore(om, container);
          parent.insertBefore(em, container);
          parent.insertBefore(cm, container);
          if (afterTxt) parent.insertBefore(document.createTextNode(afterTxt), container);
          parent.removeChild(container);
          placeCursorAtEnd(em);
          return true;
        }
      }
    }
  }

  return false;
}
