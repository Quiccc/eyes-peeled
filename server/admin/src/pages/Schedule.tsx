import { useMemo, useState } from 'react';

import { api } from '../api';
import { addMonths, formatDay, message, useLoad, utcToday } from '../hooks';
import { DIFFICULTIES, LEVEL, type AdminWord, type Difficulty, type MonthSchedule } from '../types';

export function Schedule() {
  const [month, setMonth] = useState(() => utcToday().slice(0, 7));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const schedule = useLoad(() => api.get<MonthSchedule>(`/admin/schedule?month=${month}`), [month]);
  const words = useLoad(() => api.get<AdminWord[]>('/admin/words'), []);

  // Words that can be picked for a day: enabled and not known to be missing from the model.
  const choices = useMemo(() => {
    const by: Record<Difficulty, AdminWord[]> = { easy: [], medium: [], hard: [], expert: [] };
    for (const w of words.data ?? []) if (w.enabled && w.knownByModel !== false) by[w.difficulty].push(w);
    return by;
  }, [words.data]);

  async function act(run: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await run());
      await Promise.all([schedule.reload(), words.reload()]);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const fill = () =>
    act(async () => {
      const res = await api.post<{ filled: number }>('/admin/schedule', { month });
      return res.filled ? `Planned ${res.filled} empty slot(s).` : 'Every day from today on is already planned.';
    });

  const change = (date: string, difficulty: Difficulty, wordId: string) =>
    act(async () => {
      await api.put(`/admin/schedule/${date}/${difficulty}`, { wordId });
      return null;
    });

  const data = schedule.data;
  const empty = data
    ? data.days.filter((d) => d.date >= data.today).reduce((n, d) => n + DIFFICULTIES.filter((k) => !d.words[k]).length, 0)
    : 0;

  return (
    <section>
      <div className="toolbar">
        <h2>Schedule</h2>
        <div className="month-picker">
          <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            ‹
          </button>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        <button className="primary" disabled={busy || !data || empty === 0} onClick={fill}>
          Fill {empty || ''} empty slot{empty === 1 ? '' : 's'}
        </button>
      </div>
      <p className="muted">
        Days roll over at 00:00 UTC. Today and past days are locked. Filling never changes a planned day; it only
        picks enabled words the model knows, spreading repeats as far apart as possible.
      </p>
      {notice && <p className="notice">{notice}</p>}
      {(error || schedule.error) && <p className="error">{error ?? schedule.error}</p>}

      {data && (
        <div className="table-wrap">
          <table className="schedule">
            <thead>
              <tr>
                <th>Day (UTC)</th>
                {DIFFICULTIES.map((d) => (
                  <th key={d}>
                    {LEVEL[d]} <span className="muted">({d})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => {
                const locked = day.date <= data.today;
                return (
                  <tr key={day.date} className={day.date === data.today ? 'today' : locked ? 'past' : ''}>
                    <td className="nowrap">
                      {formatDay(day.date)}
                      {day.date === data.today && <span className="badge">today</span>}
                    </td>
                    {DIFFICULTIES.map((d) => {
                      const current = day.words[d];
                      if (locked) return <td key={d}>{current?.label ?? <span className="muted">–</span>}</td>;
                      const options = choices[d];
                      const missing = current && !options.some((w) => w.id === current.wordId);
                      return (
                        <td key={d}>
                          <select
                            disabled={busy}
                            value={current?.wordId ?? ''}
                            className={current ? '' : 'empty'}
                            onChange={(e) => e.target.value && change(day.date, d, e.target.value)}
                          >
                            {!current && <option value="">– empty –</option>}
                            {missing && <option value={current.wordId}>{current.label} (retired/unknown)</option>}
                            {options.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
