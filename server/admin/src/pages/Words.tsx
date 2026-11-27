import { Fragment, useState, type FormEvent } from 'react';

import { api } from '../api';
import { formatDay, message, useLoad } from '../hooks';
import {
  DIFFICULTIES,
  LANGUAGES,
  LEVEL,
  type AdminWord,
  type Difficulty,
  type TranslateResult,
  type WordTranslations,
} from '../types';

const translatedCount = (w: AdminWord) => LANGUAGES.filter(([l]) => w.translations[l]?.trim()).length;

export function Words() {
  const words = useLoad(() => api.get<AdminWord[]>('/admin/words'), []);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  /** Ask Claude for missing translations: one word, or every word. */
  const autoTranslate = (ids?: string[]) =>
    act(async () => {
      setNotice(null);
      setTranslating(true);
      try {
        const r = await api.post<TranslateResult>('/admin/words/translate', ids ? { ids } : {});
        setNotice(
          `Translated ${r.translated} word${r.translated === 1 ? '' : 's'}.` +
            (r.failed.length ? ` Failed: ${r.failed.join(', ')}.` : ''),
        );
      } finally {
        setTranslating(false);
      }
    });
  const incomplete = words.data?.filter((w) => translatedCount(w) < LANGUAGES.length).length ?? 0;

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
        <button disabled={translating || !incomplete} onClick={() => autoTranslate()}>
          {translating ? 'Translating…' : `Auto-translate missing (${incomplete})`}
        </button>
      </div>
      <p className="muted">
        Retire a word instead of deleting it: it stays in history but is never scheduled again. A threshold overrides
        the server's default for that word only (higher = stricter). Any physical object works as a word: Claude
        judges the photos. Words are entered in English, which is what Claude looks for; players in other languages
        see the translation (or the English word when there is none). New words are translated automatically when the
        server has an API key. Check the drafts under Languages.
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
      {notice && <p className="notice">{notice}</p>}

      {words.data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Word</th>
                <th>Level</th>
                <th>Enabled</th>
                <th>Threshold</th>
                <th>Languages</th>
                <th>Last used</th>
                <th>Next planned</th>
              </tr>
            </thead>
            <tbody>
              {words.data.map((w) => (
                <Fragment key={w.id}>
                  <tr className={w.enabled ? '' : 'past'}>
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
                      <button className="link" onClick={() => setOpen(open === w.id ? null : w.id)}>
                        {translatedCount(w)}/{LANGUAGES.length} {open === w.id ? '▴' : '▾'}
                      </button>
                    </td>
                    <td className="nowrap">{w.lastUsed ? formatDay(w.lastUsed) : <span className="muted">never</span>}</td>
                    <td className="nowrap">{w.nextUse ? formatDay(w.nextUse) : <span className="muted">–</span>}</td>
                  </tr>
                  {open === w.id && (
                    <tr>
                      <td colSpan={7}>
                        <TranslationsEditor
                          key={JSON.stringify(w.translations)}
                          word={w}
                          busy={translating}
                          onSave={(t) => act(() => api.patch(`/admin/words/${w.id}`, { translations: t }))}
                          onAutoTranslate={() => autoTranslate([w.id])}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** One input per language. Blank = show the English word. */
function TranslationsEditor({
  word,
  busy,
  onSave,
  onAutoTranslate,
}: {
  word: AdminWord;
  busy: boolean;
  onSave: (t: WordTranslations) => void;
  onAutoTranslate: () => void;
}) {
  const [draft, setDraft] = useState<WordTranslations>(word.translations);
  const dirty = LANGUAGES.some(([l]) => (draft[l] ?? '').trim() !== (word.translations[l] ?? '').trim());
  return (
    <div className="translations">
      {LANGUAGES.map(([l, name]) => (
        <label key={l}>
          <span className="muted">{name}</span>
          <input
            value={draft[l] ?? ''}
            placeholder={word.label}
            maxLength={60}
            onChange={(e) => setDraft({ ...draft, [l]: e.target.value })}
          />
        </label>
      ))}
      <div className="translations-actions">
        <button className="primary" disabled={!dirty} onClick={() => onSave(draft)}>
          Save translations
        </button>
        <button disabled={busy || translatedCount(word) === LANGUAGES.length} onClick={onAutoTranslate}>
          Fill missing with Claude
        </button>
      </div>
    </div>
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
