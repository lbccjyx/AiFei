import { useMemo, useState } from 'react';
import { type TodoCategory } from '../data/todos';
import { useTodos, type TodoFilter } from '../lib/todos';
import Reveal from '../components/effects/Reveal';
import './TodoView.css';

/** 筛选顺序：全部 → 四个分类（按分类在清单里第一次出现的顺序） */
const CATEGORIES: TodoCategory[] = ['旅行', '美食', '日常', '未来'];
const FILTERS: TodoFilter[] = ['全部', ...CATEGORIES];

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.4 8.6 6.5 11.6 12.7 4.6" />
    </svg>
  );
}

export default function TodoView() {
  const { todos, done, toggle, reset, doneCount, total } = useTodos();
  const [filter, setFilter] = useState<TodoFilter>('全部');

  const visible = useMemo(
    () => (filter === '全部' ? todos : todos.filter((todo) => todo.category === filter)),
    [todos, filter],
  );

  const doneOfFilter = useMemo(
    () => visible.reduce((acc, todo) => acc + (done[todo.id] ? 1 : 0), 0),
    [visible, done],
  );

  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <div className="page">
      <header className="page__head">
        <p className="eyebrow">Bucket list</p>
        <h1 className="page__title">要一起做的事</h1>
        <p className="page__sub">
          {total} 件小事，勾掉的 {doneCount} 件。勾选只记在这台设备的浏览器里，
          换个设备就要重新点一遍 —— 站点没有后端，这是它换来的隐私。
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
            name === '全部'
              ? total
              : todos.filter((todo) => todo.category === name).length;
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
            return (
              <li key={todo.id}>
                <Reveal delay={Math.min(index, 6) * 40} duration={380}>
                  <button
                    type="button"
                    className="todo__row"
                    data-done={isDone}
                    aria-pressed={isDone}
                    onClick={() => toggle(todo.id)}
                  >
                    <span className="todo__box" aria-hidden="true">
                      {isDone ? <CheckMark /> : null}
                    </span>
                    <span className="todo__text">{todo.text}</span>
                    <span className="todo__cat">{todo.category}</span>
                  </button>
                </Reveal>
              </li>
            );
          })}
        </ul>
      )}

      <div className="todo__foot">
        <span className="todo__foot-note">
          {filter === '全部' ? '全部清单' : `${filter}清单`}里已完成 {doneOfFilter} 件
        </span>
        {doneCount > 0 ? (
          <button type="button" className="todo__reset" onClick={reset}>
            重置勾选
          </button>
        ) : null}
      </div>
    </div>
  );
}
