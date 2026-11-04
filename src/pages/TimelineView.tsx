import { useMemo } from 'react';
import { timeline } from '../data/timeline';
import { daysTogether } from '../lib/couple';
import { formatDotDate } from '../lib/format';
import { findPhoto } from '../lib/photos';
import { mergeTimeline, usePending, type TimelineEntry } from '../lib/pending';
import { isPlainClick, usePageReveal } from '../components/page-reveal-context';
import Reveal from '../components/effects/Reveal';
import './TimelineView.css';

export default function TimelineView() {
  const pending = usePending();
  const startReveal = usePageReveal();

  // 构建进站点的条目 + 刚提交还没构建的（后者带「待构建」标记）
  const entries = useMemo(
    () => mergeTimeline(timeline, pending.timeline),
    [pending.timeline],
  );

  const groups = useMemo(() => {
    const byYear = new Map<string, TimelineEntry[]>();
    for (const entry of entries) {
      const year = entry.item.date.slice(0, 4) || '—';
      const list = byYear.get(year) ?? [];
      list.push(entry);
      byYear.set(year, list);
    }
    return [...byYear.entries()];
  }, [entries]);

  const firstDate = entries[0]?.item.date ?? '';

  return (
    <div className="page">
      <header className="page__head">
        <p className="eyebrow">Timeline</p>
        <h1 className="page__title">恋爱时间表</h1>
        <p className="page__sub">
          {entries.length} 个瞬间
          {firstDate ? `，从 ${formatDotDate(firstDate)} 开始` : ''}
          ，到今天已经 {daysTogether()} 天。
        </p>
      </header>

      <div className="tl">
        {groups.map(([year, list]) => (
          <section className="tl__group" key={year}>
            <h2 className="tl__year">{year}</h2>
            <ol className="tl__items">
              {list.map(({ item, pending: isPending }, index) => {
                const photo = findPhoto(item.photo);
                return (
                  <li
                    className={`tl__item${item.highlight ? ' tl__item--hero' : ''}`}
                    key={`${item.date}-${item.title}`}
                  >
                    <span className="tl__dot" aria-hidden="true" />
                    <Reveal delay={Math.min(index, 3) * 50} duration={460}>
                      <div className="tl__body">
                        <div className="tl__meta">
                          <time className="tl__date" dateTime={item.date}>
                            {formatDotDate(item.date)}
                          </time>
                          {item.tag ? <span className="tl__tag">{item.tag}</span> : null}
                          {isPending ? <span className="tl__pending">待构建</span> : null}
                        </div>
                        <h3 className="tl__title">{item.title}</h3>
                        {item.text ? <p className="tl__text">{item.text}</p> : null}
                        {photo ? (
                          <img
                            className="tl__photo"
                            src={photo.src}
                            alt={photo.caption}
                            loading="lazy"
                          />
                        ) : null}
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        <div className="tl__now">
          <span className="tl__pulse" aria-hidden="true" />
          至今 · 未完待续
        </div>
      </div>

      <button
        type="button"
        className="tl__add"
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          startReveal('admin', event.clientX, event.clientY);
        }}
      >
        ＋ 添加一个时间点
      </button>
    </div>
  );
}
