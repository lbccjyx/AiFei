import { siteConfig } from '../config';
import { couple } from '../data/couple';
import { daysTogether } from '../lib/couple';
import './Footer.css';

/** 全站页脚：一行身份，一行状态，别的不加 */
export default function Footer() {
  return (
    <footer className="footer">
      <p className="footer__line">
        {couple.names} · {siteConfig.name}
      </p>
      <p className="footer__line footer__line--muted">
        在一起第 {daysTogether()} 天 · 用 React 和 Three.js 手写的
      </p>
    </footer>
  );
}
