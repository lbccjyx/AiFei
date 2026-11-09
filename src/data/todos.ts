/**
 * 「要办的事情」—— 在一起想做的事清单。
 *
 * 数据在 `todos.json` 里。想加一条、勾掉一条，直接改这个文件就行：
 *
 *   { "id": "w3", "text": "一次拍写真", "category": "日常", "done": true, "doneDate": "2026-11-09" }
 *
 * `done: true` 是**写进仓库的记录**：构建上线之后所有设备都看得到。
 * 网页上点的那一下只记在当前浏览器（localStorage），算是「临时勾选」，
 * 想永久记下来就改文件，或者跑 `npm run todo -- done w3`。
 *
 * 字段：id 必须唯一且不要改（改了记录会丢）；category 会变成筛选标签。
 */
import raw from './todos.json';

export type TodoCategory = '旅行' | '美食' | '日常' | '未来';

export type Todo = {
  id: string;
  text: string;
  category: TodoCategory;
  /** 已完成：写进文件就是长期记录，全设备可见 */
  done?: boolean;
  /** 完成日期（可选），写文件时随手记一下 */
  doneDate?: string;
};

export const todos = raw as unknown as Todo[];

export const CATEGORIES: TodoCategory[] = ['旅行', '美食', '日常', '未来'];
