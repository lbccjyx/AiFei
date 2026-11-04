import { siteConfig } from '../config';
import { couple } from '../data/couple';
import { daysTogether } from '../lib/couple';
import { isPlainClick, usePageReveal } from './page-reveal-context';
import './Footer.css';

/** 全站页脚：一行身份，一行状态，一条「编辑」的小入口 */
export default function Footer() {
  const startReveal = usePageReveal();

  return (
    <footer className="footer">
      <p className="footer__line">
        {couple.names} · {siteConfig.name}
      </p>
      <p className="footer__line footer__line--muted">
        在一起第 {daysTogether()} 天 · 用 React 和 Three.js 手写的
        <button
          type="button"
          className="footer__edit"
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            startReveal('admin', event.clientX, event.clientY);
          }}
        >
          编辑
        </button>
      </p>
    </footer>
  );
}
