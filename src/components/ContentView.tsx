import { type ReactNode } from 'react';
import { resolveAsset, type Post } from '../lib/content';
import { markdownToReact } from '../lib/markdown/render';
import { formatDate } from '../lib/format';
import TagPill from './TagPill';
import Reveal from './effects/Reveal';
import './article.css';
import './ContentView.css';

/**
 * Shared layout for markdown/HTML content pages (posts, about, …): header
 * (tags + title + date) and the article body. Posts can pass extra footer
 * content (prev/next). Going back is left to the browser / history.
 */
export default function ContentView({
  post,
  footer,
}: {
  post: Post;
  footer?: ReactNode;
}) {
  return (
    <article className="content">
      <Reveal>
        <header className="content__head">
          <h1 className="content__title">{post.title}</h1>
          {post.date ? <time className="content__date">{formatDate(post.date)}</time> : null}
          {post.tags.length > 0 ? (
            <div className="content__tags">
              {post.tags.map((tag) => (
                <TagPill key={tag} tag={tag} />
              ))}
            </div>
          ) : null}
        </header>
      </Reveal>
      <Reveal delay={80}>
        <div className="article">
          {post.kind === 'md' ? (
            markdownToReact(post.raw, {
              resolveAsset: (rel) => resolveAsset(post, rel),
            })
          ) : (
            <div className="article-html" dangerouslySetInnerHTML={{ __html: post.raw }} />
          )}
        </div>
      </Reveal>
      {footer ? <footer className="content__nav">{footer}</footer> : null}
    </article>
  );
}
