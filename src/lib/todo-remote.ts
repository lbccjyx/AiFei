import { GhError, getToken, readJsonFile, writeJsonFile } from './gh';
import type { Todo } from '../data/todos';

/**
 * 把「勾了 / 取消了」直接写回仓库的 `src/data/todos.json`。
 *
 * 复用「编辑」页那套 GitHub 写入（同一个 token，同一个仓库），提交之后
 * Actions 会重新构建，大约 1 分钟后线上那条就是永久记录了。
 *
 * 两个注意点：
 *   - 所有提交串成一条队列：连点几下不会互相覆盖（每次都会先重新读一遍文件、
 *     拿到最新的 sha 再写）。
 *   - 没有 token 就直接返回 no-token，调用方退回到「只记在这台设备」的老行为。
 */

export const TODOS_FILE = 'src/data/todos.json';

export type CommitResult =
  | { ok: true }
  | { ok: false; reason: 'no-token' | 'missing' | 'error'; message: string };

function today(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** 串行队列：上一次写完再读下一次，避免 sha 冲突 */
let queue: Promise<unknown> = Promise.resolve();

export function commitTodoDone(id: string, done: boolean): Promise<CommitResult> {
  if (!getToken()) {
    return Promise.resolve({ ok: false, reason: 'no-token', message: '' });
  }

  const task = queue
    .then(async (): Promise<CommitResult> => {
      const file = await readJsonFile<Todo[]>(TODOS_FILE);
      if (!file) {
        return { ok: false, reason: 'missing', message: '仓库里没有 todos.json' };
      }
      const target = file.data.find((todo) => todo.id === id);
      if (!target) {
        return {
          ok: false,
          reason: 'missing',
          message: '仓库里还没有这条（刚加的待办要等构建完才能打勾）。',
        };
      }

      if (done) {
        target.done = true;
        target.doneDate = today();
      } else {
        delete target.done;
        delete target.doneDate;
      }

      const message = done ? `待办：完成「${target.text}」` : `待办：取消完成「${target.text}」`;
      await writeJsonFile(TODOS_FILE, file.data, message, file.sha);
      return { ok: true };
    })
    .catch(
      (error: unknown): CommitResult => ({
        ok: false,
        reason: 'error',
        message:
          error instanceof GhError
            ? error.message
            : '提交失败，检查网络后再点一次。',
      }),
    );

  queue = task.catch(() => undefined);
  return task;
}
