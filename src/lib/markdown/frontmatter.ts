/**
 * Minimal frontmatter parser (self-written): `---`-delimited `key: value`
 * lines at the top of a content file. Supports string values and simple
 * `tags: [a, b]` / `tags: a, b` lists. Missing or malformed frontmatter
 * falls back to empty meta instead of throwing.
 */
export type Frontmatter = Record<string, string | string[]>;

export function parseFrontmatter(src: string): { meta: Frontmatter; body: string } {
  if (!src.startsWith('---')) return { meta: {}, body: src };

  const lines = src.split('\n');
  let endIdx = -1;
  for (let k = 1; k < Math.min(lines.length, 30); k++) {
    if (/^---\s*$/.test(lines[k])) {
      endIdx = k;
      break;
    }
  }
  if (endIdx < 0) return { meta: {}, body: src };

  const raw = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join('\n');
  const meta: Frontmatter = {};

  for (const line of raw) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    if (key === 'tags') {
      const items = value
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      meta[key] = items;
    } else if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      meta[key] = value.slice(1, -1);
    } else {
      meta[key] = value;
    }
  }

  return { meta, body };
}
