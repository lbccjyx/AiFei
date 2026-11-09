import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TodoCategory } from '../data/todos';
import { todos as allTodos } from '../data/todos';
import { getToken } from './gh';
import { commitTodoDone, type CommitResult } from './todo-remote';

/**
 * 待办清单的勾选状态。
 *
 * 三层：
 *   1. **仓库里的记录** —— `todos.json` 里写了 `"done": true` 的，所有设备都显示已完成。
 *   2. **提交中的临时状态** —— 点一下先进这里，同时把改动提交到 GitHub。
 *   3. **浏览器里的临时勾选** —— 没配 token 时退回到这一层：只在本机生效，
 *      换设备 / 清缓存就没了。
 *
 * 配了 token（在「编辑」页填一次）之后，点一下 = 一次提交，约 1 分钟后
 * 重新构建完成，这条记录就永久留在仓库里。
 */
const STORAGE_KEY = 'aifei:todos:v1';

/** id → true/false：只存「和文件不一样」的那些，和文件一致就从这里删掉 */
type Overrides = Record<string, boolean>;

function readOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const map: Overrides = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') map[id] = value;
    }
    return map;
  } catch {
    return {};
  }
}

/** 写一条覆盖值；和文件里一致就不必占地方 */
function withOverride(
  prev: Overrides,
  id: string,
  value: boolean,
  recorded: Record<string, boolean>,
): Overrides {
  const next = { ...prev };
  if (Boolean(recorded[id]) === value) delete next[id];
  else next[id] = value;
  return next;
}

export type TodoFilter = '全部' | TodoCategory;

export function useTodos() {
  const [overrides, setOverrides] = useState<Overrides>(readOverrides);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      /* 隐私模式 / 存储被禁用：勾选只在本次会话有效 */
    }
  }, [overrides]);

  /** 文件里写的完成状态（todos.json 的 done: true） */
  const recorded = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const todo of allTodos) if (todo.done) map[todo.id] = true;
    return map;
  }, []);

  /** 生效状态：本地临时勾选优先，其次才是文件记录 */
  const done = useMemo(() => {
    const map: Record<string, boolean> = { ...recorded };
    for (const [id, value] of Object.entries(overrides)) {
      if (value) map[id] = true;
      else delete map[id];
    }
    return map;
  }, [overrides, recorded]);

  /** 配过 token 才能提交到仓库（没有就只记本机） */
  const canCommit = useMemo(() => Boolean(getToken()), []);

  /**
   * 点一下：先本地生效（立刻有反馈），再把改动提交到仓库。
   * 提交失败会退回原状，并把原因交给调用方去提示。
   */
  const toggle = useCallback(
    async (id: string): Promise<CommitResult> => {
      const next = !done[id];
      setOverrides((prev) => withOverride(prev, id, next, recorded));
      setSaving((prev) => ({ ...prev, [id]: true }));
      try {
        const result = await commitTodoDone(id, next);
        if (!result.ok && result.reason === 'error') {
          setOverrides((prev) => withOverride(prev, id, !next, recorded));
        }
        return result;
      } finally {
        setSaving((prev) => {
          const rest = { ...prev };
          delete rest[id];
          return rest;
        });
      }
    },
    [done, recorded],
  );

  /** 只清本地临时勾选，仓库里的记录不受影响 */
  const reset = useCallback(() => setOverrides({}), []);

  const doneCount = useMemo(
    () => allTodos.reduce((acc, todo) => acc + (done[todo.id] ? 1 : 0), 0),
    [done],
  );

  const recordedCount = useMemo(
    () => allTodos.reduce((acc, todo) => acc + (recorded[todo.id] ? 1 : 0), 0),
    [recorded],
  );

  const hasOverrides = Object.keys(overrides).length > 0;

  return {
    todos: allTodos,
    done,
    recorded,
    toggle,
    reset,
    saving,
    canCommit,
    hasOverrides,
    doneCount,
    recordedCount,
    total: allTodos.length,
  };
}
