import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { animate, utils } from 'animejs';
import type { Post } from '../lib/content';
import { useGoBack } from './page-reveal-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import PostCard from './PostCard';
import Reveal from './effects/Reveal';
import YearMarks, { type YearGroup } from './YearMarks';
import './PostList.css';

export type PostListProps = {
  /** posts to display (already sorted/filtered by the caller) */
  posts: Post[];
  /** page heading */
  title: string;
  /** show a back control (history back, falling back to `backFallback`) */
  showBack?: boolean;
  backFallback?: string;
  /** group cards by year (default true); otherwise a flat list */
  groupByYear?: boolean;
  /** max number of posts to show; undefined = all */
  limit?: number;
  /** render the right-edge year rail (YearMarks); only applies when
   *  `groupByYear` is true (default true) */
  yearRail?: boolean;
  /** hide the year rail when the list has fewer than this many posts (it is
   *  only useful once there is enough content to navigate) */
  minRailPosts?: number;
};

/**
 * Reusable post collection page built from PostCard: title (optional back),
 * cards grouped by year (or flat). Used by Archive, tag pages and anywhere a
 * post list is needed.
 *
 * Entrance is a per-card queue in document order: only the first not-yet-
 * revealed item that has reached the viewport animates at a time, then the
 * next visible one follows — cards light up one by one (never whole-group /
 * whole-list), always top → bottom, with no out-of-order or gap flashes even
 * when a deep link / history restore lands mid-list.
 */
export default function PostList({
  posts,
  title,
  showBack = false,
  backFallback = 'home',
  groupByYear = true,
  limit,
  yearRail = true,
  minRailPosts = 6,
}: PostListProps) {
  const goBack = useGoBack(backFallback);
  const listRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const visible = limit === undefined ? posts : posts.slice(0, limit);

  let groups: { key: string; list: Post[] }[] = [];
  if (visible.length > 0) {
    if (groupByYear) {
      const byYear = new Map<string, Post[]>();
      for (const post of visible) {
        const year = post.date ? post.date.slice(0, 4) : '—';
        const list = byYear.get(year) ?? [];
        list.push(post);
        byYear.set(year, list);
      }
      groups = [...byYear.entries()].map(([key, list]) => ({ key, list }));
    } else {
      groups = [{ key: 'all', list: visible }];
    }
  }

  const yearGroups: YearGroup[] =
    groupByYear && yearRail && visible.length >= minRailPosts
      ? groups.map((g) => ({
          year: g.key,
          posts: g.list.map((p) => ({ slug: p.slug, title: p.title })),
        }))
      : [];

  const itemCount =
    groups.reduce((acc, g) => acc + g.list.length, 0) +
    (groupByYear ? groups.length : 1);

  // queue every year heading + card in document order, but run several at a
  // time: up to `MAX_CONCURRENT` in-view items animate concurrently (with a
  // small stagger), so a fast scroll to the bottom reveals everything below
  // quickly instead of waiting for the items above to finish one by one.
  useLayoutEffect(() => {
    const root = listRef.current;
    if (!root || itemCount === 0) return;
    // document-order items: year headings first, then their cards
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('.post-list__year, .post-card-wrap'),
    );
    if (items.length === 0) return;

    if (reduced) {
      utils.set(items, { opacity: 1, translateY: 0 });
      return;
    }
    utils.set(items, { opacity: 0, translateY: 20 });

    const done = new Array<boolean>(items.length).fill(false);
    const running = new Set<number>();
    const MAX_CONCURRENT = 5;
    const STAGGER = 45; // ms between items started in the same pass
    let raf = 0;

    const playNext = () => {
      const vh = window.innerHeight;
      let started = 0;
      for (let i = 0; i < items.length; i++) {
        if (done[i] || running.has(i)) continue;
        const r = items[i].getBoundingClientRect();
        // completely above the viewport: already scrolled past, skip (it
        // will play again if the user scrolls back up into it)
        if (r.bottom <= -40) continue;
        // still below the viewport: later items are further down, wait
        if (r.top >= vh - 40) break;
        const isHeading = items[i].classList.contains('post-list__year');
        running.add(i);
        animate(items[i], {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: isHeading ? 200 : 260,
          delay: started * STAGGER,
          ease: 'out(3)',
          composition: 'replace',
          onComplete: () => {
            running.delete(i);
            done[i] = true;
            // free a slot: pull the next item below once it's in view
            if (running.size < MAX_CONCURRENT) schedule();
          },
        });
        started++;
        if (started >= MAX_CONCURRENT) break;
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(playNext);
    };

    playNext();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [itemCount, reduced]);

  const backButton: ReactNode = showBack ? (
    <button type="button" className="post-list__back" onClick={goBack}>
      ← Back
    </button>
  ) : null;

  return (
    <>
      <div className="post-list" ref={listRef}>
        {backButton}
        <Reveal>
          <h1 className="post-list__title">{title}</h1>
        </Reveal>
        {groups.length === 0 ? (
          <p className="post-list__empty">No posts yet.</p>
        ) : (
          groups.map((group) => (
            <section
              key={group.key}
              className="post-list__group"
              data-year={group.key}
            >
              {groupByYear ? <h2 className="post-list__year">{group.key}</h2> : null}
              <div className="post-list__cards">
                {group.list.map((post) => (
                  <PostCard key={post.slug} post={post} reveal={false} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      {yearGroups.length > 0 ? <YearMarks groups={yearGroups} /> : null}
    </>
  );
}
