import { type MouseEvent } from 'react';
import { getPost, getPosts } from '../lib/content';
import Button from '../components/elements/Button';
import ContentView from '../components/ContentView';
import { isPlainClick, usePageReveal } from '../components/page-reveal-context';

export default function PostView({ slug }: { slug: string }) {
  const post = getPost(slug);
  const startReveal = usePageReveal();

  if (!post) return null;

  const posts = getPosts();
  const idx = posts.findIndex((p) => p.slug === slug);
  const prev = idx > 0 ? posts[idx - 1] : null;
  const next = idx >= 0 && idx < posts.length - 1 ? posts[idx + 1] : null;

  const openPost = (s: string, e: MouseEvent<HTMLElement>) => {
    if (!isPlainClick(e)) return;
    startReveal(`post:${s}`, e.clientX, e.clientY);
  };

  return (
    <ContentView
      post={post}
      footer={
        <>
          {prev ? (
            <Button variant="outline" size="sm" onClick={(e) => openPost(prev.slug, e)}>
              ← {prev.title}
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button variant="outline" size="sm" onClick={(e) => openPost(next.slug, e)}>
              {next.title} →
            </Button>
          ) : (
            <span />
          )}
        </>
      }
    />
  );
}
