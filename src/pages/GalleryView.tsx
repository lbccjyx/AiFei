import { useCallback, useState } from 'react';
import { photos } from '../lib/photos';
import PhotoLightbox from '../components/PhotoLightbox';
import './GalleryView.css';

export default function GalleryView() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const close = useCallback(() => setOpenIndex(null), []);
  const change = useCallback((index: number) => setOpenIndex(index), []);

  return (
    <div className="page">
      <header className="page__head">
        <p className="eyebrow">Photos</p>
        <h1 className="page__title">恋爱照片</h1>
        <p className="page__sub">
          {photos.length} 张。图片放在 content/photos/ 里即可，文件名前面的数字决定顺序，
          点开可以左右翻。
        </p>
      </header>

      {photos.length === 0 ? (
        <p className="gallery__empty">
          还没有照片 —— 把图片放进 content/photos/ 就会出现在这里。
        </p>
      ) : (
        <div className="gallery">
          {photos.map((photo, index) => (
            <figure className="ph" key={photo.src}>
              <button
                type="button"
                className="ph__btn"
                onClick={() => setOpenIndex(index)}
                aria-label={`查看照片：${photo.caption}`}
              >
                <img
                  className="ph__img"
                  src={photo.src}
                  alt={photo.caption}
                  loading="lazy"
                  decoding="async"
                />
                <span className="ph__cap">{photo.caption}</span>
              </button>
            </figure>
          ))}
        </div>
      )}

      {openIndex !== null ? (
        <PhotoLightbox
          photos={photos}
          index={openIndex}
          onClose={close}
          onIndexChange={change}
        />
      ) : null}
    </div>
  );
}
