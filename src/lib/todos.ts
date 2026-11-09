import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TodoCategory } from '../data/todos';
import { todos as allTodos } from '../data/todos';

/**
 * 待办清单的勾选状态。
 *
 * 两层：
 *   1. **文件里的记录** —— `todos.json` 里写了 `"done": true` 的，构建上线后
 *      所有设备都显示已完成。这是「真正记下来了」的那一层。
 *   2. **浏览器里的临时勾选** —— 网页上点的那一下只存在 localStorage，换设备 /
 *      清缓存就没了。想长期保留，就把那条写进文件（或 `npm run todo -- done <id>`）。
 *
 * 合并规则：本地点过的那一条以本地为准（可以临时取消文件里记的完成）；
 * 没点过的，看文件。
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

export type TodoFilter = '全部' | TodoCategory;

export function useTodos() {
  const [overrides, setOverrides] = useState<Overrides>(readOverrides);

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

  const toggle = useCallback(
    (id: string) => {
      setOverrides((prev) => {
        const current = prev[id] ?? Boolean(recorded[id]);
        const value = !current;
        const next = { ...prev };
        // 和文件一致就不用记，存储保持干净
        if (Boolean(recorded[id]) === value) delete next[id];
        else next[id] = value;
        return next;
      });
    },
    [recorded],
  );

  /** 只清本地临时勾选，文件里的记录不受影响 */
  const reset = useCallback(() => setOverrides({}), []);

  const doneCount = useMemo(
    () => allTodos.reduce((acc, todo) => acc + (done[todo.id] ? 1 : 0), 0),
    [done],
  );

  const recordedCount = useMemo(
    () => allTodos.reduce((acc, todo) => acc + (recorded[todo.id] ? 1 : 0), 0),
    [recorded],
  );

  return {
    todos: allTodos,
    done,
    recorded,
    toggle,
    reset,
    doneCount,
    recordedCount,
    total: allTodos.length,
  };
}
