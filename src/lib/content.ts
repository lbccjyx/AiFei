import { parseFrontmatter } from './markdown/frontmatter';

/**
 * Content pipeline. Markdown/HTML files under `/content` are bundled at build
 * time (import.meta.glob). Convention: a content file `X.md` may have a
 * sibling folder `X/` holding its static assets; relative asset references
 * such as `![](./X/img.png)` resolve to the bundled URL of that file.
 */

const rawFiles = import.meta.glob('/content/**/*.{md,html}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const assetUrls = import.meta.glob(
  ['/content/**/*', '!/content/**/*.md', '!/content/**/*.html'],
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>;

export type ContentKind = 'md' | 'html';

export type Post = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
  cover: string | null;
  kind: ContentKind;
  raw: string;
  /** '/content/posts/hello-world.md' */
  file: string;
  /** '/content/posts/hello-world' (sibling asset folder) */
  dir: string;
};

function slugOf(file: string): string {
  return file.split('/').pop()!.replace(/\.[^.]+$/, '');
}

/** Directory containing the content file, e.g. '/content/posts'. */
function dirOf(file: string): string {
  const idx = file.lastIndexOf('/');
  return idx > 0 ? file.slice(0, idx) : '/';
}

function isExternal(rel: string): boolean {
  return (
    /^(https?:)?\/\//.test(rel) ||
    rel.startsWith('data:') ||
    rel.startsWith('/') ||
    rel.startsWith('#')
  );
}

/**
 * Resolves a relative asset reference for a content file, supporting both
 * conventions:
 * - explicit: `./hello-world/img.png` — relative to the md file's directory
 * - implicit: `./img.png` — resolves into the sibling asset folder
 *   (`<dir>/<slug>/img.png`)
 */
function resolveAssetFor(
  post: { file: string; slug: string },
  rel: string,
): string | null {
  if (isExternal(rel)) return rel;
  const clean = rel.replace(/^\.\//, '').split('?')[0].split('#')[0];
  const mdDir = dirOf(post.file);
  const explicit = `${mdDir}/${clean}`;
  if (assetUrls[explicit]) return assetUrls[explicit];
  const implicit = `${mdDir}/${post.slug}/${clean}`;
  return assetUrls[implicit] ?? null;
}

function parsePost(file: string): Post {
  const raw = rawFiles[file] ?? '';
  const { meta, body } = parseFrontmatter(raw);
  const slug = slugOf(file);
  const kind: ContentKind = file.endsWith('.html') ? 'html' : 'md';
  const title = typeof meta.title === 'string' && meta.title ? meta.title : slug;
  const date = typeof meta.date === 'string' ? meta.date : '';
  const tags = Array.isArray(meta.tags)
    ? meta.tags
    : typeof meta.tags === 'string' && meta.tags
      ? [meta.tags]
      : [];
  const excerpt = typeof meta.excerpt === 'string' ? meta.excerpt : '';
  const coverRef = typeof meta.cover === 'string' ? meta.cover : '';
  const dir = dirOf(file);
  const base = { file, slug };
  return {
    slug,
    title,
    date,
    tags,
    excerpt,
    cover: coverRef ? resolveAssetFor(base, coverRef) : null,
    kind,
    raw: body,
    file,
    dir,
  };
}

const allPosts = Object.keys(rawFiles)
  .filter((file) => file.startsWith('/content/posts/'))
  .map(parsePost)
  .sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug),
  );

export function getPosts(): Post[] {
  return allPosts;
}

/** Tag marking a post as hidden from the archive (still listed on tag pages). */
export const HIDDEN_TAG = 'hidden';

/** Posts shown on the archive page: everything not tagged `hidden`. */
export function getArchivePosts(): Post[] {
  return getPosts().filter((post) => !post.tags.includes(HIDDEN_TAG));
}

/** All distinct tags used across posts, sorted alphabetically. */
export function getTags(): string[] {
  return [...new Set(getPosts().flatMap((post) => post.tags))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Site-level content files (e.g. `/content/about.md`) by slug. */
function getSiteContent(slug: string): Post | null {
  const file = Object.keys(rawFiles).find(
    (f) => f === `/content/${slug}.md` || f === `/content/${slug}.html`,
  );
  return file ? parsePost(file) : null;
}

export function getPost(slug: string): Post | undefined {
  const found = allPosts.find((post) => post.slug === slug);
  if (found) return found;
  // site-level pages (about, …) render through the same post page
  return getSiteContent(slug) ?? undefined;
}

/** Resolves a relative asset path (e.g. `./hello-world/cover.svg`) for a post. */
export function resolveAsset(post: Post, rel: string): string | null {
  return resolveAssetFor({ file: post.file, slug: post.slug }, rel);
}
