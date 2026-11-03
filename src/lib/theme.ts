export type Theme = 'light' | 'dark';

const LS_KEY = 'blog:theme';
const EVENT = 'blog:theme-change';

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Tab icon: white in light mode, black in dark mode (with a contrasting dot). */
function applyFavicon(theme: Theme) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  const body = theme === 'light' ? '#ffffff' : '#08060d';
  const dot = theme === 'light' ? '#08060d' : '#ffffff';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="${body}"/>` +
    `<circle cx="16" cy="16" r="4.5" fill="${dot}"/></svg>`;
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

applyFavicon(getTheme());

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(LS_KEY, theme);
  } catch {
    /* storage unavailable */
  }
  applyFavicon(theme);
  window.dispatchEvent(new CustomEvent<Theme>(EVENT, { detail: theme }));
}

export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function subscribeTheme(fn: (theme: Theme) => void): () => void {
  const handler = (event: Event) => fn((event as CustomEvent<Theme>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
