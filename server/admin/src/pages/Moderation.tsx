import { useState } from 'react';

import { api } from '../api';
import { message, useLoad } from '../hooks';
import type { Report } from '../types';

export function Moderation() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const reports = useLoad(() => api.get<Report[]>(`/admin/reports?status=${status}`), [status]);
  const [error, setError] = useState<string | null>(null);

  async function act(confirmText: string | null, run: () => Promise<unknown>) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    try {
      await run();
    } catch (e) {
      setError(message(e));
    }
    await reports.reload();
  }

  return (
    <section>
      <div className="toolbar">
        <h2>Moderation</h2>
        <div className="tabs">
          {(['open', 'resolved'] as const).map((s) => (
            <button key={s} className={s === status ? 'active' : ''} onClick={() => setStatus(s)}>
              {s === 'open' ? 'Open' : 'Resolved'}
            </button>
          ))}
        </div>
      </div>
      <p className="muted">Apple expects reports to be handled within 24 hours.</p>
      {(error || reports.error) && <p className="error">{error ?? reports.error}</p>}
      {reports.data?.length === 0 && <p className="muted">No {status} reports.</p>}

      <div className="cards">
        {reports.data?.map((r) => {
          const user = r.target;
          const sub = r.submission;
          return (
            <article key={r.id} className="card report">
              {sub && sub.status !== 'removed' && sub.imageUrl ? (
                <a href={sub.imageUrl} target="_blank" rel="noreferrer">
                  <img src={sub.imageUrl} alt="Reported photo" loading="lazy" />
                </a>
              ) : (
                <div className="no-photo muted">{!sub ? 'No photo (user report)' : sub.status === 'removed' ? 'Photo removed' : 'Duplicate photo (not stored)'}</div>
              )}
              <div className="report-body">
                <p>
                  <span className={`pill ${r.reason === 'inappropriate' ? 'bad' : ''}`}>{r.reason}</span>{' '}
                  <span className="muted">{new Date(r.createdAt).toLocaleString()}</span>
                </p>
                <p className="report-user">
                  {user?.avatarUrl && (
                    <a href={user.avatarUrl} target="_blank" rel="noreferrer">
                      <img className="report-avatar" src={user.avatarUrl} alt="Profile picture" loading="lazy" />
                    </a>
                  )}
                  {user ? (
                    <span>
                      <strong>{user.username ?? 'no username'}</strong>{' '}
                      {user.bannedAt && <span className="pill bad">banned</span>}
                      <br />
                      <code className="muted">{user.id}</code>
                    </span>
                  ) : (
                    <span className="muted">User deleted</span>
                  )}
                </p>
                <div className="actions">
                  {r.status === 'open' && (
                    <button onClick={() => act(null, () => api.post(`/admin/reports/${r.id}/resolve`))}>Resolve</button>
                  )}
                  {sub && sub.status !== 'removed' && (
                    <button
                      className="danger"
                      onClick={() =>
                        act('Remove this photo? Its points leave the leaderboard and the file is deleted.', () =>
                          api.post(`/admin/submissions/${sub.id}/remove`),
                        )
                      }
                    >
                      Remove photo
                    </button>
                  )}
                  {user?.avatarUrl && (
                    <button
                      className="danger"
                      onClick={() =>
                        act(`Remove ${user.username ?? 'this user'}'s profile picture? The file is deleted.`, () =>
                          api.post(`/admin/users/${user.id}/remove-avatar`),
                        )
                      }
                    >
                      Remove picture
                    </button>
                  )}
                  {user &&
                    (user.bannedAt ? (
                      <button onClick={() => act(`Unban ${user.username ?? 'this user'}?`, () => api.post(`/admin/users/${user.id}/unban`))}>
                        Unban
                      </button>
                    ) : (
                      <button
                        className="danger"
                        onClick={() =>
                          act(`Ban ${user.username ?? 'this user'}? They're signed out and hidden everywhere.`, () =>
                            api.post(`/admin/users/${user.id}/ban`),
                          )
                        }
                      >
                        Ban user
                      </button>
                    ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
