/**
 * Site-level configuration.
 *
 * Every brand-facing string is read from here so the codebase can be reused
 * as a template without touching components. Values can be overridden at
 * build time via Vite env vars (see `.env` / `.env.example`):
 *
 *   VITE_SITE_NAME      — hero title and document title suffix
 *   VITE_SITE_SUBTITLE  — hero tagline
 *   VITE_SITE_ABOUT     — short teaser shown in the home About section
 *
 * Vite only exposes vars prefixed with `VITE_`; see
 * https://vite.dev/guide/env-and-mode.html
 */

function env(name: string, fallback: string): string {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export const siteConfig = {
  name: env('VITE_SITE_NAME', 'My Blog'),
  subtitle: env('VITE_SITE_SUBTITLE', 'A minimalist blog template'),
  about: env(
    'VITE_SITE_ABOUT',
    'A minimalist blog template. Every component is customizable — cards, ' +
      'buttons, animations and the markdown renderer.',
  ),
};
