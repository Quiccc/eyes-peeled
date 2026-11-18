import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router';

import { checkToken, token } from './api';
import { message } from './hooks';
import { Login } from './pages/Login';
import { Moderation } from './pages/Moderation';
import { Schedule } from './pages/Schedule';
import { Stats } from './pages/Stats';
import { Words } from './pages/Words';

const PAGES = [
  { path: '/schedule', label: 'Schedule' },
  { path: '/words', label: 'Words' },
  { path: '/moderation', label: 'Moderation' },
  { path: '/stats', label: 'Stats' },
];

export function App() {
  const [state, setState] = useState<'checking' | 'in' | 'out'>(token.get() ? 'checking' : 'out');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (state !== 'checking') return;
    checkToken()
      .then((ok) => {
        if (!ok) token.clear();
        setState(ok ? 'in' : 'out');
      })
      .catch((e) => {
        setError(message(e));
        setState('out');
      });
  }, [state]);

  if (state === 'checking') return <p className="center muted">Checking…</p>;
  if (state === 'out') {
    return (
      <Login
        initialError={error}
        onSignedIn={() => {
          setError(null);
          setState('in');
          navigate('/schedule');
        }}
      />
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <strong className="brand">Eyes Peeled Admin</strong>
        <nav>
          {PAGES.map((p) => (
            <NavLink key={p.path} to={p.path}>
              {p.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="link"
          onClick={() => {
            token.clear();
            setState('out');
          }}
        >
          Sign out
        </button>
      </header>
      <main>
        <Routes>
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/words" element={<Words />} />
          <Route path="/moderation" element={<Moderation />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<Navigate to="/schedule" replace />} />
        </Routes>
      </main>
    </div>
  );
}
