#!/usr/bin/env node
/**
 * 图片三件套生成器。
 *
 * 原图放在 content/photos/，单张常常 1 MB 上下，直接丢给页面手机扛不住。
 * 这里给每张图烘三个尺寸：
 *
 *   blur   24px 模糊占位，转成 base64 内联进清单 —— 0 个请求，打开就有画面
 *   thumb  720px 缩略图（WebP，约 30 KB）—— 照片墙、时间表缩略图、详情抽屉用它
 *   full   1600px 大图（WebP，约 200 KB）—— 灯箱和后台慢慢预取用它
 *
 * 产物写到 public/media/，文件名带内容哈希：换了图自然换地址，不会吃到旧缓存。
 * 清单写到 src/data/photo-manifest.json，前端按文件名查。
 *
 * 由 `npm run dev` / `npm run build` 之前自动跑（predev / prebuild），
 * 也可以手动 `npm run photos`。
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(root, 'content', 'photos');
const OUT_DIR = join(root, 'public', 'media');
const MANIFEST = join(root, 'src', 'data', 'photo-manifest.json');

const SOURCE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const THUMB_WIDTH = 720;
/** 手机上格子只有 180px 宽，720 的缩略图等于塞了 4 倍像素，再给一档小的 */
const THUMB_SMALL_WIDTH = 420;
const FULL_WIDTH = 1600;
const BLUR_WIDTH = 24;

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listSources() {
  const entries = await readdir(SRC_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && SOURCE_EXT.has(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }));
}

async function main() {
  await mkdir(join(OUT_DIR, 'thumb'), { recursive: true });
  await mkdir(join(OUT_DIR, 'thumb-sm'), { recursive: true });
  await mkdir(join(OUT_DIR, 'full'), { recursive: true });

  const files = await listSources();
  const keep = new Set();
  const manifest = {};
  let reused = 0;
  let bytes = 0;

  for (const file of files) {
    const name = file.replace(/\.[^.]+$/, '');
    const buffer = await readFile(join(SRC_DIR, file));
    const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 10);

    const thumbRel = `media/thumb/${name}.${hash}.webp`;
    const thumbSmRel = `media/thumb-sm/${name}.${hash}.webp`;
    const fullRel = `media/full/${name}.${hash}.webp`;
    const thumbPath = join(root, 'public', thumbRel);
    const thumbSmPath = join(root, 'public', thumbSmRel);
    const fullPath = join(root, 'public', fullRel);
    keep.add(thumbPath);
    keep.add(thumbSmPath);
    keep.add(fullPath);

    // 同样的图（哈希一样）之前烘过就复用，日常 dev 不用每次等几秒
    if ((await exists(thumbPath)) && (await exists(thumbSmPath)) && (await exists(fullPath))) {
      reused += 1;
    } else {
      await sharp(buffer)
        .rotate()
        .resize({ width: THUMB_SMALL_WIDTH, withoutEnlargement: true })
        .webp({ quality: 70, effort: 4 })
        .toFile(thumbSmPath);

      await sharp(buffer)
        .rotate()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: 72, effort: 4 })
        .toFile(thumbPath);

      await sharp(buffer)
        .rotate()
        .resize({ width: FULL_WIDTH, withoutEnlargement: true })
        .webp({ quality: 76, effort: 4 })
        .toFile(fullPath);
    }

    const blur = await sharp(buffer)
      .rotate()
      .resize({ width: BLUR_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 42 })
      .toBuffer();

    const meta = await sharp(fullPath).metadata();
    bytes += (await stat(fullPath)).size;

    manifest[name] = {
      thumbSm: thumbSmRel,
      thumb: thumbRel,
      full: fullRel,
      blur: `data:image/jpeg;base64,${blur.toString('base64')}`,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    };
  }

  // 删掉改名 / 换图之后留下的旧产物
  for (const dir of ['thumb', 'thumb-sm', 'full']) {
    for (const entry of await readdir(join(OUT_DIR, dir))) {
      const path = join(OUT_DIR, dir, entry);
      if (!keep.has(path)) await unlink(path);
    }
  }

  // 键排序，清单才是稳定文本，git 里不会每次构建都整文件抖动
  const ordered = Object.fromEntries(
    Object.keys(manifest)
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }))
      .map((key) => [key, manifest[key]]),
  );
  await writeFile(MANIFEST, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');

  console.log(
    `✓ 照片已处理：${files.length} 张（新烘 ${files.length - reused} · 复用 ${reused}）· 大图合计 ${mb(bytes)}`,
  );
}

await main();
