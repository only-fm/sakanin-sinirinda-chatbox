import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { AuthRole } from '../auth/AuthContext';
import { supabaseConfigError } from '../supabaseClient';

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

function rolePath(role: AuthRole): string {
  return role === 'student' ? '/student' : role === 'expert' ? '/expert' : role === 'admin' ? '/admin' : '/';
}

export function LoginPage() {
  const { error: sessionError, loading, profile, profileError, role, session, signIn, signOut } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const destination = (location.state as LoginLocationState | null)?.from?.pathname;
  const needsStudentOnboarding = profile?.role === 'student'
    && (profile.isFirstLogin || !profile.emailVerified);

  if (!loading && role && role !== 'user' && !needsStudentOnboarding) {
    return <Navigate to={destination || rolePath(role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captchaToken) {
      setFormError('Devam etmek için Turnstile doğrulamasını tamamlayın.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const signedInProfile = await signIn(identifier, password, captchaToken);
      if (signedInProfile.role === 'user') {
        setFormError('Hesabınız doğrulandı ancak profil veya rol kaydı bulunamadı. Lütfen yöneticinizle iletişime geçin.');
        return;
      }
      if (signedInProfile.role === 'student'
        && (signedInProfile.isFirstLogin || !signedInProfile.emailVerified)) {
        return;
      }
      navigate(destination || rolePath(signedInProfile.role), { replace: true });
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Giriş başarısız oldu.');
    } finally {
      setSubmitting(false);
      setCaptchaToken(null);
      turnstileRef.current?.reset();
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
        <p className="intro">Kullanıcı adın veya e-posta adresin ve parolanla giriş yap.</p>
        <Link className="auth-back-link" to="/">Tanıtım sayfasına dön</Link>
        {supabaseConfigError && <p className="auth-error" role="alert">{supabaseConfigError}</p>}
        {sessionError && <p className="auth-error" role="alert">{sessionError}</p>}
        {session && role === 'user' && (
          <p className="auth-error" role="alert">
            Profil veya rol kaydı bulunamadı. Bu oturum korumalı panellere erişemez; yöneticinizle iletişime geçin.
          </p>
        )}
        {session && role === 'user' && profileError && (
          <p className="auth-error" role="alert">
            Supabase error.message: {profileError.message}; error.code: {profileError.code ?? 'bilinmiyor'}
          </p>
        )}
        {formError && <p className="auth-error" role="alert">{formError}</p>}
        {!turnstileSiteKey && (
          <p className="auth-error" role="alert">
            Turnstile yapılandırılmamış. VITE_TURNSTILE_SITE_KEY değerini ayarlayın.
          </p>
        )}
        {captchaError && <p className="auth-error" role="alert">{captchaError}</p>}
        {session && (!role || role === 'user') && (
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
          {turnstileSiteKey && (
            <Turnstile
              ref={turnstileRef}
              className="turnstile-widget"
              siteKey={turnstileSiteKey}
              onSuccess={(token) => {
                setCaptchaToken(token);
                setCaptchaError(null);
              }}
              onExpire={() => {
                setCaptchaToken(null);
                setCaptchaError('Turnstile doğrulamasının süresi doldu. Lütfen yeniden doğrulayın.');
              }}
              onError={() => {
                setCaptchaToken(null);
                setCaptchaError('Turnstile yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.');
              }}
            />
          )}
          <button
            className="primary-button"
            disabled={submitting || loading || !captchaToken || !turnstileSiteKey || Boolean(supabaseConfigError)}
            type="submit"
          >
            {submitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
      </section>
    </main>
  );
}
