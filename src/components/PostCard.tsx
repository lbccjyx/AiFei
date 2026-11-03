import { type KeyboardEvent } from 'react';
import { usePageReveal } from './page-reveal-context';
import { formatDate } from '../lib/format';
import type { Post } from '../lib/content';
import TagPill from './TagPill';
import Reveal from './effects/Reveal';
import Fx from './Fx';
import './PostCard.css';

/**
 * Post card. By default it fades in on scroll with a small stagger based on
 * `index`. When used inside a list that already animates whole year groups
 * (`PostList` with `groupByYear`), pass `reveal={false}` so cards appear
 * together with their group instead of racing their own entrance timers.
 */
export default function PostCard({
  post,
  index = 0,
  reveal = true,
}: {
  post: Post;
  index?: number;
  reveal?: boolean;
}) {
  const startReveal = usePageReveal();

  const openFromKeyboard = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    startReveal(`post:${post.slug}`, window.innerWidth / 2, window.innerHeight / 2);
  };

  const card = (
    <div className="post-card-wrap">
      <Fx
        as="article"
        tilt
        click={`post:${post.slug}`}
        className="post-card"
        data-slug={post.slug}
        aria-label={post.title}
        onKeyDown={openFromKeyboard}
      >
        <header className="post-card__head">
          <time className="post-card__date">{formatDate(post.date)}</time>
          <div className="post-card__tags">
            {post.tags.map((tag) => (
              <TagPill key={tag} tag={tag} interactive={false} />
            ))}
          </div>
        </header>
        <h3 className="post-card__title">{post.title}</h3>
        {post.excerpt ? <p className="post-card__excerpt">{post.excerpt}</p> : null}
        {post.cover ? (
          <img className="post-card__cover" src={post.cover} alt="" loading="lazy" />
        ) : null}
      </Fx>
    </div>
  );

  if (!reveal) return card;

  return <Reveal delay={index * 40} duration={360}>{card}</Reveal>;
}
