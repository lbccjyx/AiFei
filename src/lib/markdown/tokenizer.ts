import type { Block, Inline, ListItem } from './ast';

/**
 * Self-written markdown tokenizer: a line-based block scanner plus a small
 * inline parser. Tolerant of malformed syntax (unclosed markers degrade to
 * literal text). Supports: headings, paragraphs, fenced code, blockquotes,
 * nested lists, hr, GFM-ish tables, images/links, emphasis, inline code,
 * autolinks, escapes, and raw HTML passthrough.
 */

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      i++;
      continue;
    }

    // fenced code block
    const fence = trimmed.match(/^(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/);
    if (fence) {
      const marker = fence[1][0];
      const lang = fence[2];
      const content: string[] = [];
      i++;
      while (i < lines.length) {
        if (new RegExp(`^${marker}{3,}\\s*$`).test(lines[i].trim())) {
          i++;
          break;
        }
        content.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', lang, text: content.join('\n') });
      continue;
    }

    // ATX heading
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        children: parseInline(heading[2]),
      });
      i++;
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // blockquote (allow indented quote markers, e.g. inside a list)
    if (/^>\s?/.test(trimmed)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', children: parseMarkdown(quote.join('\n')) });
      continue;
    }

    // table: header line + separator line
    if (
      i + 1 < lines.length &&
      /^\s*\|.*\|\s*$/.test(line) &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
      lines[i + 1].includes('-')
    ) {
      const head: Inline[][] = splitTableRow(line).map((cell) => parseInline(cell));
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitTableRow(lines[i]).map((cell) => parseInline(cell)));
        i++;
      }
      blocks.push({
        type: 'table',
        head,
        rows,
      });
      continue;
    }

    // list (possibly nested). Detect on the RAW line so indentation-based
    // nesting matches the raw lines consumed below.
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const ordered = /^\d+\.$/.test(listMatch[2]);
      const start = ordered ? Number(listMatch[2].replace('.', '')) : 1;
      const items: ListItem[] = [];

      while (i < lines.length) {
        const l = lines[i];
        const m = l.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (!m || m[1].length !== indent) break;
        const itemLines: string[] = [m[3]];
        i++;
        // consume continuation lines that are indented deeper than the marker
        while (i < lines.length) {
          const cont = lines[i];
          if (cont.trim() === '') {
            itemLines.push('');
            i++;
            continue;
          }
          const sibling = cont.match(/^(\s*)([-*+]|\d+\.)\s+/);
          if (sibling && sibling[1].length === indent) break;
          if (sibling && sibling[1].length < indent) break;
          if (/^\s+/.test(cont)) {
            itemLines.push(cont.slice(Math.min(indent + 2, cont.length)));
            i++;
            continue;
          }
          break;
        }
        items.push({ children: parseMarkdown(itemLines.join('\n')) });
      }

      blocks.push({ type: 'list', ordered, start, items });
      continue;
    }

    // raw HTML block: a line starting with '<', collected until blank line
    if (trimmed.startsWith('<')) {
      const html: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        html.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'html', html: html.join('\n') });
      continue;
    }

    // paragraph: accumulate until a blank line or another block starter
    const para: string[] = [line];
    i++;
    while (i < lines.length) {
      const l = lines[i];
      const t = l.trim();
      if (t === '') break;
      if (/^(#{1,6})\s+/.test(t)) break;
      if (/^(`{3,}|~{3,})/.test(t)) break;
      if (/^>\s?/.test(t)) break;
      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(t)) break;
      if (/^(\s*)([-*+]|\d+\.)\s+/.test(l)) break;
      if (t.startsWith('<')) break;
      para.push(l);
      i++;
    }
    blocks.push({ type: 'paragraph', children: parseInline(para.join('\n')) });
  }

  return blocks;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const SPECIAL = new Set(['*', '_', '~', '`', '[', '!', '<', '\\']);

/** Parses inline content into Inline nodes. */
export function parseInline(src: string): Inline[] {
  const nodes: Inline[] = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];

    // inline code span
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i) {
        nodes.push({ type: 'code', text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
      nodes.push({ type: 'text', text: ch });
      i++;
      continue;
    }

    // escape
    if (ch === '\\' && i + 1 < n) {
      nodes.push({ type: 'text', text: src[i + 1] });
      i += 2;
      continue;
    }

    // image ![alt](url "title")
    if (ch === '!' && src[i + 1] === '[') {
      const parsed = tryParseLinkish(src, i + 1);
      if (parsed) {
        nodes.push({ type: 'image', alt: parsed.text, src: parsed.url, title: parsed.title });
        i = parsed.end;
        continue;
      }
    }

    // link [text](url "title")
    if (ch === '[') {
      const parsed = tryParseLinkish(src, i);
      if (parsed) {
        nodes.push({
          type: 'link',
          href: parsed.url,
          title: parsed.title,
          children: parseInline(parsed.text),
        });
        i = parsed.end;
        continue;
      }
    }

    // strong ** ** or __ __
    if (src.startsWith('**', i) || src.startsWith('__', i)) {
      const marker = src.slice(i, i + 2);
      const end = src.indexOf(marker, i + 2);
      if (end > i) {
        nodes.push({ type: 'strong', children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    // strikethrough ~~ ~~
    if (src.startsWith('~~', i)) {
      const end = src.indexOf('~~', i + 2);
      if (end > i) {
        nodes.push({ type: 'del', children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    // emphasis * * or _ _
    if (ch === '*' || ch === '_') {
      const end = src.indexOf(ch, i + 1);
      if (end > i && end < n) {
        nodes.push({ type: 'em', children: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    // autolink / inline HTML <...>
    if (ch === '<') {
      const close = src.indexOf('>', i + 1);
      if (close > i) {
        const inner = src.slice(i + 1, close);
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(inner)) {
          nodes.push({
            type: 'link',
            href: inner,
            children: [{ type: 'text', text: inner }],
          });
          i = close + 1;
          continue;
        }
        if (/^\/?[a-zA-Z][^>]*$/.test(inner)) {
          nodes.push({ type: 'html', html: src.slice(i, close + 1) });
          i = close + 1;
          continue;
        }
      }
    }

    // plain text run
    let j = i + 1;
    while (j < n && !SPECIAL.has(src[j])) j++;
    nodes.push({ type: 'text', text: src.slice(i, j) });
    i = j;
  }

  return nodes;
}

type Linkish = { text: string; url: string; title?: string; end: number };

/** Parses `[text](url "title")` starting at the '[' at `start`. */
function tryParseLinkish(src: string, start: number): Linkish | null {
  const closeBracket = src.indexOf(']', start + 1);
  if (closeBracket < 0) return null;
  if (src[closeBracket + 1] !== '(') return null;
  const closeParen = src.indexOf(')', closeBracket + 2);
  if (closeParen < 0) return null;
  const inside = src.slice(closeBracket + 2, closeParen);
  const m = inside.match(/^(\S+?)(?:\s+["']([^"']*)["'])?\s*$/);
  if (!m) return null;
  return {
    text: src.slice(start + 1, closeBracket),
    url: m[1],
    title: m[2],
    end: closeParen + 1,
  };
}
