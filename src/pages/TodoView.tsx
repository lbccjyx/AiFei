import { useEffect, useMemo, useRef, useState } from 'react';
import { type TodoCategory } from '../data/todos';
import { useTodos, type TodoFilter } from '../lib/todos';
import { mergeTodos, usePending } from '../lib/pending';
import { isPlainClick, usePageReveal } from '../components/page-reveal-context';
import Reveal from '../components/effects/Reveal';
import './TodoView.css';

/** 筛选顺序：全部 → 四个分类（按分类在清单里第一次出现的顺序） */
const CATEGORIES: TodoCategory[] = ['旅行', '美食', '日常', '未来'];
const FILTERS: TodoFilter[] = ['全部', ...CATEGORIES];

type Status = { kind: 'ok' | 'warn' | 'error'; text: string };

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.4 8.6 6.5 11.6 12.7 4.6" />
    </svg>
  );
}

export default function TodoView() {
  const {
    todos: builtTodos,
    done,
    recorded,
    pending,
    pendingCount,
    toggle,
    save,
    revert,
    saving,
    canCommit,
    doneCount,
  } = useTodos();
  const pendingState = usePending();
  const startReveal = usePageReveal();
  const [filter, setFilter] = useState<TodoFilter>('全部');
  const [status, setStatus] = useState<Status | null>(null);
  const statusTimer = useRef<number | null>(null);

  // 构建进站点的 + 刚提交还没构建的
  const entries = useMemo(
    () => mergeTodos(builtTodos, pendingState.todos),
    [builtTodos, pendingState.todos],
  );
  const all = useMemo(() => entries.map((entry) => entry.todo), [entries]);
  const pendingTexts = useMemo(
    () => new Set(entries.filter((entry) => entry.pending).map((entry) => entry.todo.text)),
    [entries],
  );

  const total = all.length;
  const visible = useMemo(
    () => (filter === '全部' ? all : all.filter((todo) => todo.category === filter)),
    [all, filter],
  );

  const doneOfFilter = useMemo(
    () => visible.reduce((acc, todo) => acc + (done[todo.id] ? 1 : 0), 0),
    [visible, done],
  );

  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  useEffect(
    () => () => {
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
    },
    [],
  );

  // 还有没保存的改动时，刷新 / 关页面提醒一下
  useEffect(() => {
    if (pendingCount === 0) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [pendingCount]);

  const notify = (next: Status, ms = 6500) => {
    setStatus(next);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(null), ms);
  };

  const onSave = async () => {
    const result = await save();
    if (result.ok) {
      if (result.count === 0) {
        notify({ kind: 'ok', text: '仓库里已经是这个状态了，没有产生新提交。' });
      } else if (result.missing.length > 0) {
        notify({
          kind: 'warn',
          text: `✓ 保存了 ${result.count} 处；有 ${result.missing.length} 条还没构建进仓库，这次先跳过。`,
        }, 9000);
      } else {
        notify({ kind: 'ok', text: `✓ 已保存 ${result.count} 处改动，约 1 分钟后生效。` });
      }
    } else if (result.reason === 'no-token') {
      notify({
        kind: 'warn',
        text: '保存需要 token：去「编辑」页填一次，之后就能把改动写进仓库。',
      }, 10000);
    } else {
      notify({ kind: 'error', text: `✗ ${result.message}` }, 9000);
    }
  };

  return (
    <div className="page">
      <header className="page__head">
        <p className="eyebrow">Bucket list</p>
        <h1 className="page__title">要一起做的事</h1>
        <p className="page__sub">
          {canCommit
            ? `${total} 件小事，勾掉 ${doneCount} 件。点一下先记在页面上，点「保存改动」写进仓库（约 1 分钟后所有设备同步）。`
            : `${total} 件小事，勾掉 ${doneCount} 件。点一下先记在页面上；想永久保存，去「编辑」页填一次 token。`}
        </p>
      </header>

      <div className="todo__meter">
        <div
          className="todo__track"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="已完成"
        >
          <span className="todo__bar" style={{ width: `${percent}%` }} />
        </div>
        <span className="todo__count">
          {String(doneCount).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
      </div>

      <div className="todo__filters" role="group" aria-label="按分类筛选">
        {FILTERS.map((name) => {
          const countOf =
            name === '全部' ? total : all.filter((todo) => todo.category === name).length;
          return (
            <button
              key={name}
              type="button"
              className="chip"
              data-active={filter === name}
              aria-pressed={filter === name}
              onClick={() => setFilter(name)}
            >
              {name}
              <span className="chip__count">{countOf}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="todo__empty">这个分类还是空的。</p>
      ) : (
        <ul className="todo__list">
          {visible.map((todo, index) => {
            const isDone = Boolean(done[todo.id]);
            const unsaved = pending[todo.id] !== undefined;
            return (
              <li key={todo.id}>
                <Reveal delay={Math.min(index, 6) * 40} duration={380}>
                  <button
                    type="button"
                    className="todo__row"
                    data-done={isDone}
                    data-unsaved={unsaved ? 'true' : 'false'}
                    aria-pressed={isDone}
                    onClick={() => toggle(todo.id)}
                  >
                    <span className="todo__box" aria-hidden="true">
                      {isDone ? <CheckMark /> : null}
                    </span>
                    <span className="todo__text">{todo.text}</span>
                    {recorded[todo.id] && isDone && !unsaved ? (
                      <span className="todo__record">
                        {todo.doneDate ? `已记录 · ${todo.doneDate}` : '已记录'}
                      </span>
                    ) : null}
                    {pendingTexts.has(todo.text) ? (
                      <span className="todo__pending">待构建</span>
                    ) : null}
                    {unsaved ? <span className="todo__unsaved">未保存</span> : null}
                    <span className="todo__cat">{todo.category}</span>
                  </button>
                </Reveal>
              </li>
            );
          })}
        </ul>
      )}

      {status ? <p className={`todo__status is-${status.kind}`}>{status.text}</p> : null}

      <div className="todo__foot">
        <span className="todo__foot-note">
          {filter === '全部' ? '全部清单' : `${filter}清单`}里已完成 {doneOfFilter} 件
          {pendingCount > 0 ? ` · 有 ${pendingCount} 处未保存` : ''}
        </span>
        <div className="todo__foot-actions">
          <button
            type="button"
            className="todo__add"
            onClick={(event) => {
              if (!isPlainClick(event)) return;
              startReveal('admin', event.clientX, event.clientY);
            }}
          >
            ＋ 添加一件
          </button>
          {!canCommit ? (
            <button
              type="button"
              className="todo__add"
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                startReveal('admin', event.clientX, event.clientY);
              }}
            >
              填 token（永久记录）
            </button>
          ) : null}
        </div>
      </div>

      {/* 有未保存的改动就浮在底部：17 条的清单里，页脚的按钮根本看不见 */}
      {pendingCount > 0 ? (
        <div className="todo__savebar" role="region" aria-label="未保存的改动">
          <span className="todo__savebar-text">{pendingCount} 处未保存</span>
          <div className="todo__savebar-actions">
            <button
              type="button"
              className="todo__reset"
              onClick={revert}
              disabled={saving}
            >
              撤销
            </button>
            <button
              type="button"
              className="todo__save"
              onClick={() => void onSave()}
              disabled={saving}
            >
              {saving ? '保存中…' : '保存改动'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
