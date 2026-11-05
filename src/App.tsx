import { useEffect } from 'react';
import { PageRouterProvider } from './router/router';
import { usePageRouter } from './router/context';
import { PageRevealProvider } from './components/PageReveal';
import { getPageTitle, renderPage } from './router/pages';
import ThemeToggle from './components/ThemeToggle';
import Cursor from './components/Cursor';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import MusicPlayer from './components/MusicPlayer';
import { prunePending } from './lib/pending';
import { timeline } from './data/timeline';
import { todos } from './data/todos';
import { photos } from './lib/photos';
import { siteConfig } from './config';

function ViewOutlet() {
  const { page } = usePageRouter();
  return (
    <main className="app-main" key={page.pageId}>
      {renderPage(page.pageId)}
    </main>
  );
}

function Shell() {
  const { page } = usePageRouter();

  useEffect(() => {
    const title = getPageTitle(page.pageId);
    document.title = title === '首页' ? siteConfig.name : `${title} · ${siteConfig.name}`;
  }, [page]);

  // 构建追上之后，把「待构建」标记清掉（同一条内容已经在真内容里了）
  useEffect(() => {
    prunePending({ timeline, todos, photos });
  }, []);

  return (
    <PageRevealProvider>
      <NavBar />
      <ViewOutlet />
      <Footer />
      <MusicPlayer />
      <div className="theme-fab">
        <ThemeToggle />
      </div>
      <Cursor />
    </PageRevealProvider>
  );
}

export default function App() {
  return (
    <PageRouterProvider>
      <Shell />
    </PageRouterProvider>
  );
}
