import { GhError, getToken, readJsonFile, writeJsonFile } from './gh';
import type { Todo } from '../data/todos';

/**
 * 把一批「勾了 / 取消了」一次性写回仓库的 `src/data/todos.json`。
 *
 * 页面上点待办只改本地状态，点「保存改动」才走到这里 —— 一次提交带上全部改动，
 * 仓库历史里是一笔清晰的记录，而不是点一下冒一个 commit。
 *
 * 复用「编辑」页那套 GitHub 写入（同一个 token、同一个仓库），提交之后
 * Actions 重新构建，大约 1 分钟后线上就是永久记录。
 */

export const TODOS_FILE = 'src/data/todos.json';

export type TodoChange = { id: string; done: boolean };

export type CommitResult =
  | { ok: true; count: number; missing: string[] }
  | { ok: false; reason: 'no-token' | 'nothing' | 'error'; message: string };

function today(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** 提交说明：一条时写清楚是哪件事，多条时列个清单 */
function messageOf(done: Todo[], undone: Todo[]): string {
  const total = done.length + undone.length;
  if (total === 1) {
    const only = done[0] ?? undone[0];
    return `${done.length ? '待办：完成' : '待办：取消完成'}「${only.text}」`;
  }
  const lines = [
    ...done.map((todo) => `- 完成「${todo.text}」`),
    ...undone.map((todo) => `- 取消完成「${todo.text}」`),
  ];
  return `待办：更新 ${total} 条完成状态\n\n${lines.join('\n')}`;
}

/** 串行队列：上一次写完再读下一次，避免 sha 冲突 */
let queue: Promise<unknown> = Promise.resolve();

export function commitTodoChanges(changes: TodoChange[]): Promise<CommitResult> {
  if (!changes.length) {
    return Promise.resolve({ ok: false, reason: 'nothing', message: '没有要保存的改动。' });
  }
  if (!getToken()) {
    return Promise.resolve({ ok: false, reason: 'no-token', message: '' });
  }

  const task = queue
    .then(async (): Promise<CommitResult> => {
      const file = await readJsonFile<Todo[]>(TODOS_FILE);
      if (!file) {
        return { ok: false, reason: 'error', message: '仓库里没有 todos.json' };
      }

      const done: Todo[] = [];
      const undone: Todo[] = [];
      const missing: string[] = [];
      const stamp = today();

      for (const change of changes) {
        const target = file.data.find((todo) => todo.id === change.id);
        if (!target) {
          missing.push(change.id);
          continue;
        }
        // 已经是这个状态就不用动，避免制造空 diff
        if (Boolean(target.done) === change.done) continue;
        if (change.done) {
          target.done = true;
          target.doneDate = stamp;
          done.push(target);
        } else {
          delete target.done;
          delete target.doneDate;
          undone.push(target);
        }
      }

      const changed = done.length + undone.length;
      if (changed === 0) return { ok: true, count: 0, missing };

      await writeJsonFile(TODOS_FILE, file.data, messageOf(done, undone), file.sha);
      return { ok: true, count: changed, missing };
    })
    .catch(
      (error: unknown): CommitResult => ({
        ok: false,
        reason: 'error',
        message:
          error instanceof GhError ? error.message : '提交失败，检查网络后再点一次保存。',
      }),
    );

  queue = task.catch(() => undefined);
  return task;
}
