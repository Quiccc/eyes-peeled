import { api } from '../api';
import { pct, useLoad } from '../hooks';
import type { ModelStatus } from '../types';

export function Model() {
  const status = useLoad(() => api.get<ModelStatus>('/admin/model'), []);
  const s = status.data;
  const report = s?.report;

  return (
    <section>
      <div className="toolbar">
        <h2>Model</h2>
        <button onClick={() => status.reload()} disabled={status.loading}>
          Refresh
        </button>
      </div>
      {status.error && <p className="error">{status.error}</p>}

      {s && !s.configured && (
        <p className="notice">
          No YOLO service configured: photos are judged by the random stub. Set <code>YOLO_URL</code> in
          server/.env and start the service in <code>yolo/</code>.
        </p>
      )}
      {s?.error && <p className="error">YOLO service problem: {s.error}</p>}

      {s?.health && (
        <div className="stats-row">
          <Tile label="Status" value={s.health.ok ? 'Running' : 'Not loaded'} tone={s.health.ok ? 'ok' : 'bad'} />
          <Tile label="Model version" value={s.health.modelVersion} />
          <Tile label="Weights" value={s.health.model} />
          <Tile label="Classes" value={String(s.health.classes)} />
          <Tile label="Pass threshold" value={String(s.threshold)} />
        </div>
      )}

      {s && s.unknownWords.length > 0 && (
        <div className="error">
          <strong>Enabled words the model doesn't know:</strong> {s.unknownWords.join(', ')}. Every photo for them
          would fail. Retire them on the Words page or train the model on them.
        </div>
      )}

      <h3>Word test</h3>
      {s?.configured && !report && (
        <p className="muted">
          No report yet. Run <code>uv run python eval/evaluate.py</code> in <code>yolo/</code>.
        </p>
      )}
      {report && (
        <>
          <p className="muted">
            {report.modelVersion} · {new Date(report.createdAt).toLocaleString()} · threshold {report.minConfidence} ·
            bars: ≥ {pct(report.bars.minPass)} real photos pass, ≤ {pct(report.bars.maxFalse)} wrong photos pass
            {report.comparedWith && <> · compared with {report.comparedWith}</>}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Real photos pass</th>
                  <th>Wrong photos pass</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {report.words.map((w) => (
                  <tr key={w.word}>
                    <td>{w.word}</td>
                    <td>
                      {pct(w.passRate)} <span className="muted">({w.positivePassed}/{w.positives})</span>
                    </td>
                    <td>
                      {pct(w.falseRate)} <span className="muted">({w.negativePassed}/{w.negatives})</span>
                    </td>
                    <td>
                      {w.pass ? <span className="pill ok">PASS</span> : <span className="pill bad">FAIL</span>}{' '}
                      <span className="muted">{w.problems.join('; ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="tile card">
      <span className="muted">{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}
