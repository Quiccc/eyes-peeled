import { useState, type FormEvent } from 'react';

import { api } from '../api';
import { formatDay, message, useLoad } from '../hooks';
import { DIFFICULTIES, LEVEL, type AdminWord, type Difficulty } from '../types';

export function Words() {
  const words = useLoad(() => api.get<AdminWord[]>('/admin/words'), []);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  async function act(run: () => Promise<unknown>) {
    setError(null);
    try {
      await run();
    } catch (e) {
      setError(message(e));
    }
    await words.reload();
  }

  const add = (e: FormEvent) => {
    e.preventDefault();
    void act(async () => {
      await api.post('/admin/words', { label, difficulty });
      setLabel('');
    });
  };

  return (
    <section>
      <div className="toolbar">
        <h2>Words</h2>
      </div>
      <p className="muted">
        Retire a word instead of deleting it: it stays in history but is never scheduled again. A threshold overrides
        the server's default for that word only (higher = stricter). New words must be ones the running model knows;
        train it first (yolo/README.md, "Adding words").
      </p>

      <form className="inline-form card" onSubmit={add}>
        <input placeholder="New word, e.g. cup" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {LEVEL[d]} ({d})
            </option>
          ))}
        </select>
        <button className="primary" disabled={!label.trim()}>
          Add word
        </button>
      </form>

      {(error || words.error) && <p className="error">{error ?? words.error}</p>}

      {words.data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Word</th>
                <th>Level</th>
                <th>Enabled</th>
                <th>Threshold</th>
                <th>Model</th>
                <th>Last used</th>
                <th>Next planned</th>
              </tr>
            </thead>
            <tbody>
              {words.data.map((w) => (
                <tr key={w.id} className={w.enabled ? '' : 'past'}>
                  <td>{w.label}</td>
                  <td>{LEVEL[w.difficulty]}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={w.enabled}
                      aria-label={`${w.label} enabled`}
                      onChange={(e) => act(() => api.patch(`/admin/words/${w.id}`, { enabled: e.target.checked }))}
                    />
                  </td>
                  <td>
                    <ThresholdInput
                      word={w}
                      onSave={(v) => act(() => api.patch(`/admin/words/${w.id}`, { minConfidence: v }))}
                    />
                  </td>
                  <td>
                    {w.knownByModel === null ? (
                      <span className="muted">no model</span>
                    ) : w.knownByModel ? (
                      <span className="pill ok">knows it</span>
                    ) : (
                      <span className="pill bad">unknown</span>
                    )}
                  </td>
                  <td className="nowrap">{w.lastUsed ? formatDay(w.lastUsed) : <span className="muted">never</span>}</td>
                  <td className="nowrap">{w.nextUse ? formatDay(w.nextUse) : <span className="muted">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Blank = server default. Saves on blur or Enter. */
function ThresholdInput({ word, onSave }: { word: AdminWord; onSave: (v: number | null) => void }) {
  const [value, setValue] = useState(word.minConfidence?.toString() ?? '');
  const save = () => {
    const v = value.trim() === '' ? null : Number(value);
    if (v !== null && (Number.isNaN(v) || v < 0 || v > 1)) {
      setValue(word.minConfidence?.toString() ?? '');
      return;
    }
    if (v !== word.minConfidence) onSave(v);
  };
  return (
    <input
      className="narrow"
      type="number"
      min={0}
      max={1}
      step={0.05}
      placeholder="default"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}
