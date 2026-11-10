import { lazy, Suspense, useMemo, useRef } from 'react';
import { utils } from 'animejs';
import { useParallax, useScrollTransform } from '../lib/motion';
import { HERO_FLY_RUNWAY_VH } from '../lib/scroll';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSnapScroll } from '../hooks/useSnapScroll';
/**
 * three.js 有 600 KB 左右。它是首屏那片粒子云，只在这个页面出现 ——
 * 拆成单独的 chunk 之后，别的页面（时间表 / 照片 / 日记…）完全不会下载它，
 * 首屏文字也能先画出来，粒子云晚半拍再补上。
 */
const ThreeHero = lazy(() => import('../components/ThreeHero'));
import Reveal from '../components/effects/Reveal';
import Fx from '../components/Fx';
import { siteConfig } from '../config';
import { couple } from '../data/couple';
import { daysTogether } from '../lib/couple';
import { timeline } from '../data/timeline';
import { todos } from '../data/todos';
import { photos } from '../lib/photos';
import './HomeView.css';

// paged-scroll snap points: hero / 三个抽屉 / 我们（落点抬高 20px，
// 让标题不要贴着视口顶部）
const SNAP_OFFSETS = [0, -20, -20];

/** 首页的三个入口卡片，数量从数据里实时算出来 */
const MODULES = [
  {
    id: 'timeline',
    no: '01',
    title: '时间表',
    meta: `${timeline.length} 个瞬间`,
    desc: '第一次见面、第一次看海，按时间摆好的那些日子。',
  },
  {
    id: 'todo',
    no: '02',
    title: '待办',
    meta: `${todos.length} 件想做的事`,
    desc: '勾掉一件，就多一段以后能讲的事。',
  },
  {
    id: 'gallery',
    no: '03',
    title: '照片',
    meta: `${photos.length} 张`,
    desc: '按下快门的那一秒，其他都变模糊了。',
  },
];

export default function HomeView() {
  const pinRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const heroInnerRef = useRef<HTMLDivElement>(null);
  const modulesRef = useRef<HTMLElement>(null);
  const aboutRef = useRef<HTMLElement>(null);
  const titleParallaxRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useParallax(titleParallaxRef, 0.03);

  const days = daysTogether();

  // paged scrolling: wheel / keyboard move one module at a time. The first
  // snap point is the non-sticky pin wrapper (document top = 0), NOT the
  // sticky hero whose rect moves with the pin — that used to break landing.
  const snapRefs = useMemo(() => [pinRef, modulesRef, aboutRef], []);
  useSnapScroll(snapRefs, SNAP_OFFSETS);

  // During the pinned fly-through, the hero text fades and lifts out…
  useScrollTransform(heroInnerRef, {
    fn: (el, p) => {
      const inP = Math.min(1, p / 0.6);
      utils.set(el, {
        opacity: 1 - inP,
        translateY: -40 * inP,
        scale: 1 + 0.05 * inP,
      });
    },
  });
  // …and the whole hero fades away at the tail of the runway.
  useScrollTransform(heroRef, {
    fn: (el, p) => {
      const outP = Math.max(0, Math.min(1, (p - 0.85) / 0.15));
      utils.set(el, { opacity: 1 - outP });
    },
  });

  return (
    <div className="home">
      {/* pin wrapper bounds the sticky range: hero stays pinned for exactly
          the runway height (0 under reduced motion), then releases */}
      <div
        className="home__pin"
        ref={pinRef}
        style={{ height: `calc(100svh + ${reduced ? 0 : HERO_FLY_RUNWAY_VH}vh)` }}
      >
        <section className="home__hero" ref={heroRef}>
          <Suspense fallback={<div className="three-hero three-hero--fallback" aria-hidden="true" />}>
            <ThreeHero />
          </Suspense>
          <div className="home__hero-inner" ref={heroInnerRef}>
            <Reveal delay={40}>
              <p className="home__eyebrow">{siteConfig.name}</p>
            </Reveal>
            <Reveal delay={80}>
              <Fx as="h1" drag bounce className="home__title">
                <span className="home__title-parallax" ref={titleParallaxRef}>
                  {couple.names}
                </span>
              </Fx>
            </Reveal>
            <Reveal delay={160}>
              <p className="home__subtitle">{couple.tagline}</p>
            </Reveal>
            <Reveal delay={240}>
              <p className="home__days">
                在一起 <strong>{days}</strong> 天
              </p>
            </Reveal>
          </div>
        </section>
      </div>

      <section className="home__section" ref={modulesRef}>
        <Reveal>
          <h2 className="home__section-title">我们在这里</h2>
        </Reveal>
        <div className="home__modules">
          {MODULES.map((module, index) => (
            <Reveal key={module.id} delay={index * 80}>
              <Fx
                as="article"
                tilt
                click={module.id}
                className="home__module"
                aria-label={`${module.title}：${module.meta}`}
              >
                <span className="home__module-no">{module.no}</span>
                <h3 className="home__module-title">{module.title}</h3>
                <p className="home__module-meta">{module.meta}</p>
                <p className="home__module-desc">{module.desc}</p>
                <span className="home__module-arrow" aria-hidden="true">
                  →
                </span>
              </Fx>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="home__section" ref={aboutRef}>
        <Reveal>
          <h2 className="home__section-title">关于我们</h2>
        </Reveal>
        <Reveal delay={60}>
          <p className="home__about">{couple.motto}</p>
        </Reveal>
        <Reveal delay={120}>
          <ul className="home__stats">
            <li>
              <span className="home__stat-num">{days}</span>
              <span className="home__stat-label">在一起的天</span>
            </li>
            <li>
              <span className="home__stat-num">{timeline.length}</span>
              <span className="home__stat-label">个瞬间</span>
            </li>
            <li>
              <span className="home__stat-num">{todos.length}</span>
              <span className="home__stat-label">件想做的事</span>
            </li>
            <li>
              <span className="home__stat-num">{photos.length}</span>
              <span className="home__stat-label">张照片</span>
            </li>
          </ul>
        </Reveal>
      </section>
    </div>
  );
}
