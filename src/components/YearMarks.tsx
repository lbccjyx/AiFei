import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, utils } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './YearMarks.css';

export type YearGroup = {
  year: string;
  posts: { slug: string; title: string }[];
};

/** one evenly-spaced mark in the rail, in display order (newest first) */
type Item =
  | { kind: 'dot'; year: string }
  | { kind: 'tick'; year: string; slug: string; title: string };

const TOP_PAD = 2; // % inset from rail top/bottom so marks don't clip

/**
 * Right-edge rail for the Archive page, modelled on dsh's turn navigation.
 *
 * Marks are laid out uniformly top → bottom in display order (newest first):
 * each year contributes a circular dot followed by one thin bar per article
 * of that year, so dots and ticks are evenly spaced regardless of how tall
 * each year's content is on the page.
 *
 * Selection: while scrolling, the active article is the last card whose top
 * is above the reading line (near the top of the viewport); the page bottom
 * always selects the oldest article. Clicking a mark selects it immediately
 * and pins it until the user scrolls by hand (wheel / touch / scrollbar /
 * scroll keys). Hovering reveals the year / article title.
 */
export default function YearMarks({ groups }: { groups: YearGroup[] }) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const topsRef = useRef(new Map<string, number>());
  const dotEls = useRef(new Map<string, HTMLButtonElement>());
  const tickEls = useRef(new Map<string, HTMLButtonElement>());
  const pinnedRef = useRef(false);
  const [active, setActive] = useState<{ year: string; slug?: string }>({
    year: groups[0]?.year ?? '',
  });
  const activeRef = useRef(active);

  // memoize so the scroll-linked effect below keeps a stable identity across
  // re-renders (active-mark changes) instead of re-running its setup every time
  const years = useMemo(() => groups.map((g) => g.year), [groups]);
  const n = groups.length;

  const items: Item[] = [];
  for (const g of groups) {
    items.push({ kind: 'dot', year: g.year });
    for (const p of g.posts) {
      items.push({ kind: 'tick', year: g.year, slug: p.slug, title: p.title });
    }
  }
  const total = items.length;

  const select = (year: string, slug?: string) => {
    pinnedRef.current = true;
    const next = { year, slug };
    if (next.year !== activeRef.current.year || next.slug !== activeRef.current.slug) {
      activeRef.current = next;
      setActive(next);
    }
  };

  // --- entrance ------------------------------------------------
  // The rail appears immediately as one whole piece: a single right → left
  // fade-slide on the container. Marks are never staggered — every mark is
  // fully visible together with the rail.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.year-marks__mark'),
    );
    if (reduced) {
      utils.set(root, { opacity: 1, translateX: 0 });
      utils.set(buttons, { opacity: 1 });
      return;
    }
    utils.set(root, { opacity: 0, translateX: 22 });
    utils.set(buttons, { opacity: 1 });
    animate(root, {
      opacity: [0, 1],
      translateX: [22, 0],
      duration: 420,
      delay: 40,
      ease: 'out(3)',
      composition: 'replace',
    });
  }, [reduced, groups]);

  // --- release the pinned selection on manual scrolling ----------
  useEffect(() => {
    if (n === 0) return;
    const release = () => {
      pinnedRef.current = false;
    };
    // clicking inside the rail (a mark) is a selection, not a manual scroll
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('.year-marks')) return;
      release();
    };
    const onKey = (e: KeyboardEvent) => {
      if (
        [' ', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key) ||
        e.key.startsWith('Arrow')
      ) {
        release();
      }
    };
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchmove', release, { passive: true });
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchmove', release);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [n]);

  // --- scroll-linked active article ------------------------------
  useEffect(() => {
    if (n === 0) return;

    // The DOM below is static while mounted — cache the queries once instead
    // of re-querying and re-measuring on every frame.
    const groupEls = Array.from(
      document.querySelectorAll<HTMLElement>('.post-list__group'),
    );
    if (groupEls.length !== n) return;
    const cardsByGroup = groupEls.map((el) =>
      Array.from(el.querySelectorAll<HTMLElement>('.post-card')),
    );

    let raf = 0;
    let queued = false;

    const update = () => {
      queued = false;
      const sy = window.scrollY;

      // remember year group tops for the jump targets
      for (let i = 0; i < groupEls.length; i++) {
        const el = groupEls[i];
        const year = el.dataset.year;
        if (!year || !years.includes(year)) return;
        topsRef.current.set(year, el.getBoundingClientRect().top + sy);
      }

      if (pinnedRef.current) return;

      // the current article = the first card that has not yet scrolled past
      // the top of the viewport (at page top that is simply the first card)
      let year = years[0];
      let slug: string | undefined;
      outer: for (let i = 0; i < n; i++) {
        const g = groups[i];
        const cards = cardsByGroup[i];
        for (let j = 0; j < cards.length; j++) {
          const bottom = cards[j].getBoundingClientRect().bottom + sy;
          if (bottom > sy + 1) {
            year = g.year;
            slug = g.posts[j]?.slug;
            break outer;
          }
        }
      }
      // nothing visible (content shorter than the viewport edge case) →
      // fall back to the oldest article at the bottom of the list
      if (!slug) {
        const last = groups[n - 1];
        year = last.year;
        slug = last.posts[last.posts.length - 1]?.slug;
      }

      const next = { year, slug };
      const prev = activeRef.current;
      if (next.year !== prev.year || next.slug !== prev.slug) {
        activeRef.current = next;
        setActive(next);
      }
    };

    // Coalesce scroll / resize / layout changes into a single rAF pass
    // instead of measuring on every frame: with a long archive a per-frame
    // forced-layout loop makes theme switches (and scrolling) janky.
    const schedule = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // re-sync when content height changes (e.g. lazy cover images loading)
    const listRoot = document.querySelector<HTMLElement>('.post-list');
    const ro = listRoot ? new ResizeObserver(schedule) : null;
    if (listRoot) ro?.observe(listRoot);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
    };
  }, [groups, years, n]);

  // --- pop the newly active mark --------------------------------
  useEffect(() => {
    if (reduced) return;
    let btn: HTMLButtonElement | null = null;
    if (active.slug) {
      btn = tickEls.current.get(active.slug) ?? null;
    } else if (active.year) {
      btn = dotEls.current.get(active.year) ?? null;
    }
    const el = btn?.querySelector<HTMLElement>('.year-marks__dot');
    if (!el) return;
    animate(el, {
      scale: [1.35, 1],
      duration: 260,
      ease: 'out(3)',
      composition: 'replace',
    });
  }, [active, reduced]);

  const scrollToArticle = (year: string, slug: string) => {
    select(year, slug);
    const card = Array.from(
      document.querySelectorAll<HTMLElement>('.post-card'),
    ).find((el) => el.dataset.slug === slug);
    if (!card) return;
    const top = card.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: Math.max(top - 88, 0),
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  const scrollToYear = (year: string) => {
    select(year);
    const top = topsRef.current.get(year);
    if (top === undefined) return;
    window.scrollTo({
      top: Math.max(top - 64, 0),
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  if (n === 0) return null;

  return (
    <nav className="year-marks" aria-label="跳转到年份或文章">
      <div className="year-marks__marks" ref={rootRef}>
        {items.map((item, idx) => {
          const pct =
            total > 1
              ? TOP_PAD + ((100 - TOP_PAD * 2) * idx) / (total - 1)
              : 50;
          if (item.kind === 'dot') {
            const yearActive = active.year === item.year && !active.slug;
            return (
              <button
                key={`dot-${item.year}`}
                type="button"
                ref={(el) => {
                  if (el) dotEls.current.set(item.year, el);
                  else dotEls.current.delete(item.year);
                }}
                className={`year-marks__mark year-marks__mark--dot${
                  yearActive ? ' year-marks__mark--active' : ''
                }`}
                style={{ top: `${pct}%` }}
                onClick={() => scrollToYear(item.year)}
                aria-label={`跳转到 ${item.year}`}
                aria-current={yearActive ? 'true' : undefined}
              >
                <span className="year-marks__dot" />
                <span className="year-marks__label">{item.year}</span>
              </button>
            );
          }
          const tickActive = active.year === item.year && active.slug === item.slug;
          return (
            <button
              key={`tick-${item.slug}`}
              type="button"
              ref={(el) => {
                if (el) tickEls.current.set(item.slug, el);
                else tickEls.current.delete(item.slug);
              }}
              data-slug={item.slug}
              className={`year-marks__mark year-marks__mark--tick${
                tickActive ? ' year-marks__mark--active' : ''
              }`}
              style={{ top: `${pct}%` }}
              onClick={() => scrollToArticle(item.year, item.slug)}
              aria-label={`跳转到 ${item.title}`}
              aria-current={tickActive ? 'true' : undefined}
            >
              <span className="year-marks__dot" />
              <span className="year-marks__label">{item.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
