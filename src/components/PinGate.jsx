/**
 * src/components/PinGate.jsx
 * Passphrase gate with SHA-256 — password never in source code
 */

import { useState } from 'react';

// SHA-256 hash of the gate passphrase. Placeholder below is the hash of "changeme".
// Set your own: run `await hashPass('YourNewPassword')` in the browser console and
// paste the result here. This is only a soft client-side gate — real data access is
// protected by Supabase RLS + the Edge Function token.
const EXPECTED_HASH = '057ba03d6c44104863dc7361fe4578965d1887360f90a0895882e58a6248fc86';

async function hashPass(pass) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(pass)
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const STORAGE_KEY = 'dd_auth';

export default function PinGate({ children }) {
  const [unlocked, setUnlocked] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'ok'
  );
  const [pass, setPass] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);

  if (unlocked) return children;

  async function handleSubmit(e) {
    e.preventDefault();
    if (attempts >= 5) return; // lockout

    const hash = await hashPass(pass);
    if (hash === EXPECTED_HASH) {
      localStorage.setItem(STORAGE_KEY, 'ok');
      setUnlocked(true);
    } else {
      setAttempts(a => a + 1);
      setError(true);
      setPass('');
      setTimeout(() => setError(false), 2000);
    }
  }

  return (
    <div className="dd-app" style={{ justifyContent: 'center', alignItems: 'center', gap: 24 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>DutchDeck</div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="password"
          className="dd-input-bar__input"
          style={{ width: 200, textAlign: 'center', fontSize: 16 }}
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoFocus
          disabled={attempts >= 5}
        />
        <button className="dd-input-bar__send" type="submit" disabled={attempts >= 5}>→</button>
      </form>
      {error && (
        <div style={{ color: 'var(--dd-red)', fontSize: 13 }}>
          Wrong password ({5 - attempts} attempts left)
        </div>
      )}
      {attempts >= 5 && (
        <div style={{ color: 'var(--dd-red)', fontSize: 13 }}>
          Too many attempts. Refresh the page.
        </div>
      )}
    </div>
  );
}
