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

function rolePath(role: 'student' | 'expert' | 'admin'): string {
  return role === 'student' ? '/ogrenci' : role === 'expert' ? '/uzman' : '/admin';
}

export function LoginPage() {
  const { error: sessionError, loading, role, session, signIn, signOut } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const destination = (location.state as LoginLocationState | null)?.from?.pathname;

  if (!loading && role) {
    return <Navigate to={destination || rolePath(role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const signedInRole = await signIn(identifier, password);
      navigate(destination || rolePath(signedInRole), { replace: true });
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
    <main className="login-screen auth-login-screen">
      <div className="ambient-background" aria-hidden="true">
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
      </div>
      <section className="login-aside" aria-label="Şakanın Sınırında hakkında">
        <div className="brand-mark-wrapper">
          <img className="brand-mark" src="/icon.png" alt="" aria-hidden="true" />
        </div>
        <p className="aside-kicker">Birlikte düşünmek için güvenli ve keyifli bir alan</p>
        <h1>Şaka nerede biter, incitmek nerede başlar?</h1>
        <p>
          Farklı bakış açılarına yer aç. Kendi düşünceni keşfet; yanıtların doğru ya da
          yanlış diye değerlendirilmez.
        </p>
      </section>
      <section className="login-content">
        <p className="eyebrow">Şakanın Sınırında · Ortak giriş</p>
        <h2>Tekrar hoş geldin!</h2>
        <p className="intro">
          Kullanıcı adın veya e-posta adresin ve parolanla giriş yap.
        </p>
        <Link className="auth-back-link" to="/">Tanıtım sayfasına dön</Link>
        {supabaseConfigError && <p className="auth-error" role="alert">{supabaseConfigError}</p>}
        {sessionError && <p className="auth-error" role="alert">{sessionError}</p>}
        {formError && <p className="auth-error" role="alert">{formError}</p>}
        {session && !role && (
          <button className="auth-signout-button" disabled={signingOut} onClick={handleSignOut} type="button">
            {signingOut ? 'Oturum kapatılıyor…' : 'Oturumu Kapat'}
          </button>
        )}
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="identifier">Kullanıcı adı veya e-posta</label>
          <input
            autoComplete="username"
            id="identifier"
            onChange={(event) => setIdentifier(event.target.value)}
            required
            type="text"
            value={identifier}
          />
          <label htmlFor="password">Parola</label>
          <input
            autoComplete="current-password"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <button className="primary-button" disabled={submitting || loading || Boolean(supabaseConfigError)} type="submit">
            {submitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
      </section>
    </main>
  );
}
