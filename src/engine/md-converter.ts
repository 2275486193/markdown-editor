import TurndownService from 'turndown';

const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});

// Custom rules for elements turndown doesn't handle natively
td.addRule('del', { filter: 'del', replacement: (c) => '~~' + c + '~~' });
td.addRule('mark', { filter: 'mark', replacement: (c) => '==' + c + '==' });
td.addRule('sub', { filter: 'sub', replacement: (c) => '~' + c + '~' });
td.addRule('sup', { filter: 'sup', replacement: (c) => '^' + c + '^' });

function stripMdMeta(html: string): string {
  return html.replace(/<span class="md-meta"[^>]*>.*?<\/span>/g, '');
}

// Remove turndown's automatic backslash escapes for markdown syntax chars.
// Users type plain * > - etc as formatting; literal chars use manual \*.
function unescapeMarkdownSyntax(md: string): string {
  return md.replace(/\\([*>_~`#+\-={}|.!\[\]])/g, '$1');
}

export function htmlToMarkdown(html: string): string {
  const clean = stripMdMeta(html);
  const raw = td.turndown(clean);
  return unescapeMarkdownSyntax(raw);
}
