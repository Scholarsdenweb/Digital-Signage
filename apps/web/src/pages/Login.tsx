import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import { useToast } from '../store/toast.js';

export function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('admin@display.local');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    nav('/', { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      nav('/', { replace: true });
    } catch (err: any) {
      toast.push(err.message ?? 'Login failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <form className="card" style={{ width: 360 }} onSubmit={submit}>
        <div style={{ color: 'var(--primary)', fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>◧ SIGNAGE</div>
        <h2 style={{ marginTop: 0 }}>Sign in</h2>
        <label className="muted" style={{ fontSize: 13 }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 12 }} />
        <label className="muted" style={{ fontSize: 13 }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 16 }} />
        <button className="primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
