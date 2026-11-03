import { useEffect } from 'react';
import { PageRouterProvider } from './router/router';
import { usePageRouter } from './router/context';
import { PageRevealProvider } from './components/PageReveal';
import { getPageTitle, renderPage } from './router/pages';
import ThemeToggle from './components/ThemeToggle';
import Cursor from './components/Cursor';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
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

  return (
    <PageRevealProvider>
      <NavBar />
      <ViewOutlet />
      <Footer />
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
