#!/usr/bin/env node
/**
 * 在命令行里改「要一起做的事」。
 *
 *   npm run todo                      看清单
 *   npm run todo -- done 3            第 3 条记成完成（也可以写 id，比如 w3）
 *   npm run todo -- undo 3            取消完成
 *   npm run todo -- add "一起去看海" --cat 旅行
 *   npm run todo -- rm 3              删掉第 3 条
 *
 * 改的是 src/data/todos.json —— `done: true` 会被当成「写进仓库的记录」，
 * 构建上线之后所有设备都能看到。改完记得 `npm run deploy` 才会到线上。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'src', 'data', 'todos.json');
const CATEGORIES = ['旅行', '美食', '日常', '未来'];

const pad = (text, width) => {
  // 中文按两个字符宽算，终端里才能对齐
  let used = 0;
  for (const ch of text) used += /[\u4e00-\u9fa5]/.test(ch) ? 2 : 1;
  return text + ' '.repeat(Math.max(0, width - used));
};

function today() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function read() {
  return JSON.parse(readFileSync(FILE, 'utf8'));
}

function write(list) {
  const clean = list.map((todo) => {
    const next = { id: todo.id, text: todo.text, category: todo.category };
    if (todo.done) next.done = true;
    if (todo.done && todo.doneDate) next.doneDate = todo.doneDate;
    return next;
  });
  writeFileSync(FILE, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
}

/** 按 1 起的序号或 id 找一条 */
function pick(list, key) {
  const index = Number(key);
  if (Number.isInteger(index) && index >= 1 && index <= list.length) return list[index - 1];
  const byId = list.find((todo) => todo.id === key);
  if (!byId) {
    console.error(`✗ 没找到「${key}」：序号要在 1–${list.length} 之间，或者写完整的 id。`);
    process.exit(1);
  }
  return byId;
}

function print(list) {
  const width = Math.max(...list.map((todo) => todo.text.length), 8);
  list.forEach((todo, index) => {
    const mark = todo.done ? '[x]' : '[ ]';
    const date = todo.done && todo.doneDate ? `  (${todo.doneDate})` : '';
    console.log(
      `${String(index + 1).padStart(2)}  ${mark}  ${pad(todo.category, 4)}  ${pad(todo.text, width)}  ${todo.id}${date}`,
    );
  });
  const doneCount = list.filter((todo) => todo.done).length;
  console.log('');
  console.log(`共 ${list.length} 件，已记录完成 ${doneCount} 件。`);
}

function usage() {
  console.log(`用法：
  npm run todo                       看清单
  npm run todo -- done 3             第 3 条记成完成
  npm run todo -- undo 3             取消完成
  npm run todo -- add "一起去看海" --cat 旅行
  npm run todo -- rm 3               删掉第 3 条

改完跑 npm run deploy 才会更新到线上。`);
}

const argv = process.argv.slice(2);
const command = argv[0];
const list = read();

if (!command || command === 'list' || command === 'ls') {
  print(list);
  process.exit(0);
}

const rest = argv.slice(1);
const flagIndex = rest.indexOf('--cat');
const category = flagIndex >= 0 ? rest[flagIndex + 1] : undefined;
const words =
  flagIndex >= 0 ? rest.filter((_, index) => index !== flagIndex && index !== flagIndex + 1) : rest;

if (command === 'done' || command === 'undo') {
  const target = words[0];
  if (!target) usage(), process.exit(1);
  const todo = pick(list, target);
  if (command === 'done') {
    todo.done = true;
    todo.doneDate = today();
  } else {
    delete todo.done;
    delete todo.doneDate;
  }
  write(list);
  console.log(`✓ ${command === 'done' ? '记成完成' : '取消完成'}：${todo.text}`);
} else if (command === 'add') {
  const text = words.join(' ').trim();
  if (!text) {
    console.error('✗ 写点内容：npm run todo -- add "一起去看海" --cat 旅行');
    process.exit(1);
  }
  if (category && !CATEGORIES.includes(category)) {
    console.error(`✗ 分类只能是：${CATEGORIES.join(' / ')}`);
    process.exit(1);
  }
  const todo = { id: `t${Date.now().toString(36)}`, text, category: category ?? '日常' };
  list.push(todo);
  write(list);
  console.log(`✓ 加了一件事：${text}（${todo.category}，id ${todo.id}）`);
} else if (command === 'rm' || command === 'remove') {
  const target = words[0];
  if (!target) usage(), process.exit(1);
  const todo = pick(list, target);
  write(list.filter((item) => item !== todo));
  console.log(`✓ 删掉了：${todo.text}`);
} else {
  usage();
  process.exit(1);
}

console.log('· 改完跑 npm run deploy 才会更新到线上。');
