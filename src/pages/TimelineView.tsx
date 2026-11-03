import { useMemo } from 'react';
import { timeline, type TimelineItem } from '../data/timeline';
import { daysTogether } from '../lib/couple';
import { formatDotDate } from '../lib/format';
import { findPhoto } from '../lib/photos';
import Reveal from '../components/effects/Reveal';
import './TimelineView.css';

/** 从早到晚排 —— 时间表要能顺着读下来，不按时间倒序 */
const items: TimelineItem[] = [...timeline].sort((a, b) =>
  a.date.localeCompare(b.date),
);

const firstDate = items[0]?.date ?? '';

export default function TimelineView() {
  const groups = useMemo(() => {
    const byYear = new Map<string, TimelineItem[]>();
    for (const item of items) {
      const year = item.date.slice(0, 4) || '—';
      const list = byYear.get(year) ?? [];
      list.push(item);
      byYear.set(year, list);
    }
    return [...byYear.entries()];
  }, []);

  return (
    <div className="page">
      <header className="page__head">
        <p className="eyebrow">Timeline</p>
        <h1 className="page__title">恋爱时间表</h1>
        <p className="page__sub">
          {items.length} 个瞬间
          {firstDate ? `，从 ${formatDotDate(firstDate)} 开始` : ''}
          ，到今天已经 {daysTogether()} 天。
        </p>
      </header>

      <div className="tl">
        {groups.map(([year, list]) => (
          <section className="tl__group" key={year}>
            <h2 className="tl__year">{year}</h2>
            <ol className="tl__items">
              {list.map((item, index) => {
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
    </div>
  );
}
