/**
 * 「要办的事情」—— 在一起想做的事清单。
 *
 * 数据在 `todos.json` 里（网页「编辑」页可新增）。勾选状态保存在浏览器本地
 * （localStorage），不上传、不需要登录，换设备不会同步。
 *
 * 字段：id 必须唯一且不要改（改了勾选会丢）；category 会变成筛选标签。
 */
import raw from './todos.json';

export type TodoCategory = '旅行' | '美食' | '日常' | '未来';

export type Todo = {
  id: string;
  text: string;
  category: TodoCategory;
};

export const todos = raw as unknown as Todo[];

export const CATEGORIES: TodoCategory[] = ['旅行', '美食', '日常', '未来'];
