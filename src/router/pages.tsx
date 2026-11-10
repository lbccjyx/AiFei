import type { ReactNode } from 'react';
import HomeView from '../pages/HomeView';
import TimelineView from '../pages/TimelineView';
import TodoView from '../pages/TodoView';
import GalleryView from '../pages/GalleryView';
import AdminView from '../pages/AdminView';
import NotFoundView from '../pages/NotFoundView';

/**
 * Single-root page registry. Views are keyed by pageId (not URL paths).
 *
 * 站点现在只有：首页 / 时间表 / 待办 / 照片（+ 隐藏的编辑页）。
 * 日记和关于两页已经去掉，旧的 `/diary`、`/about`、`/posts/*` 会落到 404。
 */
export function renderPage(pageId: string): ReactNode {
  if (pageId === 'home') return <HomeView />;
  if (pageId === 'timeline') return <TimelineView />;
  if (pageId === 'todo') return <TodoView />;
  if (pageId === 'gallery') return <GalleryView />;
  if (pageId === 'admin') return <AdminView />;
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
  if (pageId === 'admin') return '编辑';
  return '找不到页面';
}
