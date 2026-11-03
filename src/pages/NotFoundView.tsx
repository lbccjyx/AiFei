import { type MouseEvent } from 'react';
import Button from '../components/elements/Button';
import { isPlainClick, usePageReveal } from '../components/page-reveal-context';
import './NotFoundView.css';

export default function NotFoundView({ pageId }: { pageId: string }) {
  const startReveal = usePageReveal();

  const goHome = (e: MouseEvent<HTMLElement>) => {
    if (!isPlainClick(e)) return;
    startReveal('home', e.clientX, e.clientY);
  };

  return (
    <div className="notfound">
      <h1 className="notfound__code">404</h1>
      <p className="notfound__msg">
        没有这个页面：<code>{pageId}</code>
      </p>
      <Button onClick={goHome}>← 回首页</Button>
    </div>
  );
}
