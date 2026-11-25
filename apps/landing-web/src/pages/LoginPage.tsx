import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabaseConfigError } from '../supabaseClient';

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

export function LoginPage() {
  const { error: sessionError, loading, role, session, signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const destination = (location.state as LoginLocationState | null)?.from?.pathname;

  if (!loading && role) {
    return <Navigate to={destination || `/${role}`} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const signedInRole = await signIn(email, password);
      navigate(destination || `/${signedInRole}`, { replace: true });
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Giriş başarısız oldu.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    setFormError(null);
    try {
      await signOut();
    } catch (signOutError) {
      setFormError(signOutError instanceof Error ? signOutError.message : 'Oturum kapatılamadı.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-back-link" to="/">← Tanıtım sayfası</Link>
        <h1>Oturum Aç</h1>
        <p>Hesabınızla giriş yapın; rolünüze uygun panele yönlendirileceksiniz.</p>
        {supabaseConfigError && <p className="auth-error" role="alert">{supabaseConfigError}</p>}
        {sessionError && <p className="auth-error" role="alert">{sessionError}</p>}
        {formError && <p className="auth-error" role="alert">{formError}</p>}
        {session && !role && (
          <button className="auth-signout-button" disabled={signingOut} onClick={handleSignOut} type="button">
            {signingOut ? 'Oturum kapatılıyor…' : 'Oturumu Kapat'}
          </button>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">E-posta</label>
          <input
            autoComplete="email"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <label htmlFor="password">Şifre</label>
          <input
            autoComplete="current-password"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <button disabled={submitting || loading || Boolean(supabaseConfigError)} type="submit">
            {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>
      </section>
    </main>
  );
}
