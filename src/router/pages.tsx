import type { ReactNode } from 'react';
import HomeView from '../pages/HomeView';
import PostListView from '../pages/PostListView';
import PostView from '../pages/PostView';
import NotFoundView from '../pages/NotFoundView';
import TimelineView from '../pages/TimelineView';
import TodoView from '../pages/TodoView';
import GalleryView from '../pages/GalleryView';
import { getArchivePosts, getPost, getPosts } from '../lib/content';

/**
 * Single-root page registry. Views are keyed by pageId (not URL paths); post
 * pages are dynamic `post:<slug>` ids derived from the content index,
 * site-level pages (about) render through the same post page, and both the
 * diary and tag pages are the same unified post-list page (`PostListView`)
 * fed with different data — the diary (excluding `hidden`-tagged posts)
 * vs. a tag-filtered subset.
 */
export function renderPage(pageId: string): ReactNode {
  if (pageId === 'home') return <HomeView />;
  if (pageId === 'timeline') return <TimelineView />;
  if (pageId === 'todo') return <TodoView />;
  if (pageId === 'gallery') return <GalleryView />;
  if (pageId === 'diary') {
    // posts tagged `hidden` stay out of the diary but remain reachable
    // through their tag pages
    return <PostListView title="日记" posts={getArchivePosts()} minRailPosts={6} />;
  }
  if (pageId === 'about') return <PostView slug="about" />;
  if (pageId.startsWith('post:')) {
    const slug = pageId.slice('post:'.length);
    if (getPost(slug)) return <PostView slug={slug} />;
  }
  if (pageId.startsWith('tag:')) {
    const tag = pageId.slice('tag:'.length);
    if (tag) {
      return (
        <PostListView
          title={`标签：${tag}`}
          backFallback="diary"
          posts={getPosts().filter((post) => post.tags.includes(tag))}
        />
      );
    }
  }
  if (pageId.startsWith('not-found:')) {
    return <NotFoundView pageId={pageId.slice('not-found:'.length)} />;
  }
  return <NotFoundView pageId={pageId} />;
}

export function getPageTitle(pageId: string): string {
  if (pageId === 'home') return '首页';
  if (pageId === 'timeline') return '时间表';
  if (pageId === 'todo') return '待办';
  if (pageId === 'gallery') return '照片';
  if (pageId === 'diary') return '日记';
  if (pageId === 'about') return '关于';
  if (pageId.startsWith('post:')) {
    const post = getPost(pageId.slice('post:'.length));
    if (post) return post.title;
  }
  if (pageId.startsWith('tag:')) return `标签：${pageId.slice('tag:'.length)}`;
  return '找不到页面';
}
