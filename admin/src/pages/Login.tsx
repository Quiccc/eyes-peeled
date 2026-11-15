import { useState, type FormEvent } from 'react';

import { checkToken, token } from '../api';
import { message } from '../hooks';

export function Login({ onSignedIn, initialError }: { onSignedIn: () => void; initialError: string | null }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    token.set(value.trim());
    try {
      if (await checkToken()) {
        onSignedIn();
      } else {
        token.clear();
        setError("That token didn't work. It must match ADMIN_TOKEN in server/.env.");
      }
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login card" onSubmit={submit}>
      <h1>Word Hunt Admin</h1>
      <label>
        Admin token
        <input type="password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy || !value.trim()}>
        {busy ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  );
}
