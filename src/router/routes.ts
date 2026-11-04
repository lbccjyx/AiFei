/**
 * Bidirectional mapping between internal page ids and real URL paths.
 *
 * Pages can be opened directly via meaningful paths — `/timeline`, `/todo`,
 * `/gallery`, `/diary`, `/posts/<slug>`, `/tags/<tag>` — so links are
 * shareable and survive a cold load. Right after boot the router folds the
 * address bar back to the site root (keeping the page in `history.state`),
 * which is why in-app navigation shows a clean root URL while deep links
 * still work.
 *
 * Path returned here is a root-relative path WITHOUT the deployment base;
 * the router prepends/strips `import.meta.env.BASE_URL` as needed.
 */
import { getPost, getTags } from '../lib/content';

const STATIC_PATHS: Record<string, string> = {
  home: '/',
  timeline: '/timeline',
  todo: '/todo',
  gallery: '/gallery',
  admin: '/admin',
  diary: '/diary',
  about: '/about',
};

/** 旧地址继续可用，别让分享出去的链接失效 */
const ALIASES: Record<string, string> = {
  '/archive': 'diary',
  '/lab': 'home',
};

/** page id → root-relative path, e.g. `post:hello` → `/posts/hello`. */
export function pageIdToPath(pageId: string): string {
  const staticPath = STATIC_PATHS[pageId];
  if (staticPath) return staticPath;
  if (pageId.startsWith('post:')) {
    return `/posts/${encodeURIComponent(pageId.slice('post:'.length))}`;
  }
  if (pageId.startsWith('tag:')) {
    return `/tags/${encodeURIComponent(pageId.slice('tag:'.length))}`;
  }
  return '/';
}

/**
 * Root-relative path → page id. Unknown paths resolve to a special
 * `not-found:<rawPath>` id so the 404 view can show what was requested.
 */
export function pathToPageId(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/') return 'home';
  const alias = ALIASES[path];
  if (alias) return alias;
  const staticId = Object.keys(STATIC_PATHS).find(
    (id) => STATIC_PATHS[id] === path,
  );
  if (staticId) return staticId;

  const postMatch = /^\/posts\/(.+)$/.exec(path);
  if (postMatch) {
    const slug = decodeURIComponent(postMatch[1]);
    if (slug && getPost(slug)) return `post:${slug}`;
    return `not-found:${path}`;
  }

  const tagMatch = /^\/tags\/(.+)$/.exec(path);
  if (tagMatch) {
    const tag = decodeURIComponent(tagMatch[1]);
    if (tag && getTags().includes(tag)) return `tag:${tag}`;
    return `not-found:${path}`;
  }

  return `not-found:${path}`;
}
