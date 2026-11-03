#!/usr/bin/env node
/**
 * Scaffold a new post (Hexo-style `hexo new`).
 *
 *   npm run new -- "文章标题"
 *   npm run new -- "文章标题" --tags 区块链,笔记
 *   npm run new -- "Post" --slug my-post --tags notes
 *
 * Creates:
 *   content/posts/<slug>.md   — frontmatter + empty body
 *   content/posts/<slug>/     — sibling folder for images, referenced in
 *                               markdown as ./<slug>/xxx.png or ./xxx.png
 *
 * The file name is the slug; non-ASCII (e.g. Chinese) names are supported.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const postsDir = join(root, 'content', 'posts');

const args = process.argv.slice(2);
const positional = [];
let tagsArg = '';
let slugOverride = '';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--tags' || arg === '--tag') {
    tagsArg = args[++i] ?? '';
  } else if (arg === '--slug') {
    slugOverride = args[++i] ?? '';
  } else {
    positional.push(arg);
  }
}

const title = positional.join(' ').trim();
if (!title) {
  console.error('用法 / Usage: npm run new -- "文章标题" [--tags 标签1,标签2] [--slug url-slug]');
  process.exit(1);
}

// Slug = file name. Strip characters illegal on Windows/macOS/Linux file
// systems and control characters (0x00-0x1F, 0x7F); everything else
// (including Chinese) is kept; whitespace runs become '-'.
const illegal = new RegExp('[\\\\/:*?"<>|\x00-\x1f\x7f]', 'g');
const slug =
  (slugOverride || title)
    .replace(illegal, '_')
    .replace(/\s+/g, '-')
    .trim() || 'untitled';

const mdPath = join(postsDir, `${slug}.md`);
const assetDir = join(postsDir, slug);

if (existsSync(mdPath)) {
  console.error(`已存在 / Already exists: content/posts/${slug}.md`);
  process.exit(1);
}

// Local date, YYYY-MM-DD.
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
  now.getDate(),
).padStart(2, '0')}`;

const tags = tagsArg
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

// Quote the title: it may contain ':' or '[]' which the minimal frontmatter
// parser would otherwise misread. Use single quotes if it has doubles.
const quoted = title.includes('"') && !title.includes("'")
  ? `'${title}'`
  : `"${title.replaceAll('"', '＂')}"`;

const tagLine = tags.length ? ` [${tags.join(', ')}]` : ' []';

const body = `---
title: ${quoted}
date: ${date}
tags:${tagLine}
excerpt: ""
# cover: ./${slug}/cover.png
---

`;

mkdirSync(postsDir, { recursive: true });
mkdirSync(assetDir, { recursive: true });
writeFileSync(mdPath, body, 'utf8');

console.log('✓ 已创建 / Created:');
console.log(`  content/posts/${slug}.md`);
console.log(`  content/posts/${slug}/         （放图片 / put images here）`);
console.log('');
console.log('写完后发布 / Publish with:  npm run deploy');
