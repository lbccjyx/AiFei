/**
 * Bidirectional mapping between internal page ids and real URL paths.
 *
 * Pages can be opened directly via meaningful paths — `/timeline`, `/todo`,
 * `/gallery` — so links are shareable and survive a cold load. Right after
 * boot the router folds the address bar back to the site root (keeping the
 * page in `history.state`), which is why in-app navigation shows a clean root
 * URL while deep links still work.
 *
 * Path returned here is a root-relative path WITHOUT the deployment base;
 * the router prepends/strips `import.meta.env.BASE_URL` as needed.
 */

const STATIC_PATHS: Record<string, string> = {
  home: '/',
  timeline: '/timeline',
  todo: '/todo',
  gallery: '/gallery',
  admin: '/admin',
};

/** page id → root-relative path */
export function pageIdToPath(pageId: string): string {
  return STATIC_PATHS[pageId] ?? '/';
}

/**
 * Root-relative path → page id. Unknown paths resolve to a special
 * `not-found:<rawPath>` id so the 404 view can show what was requested.
 */
export function pathToPageId(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/') return 'home';
  const staticId = Object.keys(STATIC_PATHS).find((id) => STATIC_PATHS[id] === path);
  if (staticId) return staticId;

  return `not-found:${path}`;
}
