import { photoCaptions } from '../data/photos';
import manifestRaw from '../data/photo-manifest.json';

/**
 * 照片清单。
 *
 * 真正的图片来源是 `content/photos/`；`scripts/photos.mjs` 会在 `npm run dev` /
 * `npm run build` 之前把每张图烘成三个尺寸，并写出 `src/data/photo-manifest.json`：
 *
 *   blur   24px 内联模糊占位（data URI）—— 0 请求，先给个大概的样子
 *   thumb  720px 缩略图（约 30 KB）—— 照片墙、时间表缩略图、详情抽屉
 *   full   1600px 大图（约 150 KB）—— 灯箱 / 后台慢慢预取
 *
 * 这里只读清单：原始的大 JPEG 不会被打进 dist，浏览器也就永远不会去下它。
 * 想加照片，照旧把文件丢进 `content/photos/` 就行，构建前会自动烘。
 */

type Derivative = {
  /** 420px 小缩略图（手机格子用） */
  thumbSm?: string;
  thumb?: string;
  full?: string;
  blur?: string;
  width?: number;
  height?: number;
};

const derivatives = manifestRaw as Record<string, Derivative>;

/** public/ 下的文件没有构建 hash，得自己拼部署子路径（项目页是 /AiFei/） */
const asset = (path?: string) => (path ? `${import.meta.env.BASE_URL}${path}` : undefined);

export type Photo = {
  /** 交给 <img> 的地址：正常是 1600px 大图，没有衍生物时退回缩略图 */
  src: string;
  /** 文件名（不含扩展名），例如 '01-初见' */
  name: string;
  /** 灯箱 / 悬浮时显示的说明 */
  caption: string;
  /** 420px 小缩略图 */
  thumbSm?: string;
  /** 720px 缩略图 */
  thumb?: string;
  /** 1600px 大图 */
  full?: string;
  /** 24px 的模糊占位（内联 data URI） */
  blur?: string;
  /** 大图的像素宽高，用来占位、避免布局跳动 */
  width?: number;
  height?: number;
};

/** 按「人能读的顺序」排序：02 排在 10 前面 */
const byName = (a: string, b: string) =>
  a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });

function captionOf(name: string): string {
  const stripped = name.replace(/^\d+[\s\-_.]*/, '');
  return (
    photoCaptions[name] ??
    photoCaptions[stripped] ??
    (stripped || name).replace(/[-_]+/g, ' ')
  );
}

export const photos: Photo[] = Object.entries(derivatives)
  .map(([name, extra]) => {
    const thumbSm = asset(extra.thumbSm);
    const thumb = asset(extra.thumb);
    const full = asset(extra.full);
    return {
      name,
      caption: captionOf(name),
      src: full ?? thumb ?? '',
      thumbSm,
      thumb,
      full,
      blur: extra.blur,
      width: extra.width,
      height: extra.height,
    };
  })
  .filter((photo) => Boolean(photo.src))
  .sort((a, b) => byName(a.name, b.name));

/** 按文件名找一张照片（时间表配图用） */
export function findPhoto(name?: string): Photo | undefined {
  if (!name) return undefined;
  return photos.find((photo) => photo.name === name);
}
