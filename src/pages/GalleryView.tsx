import { useCallback, useMemo, useState } from 'react';
import { photos } from '../lib/photos';
import { mergePhotos, usePending } from '../lib/pending';
import PhotoLightbox from '../components/PhotoLightbox';
import { isPlainClick, usePageReveal } from '../components/page-reveal-context';
import './GalleryView.css';

export default function GalleryView() {
  const pending = usePending();
  const all = useMemo(() => mergePhotos(photos, pending.photos), [pending.photos]);

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const close = useCallback(() => setOpenIndex(null), []);
  const change = useCallback((index: number) => setOpenIndex(index), []);
  const startReveal = usePageReveal();

  return (
    <div className="page">
      <header className="page__head">
        <p className="eyebrow">Photos</p>
        <h1 className="page__title">恋爱照片</h1>
        <p className="page__sub">
          {all.length} 张。点开可以左右翻;新照片在「编辑」页上传,提交后马上在这里出现,
          构建完成就变成正式内容。
        </p>
      </header>

      {all.length === 0 ? (
        <p className="gallery__empty">
          还没有照片 —— 去「编辑」页上传,或者在 content/photos/ 里放图片。
        </p>
      ) : (
        <div className="gallery">
          {all.map((photo, index) => (
            <figure className={`ph${photo.pending ? ' ph--pending' : ''}`} key={photo.src}>
              <button
                type="button"
                className="ph__btn"
                onClick={() => setOpenIndex(index)}
                aria-label={`查看照片：${photo.caption}`}
              >
                {photo.pending && broken[photo.src] ? (
                  <span className="ph__waiting">正在发布…</span>
                ) : (
                  <img
                    className="ph__img"
                    src={photo.src}
                    alt={photo.caption}
                    loading="lazy"
                    decoding="async"
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
            </figure>
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
