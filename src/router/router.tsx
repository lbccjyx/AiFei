import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PageRouterContext, type PageState, type NavigateOptions } from './context';
import { pathToPageId } from './routes';

const LS_KEY = 'blog:page';
const STATE_KEY = 'blogPage';
const HOME: PageState = { pageId: 'home', scrollY: 0 };

/**
 * Single-root router with real history support but a clean URL.
 *
 * Pages are directly reachable through real paths — `/archive`,
 * `/posts/<slug>`, `/tags/<tag>` — so shared links and refreshes work. On boot
 * such a deep link is rendered, then the address bar is folded back to the
 * site root while the page itself lives in the history entry's `state`:
 * the entry that arrived with the path becomes "home", and a fresh root entry
 * carrying the deep page sits on top, so the URL stays clean and Back still
 * moves Home → (leave site). In-app navigation likewise pushes state with an
 * identical root URL; Back/Forward (and mouse side buttons) fire `popstate`
 * and restore the corresponding page + scroll. Refresh on a folded entry
 * restores from history.state, with localStorage as a fallback.
 */
type HistoryState = { [STATE_KEY]: PageState };

function readHistoryState(): PageState | null {
  const entry = (history.state as HistoryState | null)?.[STATE_KEY];
  if (entry && typeof entry.pageId === 'string') {
    return {
      pageId: entry.pageId,
      scrollY: typeof entry.scrollY === 'number' ? entry.scrollY : 0,
    };
  }
  return null;
}

function readLocalState(): PageState | null {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<PageState>;
      if (parsed && typeof parsed.pageId === 'string') {
        return {
          pageId: parsed.pageId,
          scrollY: typeof parsed.scrollY === 'number' ? parsed.scrollY : 0,
        };
      }
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

/** Path relative to the deployment base, e.g. `/repo/posts/x` → `/posts/x`. */
function currentAppPath(): string {
  const base = import.meta.env.BASE_URL;
  const { pathname } = window.location;
  if (base !== '/') {
    const prefix = base.replace(/\/+$/, '');
    if (prefix && pathname.startsWith(prefix)) {
      return pathname.slice(prefix.length) || '/';
    }
  }
  return pathname;
}

/** Clean root URL: deployment base + optional preserved query, no hash. */
function rootUrl(search: string = window.location.search): string {
  return import.meta.env.BASE_URL + (search === '' ? '' : search);
}

type Boot = { page: PageState; deep: boolean };

/** Pure boot resolution (no history writes — safe under StrictMode). */
function resolveBoot(): Boot {
  const path = currentAppPath();
  if (path !== '/') {
    // real path deep link: resolve the page; the effect folds the URL
    return { page: { pageId: pathToPageId(path), scrollY: 0 }, deep: true };
  }

  // 根路径上没有 history.state 就是「新开一次站」：落在首页（封面）。
  // 刷新则保留 history.state，所以刷新不会把人踢回封面。localStorage 只在
  // 前进/后退遇到外来记录时兜底（见 popstate）。
  return { page: readHistoryState() ?? HOME, deep: false };
}

function restoreScroll(scrollY: number) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  });
}

export function PageRouterProvider({ children }: { children: ReactNode }) {
  const [boot] = useState<Boot>(resolveBoot);
  const [page, setPage] = useState<PageState>(boot.page);
  const seeded = useRef(false);

  const navigate = useCallback((pageId: string, opts?: NavigateOptions) => {
    const scrollY = opts?.scrollTo ?? 0;
    const next: PageState = { pageId, scrollY };
    setPage(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    const entry: HistoryState = { [STATE_KEY]: next };
    if (opts?.replace) {
      history.replaceState(entry, '', window.location.href);
    } else {
      history.pushState(entry, '', window.location.href);
    }
    restoreScroll(scrollY);
  }, []);

  // back / forward (including mouse side buttons)
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const entry = (event.state as HistoryState | null)?.[STATE_KEY];
      if (!entry || typeof entry.pageId !== 'string') {
        // foreign entry (e.g. arrived from another site) — fall back
        setPage(readLocalState() ?? HOME);
        restoreScroll(0);
        return;
      }
      setPage({ pageId: entry.pageId, scrollY: entry.scrollY || 0 });
      restoreScroll(entry.scrollY || 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Seed history + restore scroll once. Deep links get folded here: the
  // arriving entry (url=/posts/…) is rewritten to a clean root entry holding
  // Home, then a second root entry holding the deep page is pushed on top —
  // the address bar is clean, rendered page unchanged, Back lands on Home.
  useEffect(() => {
    // StrictMode runs mount effects twice in dev; the history seeding must
    // happen exactly once or deep links accumulate duplicate root entries
    if (seeded.current) return;
    seeded.current = true;

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    if (boot.deep) {
      history.replaceState({ [STATE_KEY]: HOME }, '', rootUrl());
      history.pushState({ [STATE_KEY]: boot.page }, '', rootUrl());
    } else {
      // strip a legacy ?target= param and any stale hash from old routing
      const params = new URLSearchParams(window.location.search);
      params.delete('target');
      const query = params.toString();
      const clean =
        window.location.hash || window.location.search
          ? rootUrl(query ? `?${query}` : '')
          : window.location.pathname + window.location.search;
      const current = readHistoryState();
      if (
        !current ||
        current.pageId !== page.pageId ||
        current.scrollY !== page.scrollY ||
        window.location.search ||
        window.location.hash
      ) {
        history.replaceState({ [STATE_KEY]: page }, '', clean);
      }
    }

    try {
      localStorage.setItem(LS_KEY, JSON.stringify(page));
    } catch {
      /* storage unavailable */
    }
    restoreScroll(page.scrollY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ page, navigate }), [page, navigate]);

  return (
    <PageRouterContext.Provider value={value}>{children}</PageRouterContext.Provider>
  );
}
