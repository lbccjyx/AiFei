import { useCallback, useEffect, useMemo, useState } from 'react';
import { photos } from '../lib/photos';
import { mergePhotos, usePending } from '../lib/pending';
import { prefetchAll } from '../lib/prefetch';
import PhotoLightbox from '../components/PhotoLightbox';
import SmartImage from '../components/SmartImage';
import Reveal from '../components/effects/Reveal';
import { isPlainClick, usePageReveal } from '../components/page-reveal-context';
import './GalleryView.css';

/** 编辑式版面：每 7 张出现一个跨两列的「主图」，每 7 张出现一个竖长图 */
function tileClass(index: number): string {
  if (index % 7 === 0) return ' is-wide';
  if (index % 7 === 3) return ' is-tall';
  return '';
}

export default function GalleryView() {
  const pending = usePending();
  const all = useMemo(() => mergePhotos(photos, pending.photos), [pending.photos]);

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const close = useCallback(() => setOpenIndex(null), []);
  const change = useCallback((index: number) => setOpenIndex(index), []);
  const startReveal = usePageReveal();

  /**
   * 缩略图铺完之后，大图在后台一张张慢慢拿：进页面 5 秒才开始，每张之间歇 1.1 秒，
   * 32 张大概 40 秒下完。慢网 / 开了省流量的设备这里直接跳过（见 lib/prefetch）。
   */
  useEffect(() => {
    const urls = all.filter((photo) => !photo.pending).map((photo) => photo.full ?? photo.src);
    return prefetchAll(urls, { delay: 5000, gap: 1100 });
  }, [all]);

  return (
    <div className="page">
      <header className="page__head">
        <p className="eyebrow">Photos</p>
        <h1 className="page__title">恋爱照片</h1>
        <p className="page__sub">
          {all.length} 张。先出缩略图，大图在后台慢慢换上来；点开可以左右翻。
        </p>
      </header>

      {all.length === 0 ? (
        <p className="gallery__empty">
          还没有照片 —— 去「编辑」页上传,或者在 content/photos/ 里放图片。
        </p>
      ) : (
        <div className="gallery">
          {all.map((photo, index) => (
            <Reveal
              key={photo.src}
              className={`ph${tileClass(index)}${photo.pending ? ' ph--pending' : ''}`}
              delay={Math.min(index, 6) * 40}
              duration={520}
              y={18}
            >
              <button
                type="button"
                className="ph__btn"
                onClick={() => setOpenIndex(index)}
                aria-label={`查看照片：${photo.caption}`}
              >
                {photo.pending && broken[photo.src] ? (
                  <span className="ph__waiting">正在发布…</span>
                ) : (
                  <SmartImage
                    photo={photo}
                    alt={photo.caption}
                    className="ph__img"
                    /* 跨两列的「主图」要按两列宽算，不然会去拿小图、放大发虚 */
                    sizes={
                      tileClass(index).includes('is-wide')
                        ? '(max-width: 860px) 92vw, 62vw'
                        : '(max-width: 860px) 46vw, 30vw'
                    }
                    onError={() =>
                      setBroken((prev) =>
                        prev[photo.src] ? prev : { ...prev, [photo.src]: true },
                      )
                    }
                  />
                )}
                <span className="ph__cap">{photo.caption}</span>
              </button>
              {photo.pending ? <span className="ph__badge">待构建</span> : null}
            </Reveal>
          ))}
        </div>
      )}

      <button
        type="button"
        className="gallery__add"
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          startReveal('admin', event.clientX, event.clientY);
        }}
      >
        ＋ 上传照片
      </button>

      {openIndex !== null ? (
        <PhotoLightbox
          photos={all}
          index={openIndex}
          onClose={close}
          onIndexChange={change}
        />
      ) : null}
    </div>
  );
}
