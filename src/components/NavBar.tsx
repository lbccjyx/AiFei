import { useEffect, useState } from 'react';
import { usePageRouter } from '../router/context';
import { usePageReveal } from './page-reveal-context';
import { siteConfig } from '../config';
import './NavBar.css';

export type NavItem = {
  /** pageId，交给路由 */
  id: string;
  label: string;
};

/** 主导航：顺序就是页面顺序 */
const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: '首页' },
  { id: 'timeline', label: '时间表' },
  { id: 'todo', label: '待办' },
  { id: 'gallery', label: '照片' },
];

/**
 * 固定顶部导航。滚动后加一层半透明背景，避免文字压在内容上糊成一团。
 * 点击走 page-reveal 管线，和卡片跳转是同一套转场。
 */
export default function NavBar() {
  const { page } = usePageRouter();
  const startReveal = usePageReveal();
  const [scrolled, setScrolled] = useState(false);
  const current = page.pageId;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? ' is-scrolled' : ''}`} aria-label="主导航">
      <button
        type="button"
        className="nav__brand"
        onClick={(e) => {
          if (page.pageId === 'home') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          startReveal('home', e.clientX, e.clientY);
        }}
      >
        {siteConfig.name}
      </button>

      <ul className="nav__list">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="nav__link"
              aria-current={current === item.id ? 'page' : undefined}
              data-active={current === item.id}
              onClick={(e) => {
                if (current === item.id) return;
                startReveal(item.id, e.clientX, e.clientY);
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
