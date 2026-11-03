#!/usr/bin/env node
/**
 * 一键发布。
 *
 *   npm run deploy
 *   npm run deploy -- "补两张照片"      # 自定义提交说明
 *
 * 做两件事：先在本地跑一次完整构建（构建不过就不推，免得把 Actions 跑红），
 * 再把源码提交并推送到 GitHub —— 真正的发布由
 * `.github/workflows/deploy.yml` 在 Actions 里完成。
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

// Windows 上 npm 是 .cmd 包装脚本，execFileSync 不能直接起，得走 cmd.exe
const npm = (args) => {
  if (isWin) {
    execFileSync('cmd.exe', ['/c', 'npm', ...args], { stdio: 'inherit', cwd: root });
  } else {
    execFileSync('npm', args, { stdio: 'inherit', cwd: root });
  }
};
const git = (args, opts = {}) =>
  execFileSync('git', args, { stdio: 'inherit', cwd: root, ...opts });

try {
  git(['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
} catch {
  console.error('✗ 当前目录不是 git 仓库，先 git init / git clone。');
  process.exit(1);
}

npm(['run', 'build']);

const dirty = execFileSync('git', ['status', '--porcelain'], {
  cwd: root,
  encoding: 'utf8',
}).trim();

if (dirty) {
  const message =
    process.argv.slice(2).join(' ').trim() ||
    `update ${new Date().toISOString().slice(0, 10)}`;
  git(['add', '-A']);
  git(['commit', '-m', message]);
} else {
  console.log('· 工作区没有改动，直接推送。');
}

git(['push']);
console.log('');
console.log('✓ 已推送。GitHub Actions 会自动构建并发布到 GitHub Pages。');
