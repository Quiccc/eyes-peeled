import { useMemo, useState } from 'react';

import { api } from '../api';
import { addDays, formatDay, pct, useLoad, utcToday } from '../hooks';
import { LEVEL, type WordDayStats } from '../types';

/** A word looks unfair when real players mostly fail it. */
const LOW_PASS = 0.3;
const MIN_ATTEMPTS = 5;

type Sort = 'date' | 'pass';

export function Stats() {
  const [to, setTo] = useState(utcToday);
  const [from, setFrom] = useState(() => addDays(utcToday(), -29));
  const [sort, setSort] = useState<Sort>('pass');
  const stats = useLoad(() => api.get<WordDayStats[]>(`/admin/stats?from=${from}&to=${to}`), [from, to]);

  const rows = useMemo(() => {
    const list = [...(stats.data ?? [])];
    if (sort === 'pass') list.sort((a, b) => (a.passRate ?? 2) - (b.passRate ?? 2) || b.attempts - a.attempts);
    return list;
  }, [stats.data, sort]);

  const totals = useMemo(() => {
    const t = { attempts: 0, valid: 0, invalid: 0 };
    for (const r of stats.data ?? []) {
      t.attempts += r.attempts;
      t.valid += r.valid;
      t.invalid += r.invalid;
    }
    return t;
  }, [stats.data]);

  return (
    <section>
      <div className="toolbar">
        <h2>Stats</h2>
        <label className="inline">
          From <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label className="inline">
          To <input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
        <div className="tabs">
          <button className={sort === 'pass' ? 'active' : ''} onClick={() => setSort('pass')}>
            Lowest pass rate
          </button>
          <button className={sort === 'date' ? 'active' : ''} onClick={() => setSort('date')}>
            By date
          </button>
        </div>
      </div>
      <p className="muted">
        Rows in red: under {pct(LOW_PASS)} of photos pass with at least {MIN_ATTEMPTS} attempts. That word may be
        unfair: check it in the word test, raise or lower its threshold, or retire it.
      </p>
      {stats.error && <p className="error">{stats.error}</p>}

      {stats.data && (
        <div className="stats-row">
          <div className="tile card">
            <span className="muted">Attempts</span>
            <strong>{totals.attempts}</strong>
          </div>
          <div className="tile card">
            <span className="muted">Finds</span>
            <strong>{totals.valid}</strong>
          </div>
          <div className="tile card">
            <span className="muted">Overall pass rate</span>
            <strong>{pct(totals.valid + totals.invalid ? totals.valid / (totals.valid + totals.invalid) : null)}</strong>
          </div>
        </div>
      )}

      {stats.data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Level</th>
                <th>Word</th>
                <th className="num">Attempts</th>
                <th className="num">Finds</th>
                <th className="num">Rejected</th>
                <th className="num">Pass rate</th>
                <th className="num">Finders</th>
                <th className="num">Avg. rejected score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const flagged = r.passRate !== null && r.passRate < LOW_PASS && r.attempts >= MIN_ATTEMPTS;
                return (
                  <tr key={`${r.date}-${r.difficulty}`} className={flagged ? 'flagged' : ''}>
                    <td className="nowrap">{formatDay(r.date)}</td>
                    <td>{LEVEL[r.difficulty]}</td>
                    <td>{r.label}</td>
                    <td className="num">{r.attempts}</td>
                    <td className="num">{r.valid}</td>
                    <td className="num">{r.invalid}</td>
                    <td className="num">{pct(r.passRate)}</td>
                    <td className="num">{r.finders}</td>
                    <td className="num">{r.avgInvalidConfidence ?? '–'}</td>
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
