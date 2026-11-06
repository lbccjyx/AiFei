import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { timeline, type TimelineItem } from '../data/timeline';
import { chapterOf } from '../data/chapters';
import { daysSince } from '../lib/couple';
import { formatDotDate } from '../lib/format';
import { findPhoto } from '../lib/photos';
import { mergeTimeline, usePending } from '../lib/pending';
import { isPlainClick, usePageReveal } from '../components/page-reveal-context';
import './TimelineView.css';

/**
 * 时间表 = 一条可以缩放的长河（需求书第 5 节）。
 *
 * 位置按真实时间比例摆放（不是等距），所以 10 月自然比 9 月长；
 * 缩放是「语义缩放」：不 scale 文字，而是按层级决定显示什么 ——
 *   L0（zoom < 2.2）  只显示大节点（highlight）的标签
 *   L1（zoom ≥ 2.2）  所有节点的标签都出来
 *   L2                点开某个节点 → 底部抽屉读正文
 */
const DAY_MS = 86_400_000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 7;
const PAD = 88;
const L1_ZOOM = 2.2;
/** 两个标签靠太近就藏掉次要的那个（像素） */
const LABEL_GAP = 96;

type Node = {
  key: string;
  date: string;
  items: TimelineItem[];
  major: boolean;
  pending: boolean;
  photo?: { src: string; caption: string };
};

function dayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y || 2000, (m || 1) - 1, d || 1) / DAY_MS;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function TimelineView() {
  const pending = usePending();
  const startReveal = usePageReveal();
  const stageRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1200 : Math.max(320, Math.min(window.innerWidth, 1180) - 48),
  );
  const [view, setView] = useState({ zoom: 1, pan: 0 });
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  /** 构建节点：同一天的几条聚合成一个点 */
  const nodes = useMemo<Node[]>(() => {
    const entries = mergeTimeline(timeline, pending.timeline);
    const list: Node[] = [];
    for (const entry of entries) {
      const { item, pending: isPending } = entry;
      const last = list[list.length - 1];
      if (last && last.date === item.date) {
        last.items.push(item);
        last.major = last.major || Boolean(item.highlight);
        last.pending = last.pending || isPending;
        if (!last.photo && item.photo) last.photo = findPhoto(item.photo) ?? undefined;
        continue;
      }
      list.push({
        key: `${item.date}-${list.length}`,
        date: item.date,
        items: [item],
        major: Boolean(item.highlight),
        pending: isPending,
        photo: item.photo ? (findPhoto(item.photo) ?? undefined) : undefined,
      });
    }
    return list;
  }, [pending.timeline]);

  const span = Math.max(1, width - (width < 640 ? 36 : PAD) * 2);
  const pad = width < 640 ? 36 : PAD;

  const clampPan = useCallback((pan: number, zoom: number) => {
    const min = Math.min(0, span - span * zoom);
    return clamp(pan, min, 0);
  }, [span]);

  const zoomAt = useCallback(
    (nextZoom: number, anchorPx: number) => {
      setView((current) => {
        const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
        if (zoom === current.zoom) return current;
        const worldX = (anchorPx - pad - current.pan) / current.zoom;
        const pan = anchorPx - pad - worldX * zoom;
        return { zoom, pan: clampPan(pan, zoom) };
      });
    },
    [clampPan, pad],
  );

  const panBy = useCallback(
    (delta: number) => {
      setView((current) => ({ ...current, pan: clampPan(current.pan + delta, current.zoom) }));
    },
    [clampPan],
  );

  /** 相对缩放（按钮/键盘用）：基于当前 zoom 乘一个系数，连点两次才不会互相覆盖 */
  const zoomBy = useCallback(
    (factor: number, anchorPx: number) => {
      setView((current) => {
        const zoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
        if (zoom === current.zoom) return current;
        const worldX = (anchorPx - pad - current.pan) / current.zoom;
        const pan = anchorPx - pad - worldX * zoom;
        return { zoom, pan: clampPan(pan, zoom) };
      });
    },
    [clampPan, pad],
  );

  const reset = useCallback(() => setView({ zoom: 1, pan: 0 }), []);

  /** 滚轮：普通滚轮横向平移，Ctrl/⌘ + 滚轮缩放（React 的 onWheel 是 passive，得自己挂） */
  const latest = useRef({ view, zoomAt, panBy });
  useEffect(() => {
    latest.current = { view, zoomAt, panBy };
  }, [view, zoomAt, panBy]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        const factor = event.deltaY < 0 ? 1.16 : 1 / 1.16;
        latest.current.zoomAt(latest.current.view.zoom * factor, event.clientX - rect.left);
        return;
      }
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      latest.current.panBy(-delta * 1.1);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /** 容器宽度 */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next && next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** 拖拽 + 双指缩放 */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; pan: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const movedRef = useRef(false);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.river__node, .river__controls, .river__drawer')) {
      return;
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (pointers.current.size === 1) {
      drag.current = { x: event.clientX, pan: view.pan };
      movedRef.current = false;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pinch.current) {
        pinch.current = { dist, zoom: view.zoom };
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = dist / pinch.current.dist;
      zoomAt(pinch.current.zoom * ratio, (a.x + b.x) / 2 - rect.left);
      return;
    }

    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    if (Math.abs(dx) > 3) movedRef.current = true;
    const nextPan = clampPan(drag.current.pan + dx, view.zoom);
    setView((current) => ({ ...current, pan: nextPan }));
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  };

  /** 键盘 */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveIndex(null);
        reset();
      } else if (event.key === '+' || event.key === '=') {
        zoomBy(1.4, width / 2);
      } else if (event.key === '-' || event.key === '_') {
        zoomBy(1 / 1.4, width / 2);
      } else if (event.key === '0') {
        reset();
      } else if (event.key === 'ArrowRight') {
        setActiveIndex((index) =>
          index === null ? 0 : Math.min(nodes.length - 1, index + 1),
        );
      } else if (event.key === 'ArrowLeft') {
        setActiveIndex((index) => (index === null ? 0 : Math.max(0, index - 1)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodes.length, reset, zoomBy, zoomAt, width]);

  /** 节点坐标（按真实时间比例） */
  const t0 = nodes.length ? dayOf(nodes[0].date) : 0;
  const t1 = nodes.length ? dayOf(nodes[nodes.length - 1].date) : 1;
  const totalDays = Math.max(1, t1 - t0);

  const placed = nodes.map((node) => {
    const ratio = (dayOf(node.date) - t0) / totalDays;
    return { node, x: pad + view.pan + ratio * span * view.zoom, ratio };
  });

  /**
   * 标签排几行：桌面 3 行，手机 2 行（屏太窄，再多就会糊成一团）。
   * 靠太近就换下一行，都放不下才藏 —— 10.05 和 10.06 只差一天，会直接叠在一起。
   */
  const narrow = width < 520;
  const rowStep = narrow ? 26 : 30;
  const labelGap = narrow ? 92 : LABEL_GAP;
  const rowCursor = Array<number>(narrow ? 2 : 3).fill(-Infinity);
  const labelled = placed.map((entry) => {
    const wantLabel = entry.node.major || view.zoom >= L1_ZOOM;
    if (!wantLabel) return { ...entry, showLabel: false, row: 0 };
    for (let row = 0; row < rowCursor.length; row++) {
      if (entry.x - rowCursor[row] >= labelGap) {
        rowCursor[row] = entry.x;
        return { ...entry, showLabel: true, row };
      }
    }
    return { ...entry, showLabel: false, row: 0 };
  });

  /** 篇章带：按月分组 */
  const chaptersPlaced = useMemo(() => {
    const groups: { key: string; start: number; end: number; label: string; line: string }[] = [];
    for (const entry of placed) {
      const key = entry.node.date.slice(0, 7);
      const chapter = chapterOf(entry.node.date);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.end = entry.x;
        continue;
      }
      groups.push({ key, start: entry.x, end: entry.x, label: chapter.label, line: chapter.line });
    }
    return groups;
    // placed 每次渲染都重建，用节点数量和视图作为依赖即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, view.zoom, view.pan, width]);

  const active = activeIndex === null ? null : nodes[activeIndex];

  const currentLabel = useMemo(() => {
    if (!placed.length) return '';
    // 视野中心对应的节点日期
    const center = pad + view.pan + (span * view.zoom) / 2;
    let nearest = placed[0];
    for (const entry of placed) {
      if (Math.abs(entry.x - center) < Math.abs(nearest.x - center)) nearest = entry;
    }
    const [year, month] = nearest.node.date.split('-');
    return `${year} · ${Number(month)}月`;
  }, [placed, span, pad, view.pan, view.zoom]);

  /** 迷你进度条：可视窗口在整条河里的比例与位置 */
  const miniLeft = span * view.zoom > 0 ? (-view.pan / (span * view.zoom)) * 100 : 0;
  const miniWidth = (1 / view.zoom) * 100;

  return (
    <div className="river">
      <header className="river__head">
        <p className="eyebrow">Timeline</p>
        <h1 className="page__title">恋爱时间表</h1>
        <p className="page__sub">
          {nodes.length} 个瞬间
          {nodes.length ? ` · 从 ${formatDotDate(nodes[0].date)} 开始` : ''}
          {nodes.length ? ` · 第 ${daysSince(nodes[0].date)} 天` : ''}
          ，拖动看全程，双指或 Ctrl+滚轮缩放。
        </p>
      </header>

      <div
        className="river__stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div className="river__bands" aria-hidden="true">
          {chaptersPlaced.map((group) => (
            <div
              className="river__band"
              key={group.key}
              style={{ left: group.start - 40, width: Math.max(60, group.end - group.start + 80) }}
            >
              <span className="river__band-label">{group.label}</span>
              <span className="river__band-line">{group.line}</span>
            </div>
          ))}
        </div>

        <div className="river__axis" aria-hidden="true" />

        {placed.map((entry, index) => (
          <button
            type="button"
            key={entry.node.key}
            className={`river__node${entry.node.major ? ' is-major' : ''}${
              activeIndex === index ? ' is-active' : ''
            }`}
            style={{ transform: `translate3d(${entry.x}px, 0, 0)` }}
            onClick={() => {
              if (movedRef.current) return;
              setActiveIndex(index);
              if (entry.node.major && view.zoom < L1_ZOOM) {
                zoomAt(1.8, entry.x);
              }
            }}
            aria-label={`${formatDotDate(entry.node.date)} ${entry.node.items[0].title}${
              entry.node.items.length > 1 ? ` 等 ${entry.node.items.length} 件` : ''
            }`}
          >
            <span className="river__dot" />
            {entry.node.items.length > 1 ? (
              <span className="river__count">{entry.node.items.length}</span>
            ) : null}
            {entry.node.photo ? (
              <img className="river__thumb" src={entry.node.photo.src} alt="" loading="lazy" />
            ) : null}
            {labelled[index].showLabel ? (
              <span className="river__label" style={{ top: 13 + labelled[index].row * rowStep }}>
                <time>{formatDotDate(entry.node.date)}</time>
                {entry.node.items[0].title}
                {entry.node.pending ? <em>待构建</em> : null}
              </span>
            ) : null}
          </button>
        ))}

        <div className="river__now" style={{ left: pad + view.pan + span * view.zoom }}>
          <span className="river__now-dot" />
          今天
        </div>

        <div className="river__controls">
          <span className="river__pos">{currentLabel}</span>
          <button
            type="button"
            className="river__btn"
            onClick={() => zoomBy(1 / 1.6, width / 2)}
            aria-label="缩小"
            disabled={view.zoom <= MIN_ZOOM + 0.01}
          >
            −
          </button>
          <button
            type="button"
            className="river__btn"
            onClick={() => zoomBy(1.6, width / 2)}
            aria-label="放大"
            disabled={view.zoom >= MAX_ZOOM - 0.01}
          >
            ＋
          </button>
          <button type="button" className="river__btn river__btn--wide" onClick={reset}>
            全部
          </button>
        </div>

        <div className="river__mini" aria-hidden="true">
          <div
            className="river__mini-view"
            style={{ left: `${miniLeft}%`, width: `${miniWidth}%` }}
          />
        </div>
      </div>

      <div className="river__foot">
        <span className="river__hint">
          同一天的几条会合成一个点（角标是条数）· 点一下看正文 · Esc 回到全景
        </span>
        <button
          type="button"
          className="river__add"
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            startReveal('admin', event.clientX, event.clientY);
          }}
        >
          ＋ 添加一个时间点
        </button>
      </div>

      {active ? (
        <aside className="river__drawer" role="dialog" aria-label="时间点详情">
          <header className="river__drawer-head">
            <time>{formatDotDate(active.date)}</time>
            <div className="river__drawer-btns">
              <button
                type="button"
                className="river__btn"
                onClick={() => setActiveIndex((i) => Math.max(0, (i ?? 0) - 1))}
                aria-label="上一条"
              >
                ←
              </button>
              <button
                type="button"
                className="river__btn"
                onClick={() =>
                  setActiveIndex((i) => Math.min(nodes.length - 1, (i ?? 0) + 1))
                }
                aria-label="下一条"
              >
                →
              </button>
              <button
                type="button"
                className="river__btn"
                onClick={() => setActiveIndex(null)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
          </header>

          <div className="river__drawer-body">
            {active.items.map((item) => {
              const photo = item.photo ? findPhoto(item.photo) : undefined;
              return (
                <article className="river__entry" key={`${item.date}-${item.title}`}>
                  {photo ? <img className="river__entry-img" src={photo.src} alt={photo.caption} /> : null}
                  <h3 className="river__entry-title">{item.title}</h3>
                  {item.text ? <p className="river__entry-text">{item.text}</p> : null}
                  {item.tag ? <span className="river__entry-tag">{item.tag}</span> : null}
                </article>
              );
            })}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
