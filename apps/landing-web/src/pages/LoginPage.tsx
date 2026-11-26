import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabaseConfigError } from '../supabaseClient';

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

type LoginLocationState = {
  from?: {
    pathname?: string;
  };
};

function rolePath(role: 'student' | 'expert' | 'admin'): string {
  return role === 'student' ? '/student' : role === 'expert' ? '/expert' : '/admin';
}

export function LoginPage() {
  const { error: sessionError, loading, profile, role, session, saveStudentEmail, signIn, signOut } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [savingStudentEmail, setSavingStudentEmail] = useState(false);
  const [studentEmailError, setStudentEmailError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const destination = (location.state as LoginLocationState | null)?.from?.pathname;
  const needsStudentEmail = profile?.role === 'student' && !profile.email?.trim();

  useEffect(() => {
    if (profile?.role === 'student' && profile.email) {
      setStudentEmail(profile.email);
    }
  }, [profile?.email, profile?.role]);

  if (!loading && role && !needsStudentEmail) {
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
      if (signedInProfile.role === 'student' && !signedInProfile.email?.trim()) {
        setStudentEmail('');
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

  async function handleStudentEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingStudentEmail(true);
    setStudentEmailError(null);
    try {
      await saveStudentEmail(studentEmail);
      navigate('/student', { replace: true });
    } catch (saveError) {
      setStudentEmailError(saveError instanceof Error ? saveError.message : 'E-posta kaydedilemedi.');
    } finally {
      setSavingStudentEmail(false);
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
          Kullanıcı adın ve parolanla giriş yap.
        </p>
        <Link className="auth-back-link" to="/">Tanıtım sayfasına dön</Link>
        {supabaseConfigError && <p className="auth-error" role="alert">{supabaseConfigError}</p>}
        {sessionError && <p className="auth-error" role="alert">{sessionError}</p>}
        {formError && <p className="auth-error" role="alert">{formError}</p>}
        {!turnstileSiteKey && (
          <p className="auth-error" role="alert">
            Turnstile yapılandırılmamış. VITE_TURNSTILE_SITE_KEY değerini ayarlayın.
          </p>
        )}
        {captchaError && <p className="auth-error" role="alert">{captchaError}</p>}
        {session && !role && (
          <button className="auth-signout-button" disabled={signingOut} onClick={handleSignOut} type="button">
            {signingOut ? 'Oturum kapatılıyor…' : 'Oturumu Kapat'}
          </button>
        )}
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="identifier">Kullanıcı adı</label>
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
      {needsStudentEmail && (
        <div className="onboarding-backdrop">
          <section
            aria-labelledby="student-email-title"
            aria-modal="true"
            className="onboarding-modal"
            role="dialog"
          >
            <h2 id="student-email-title">E-posta adresini ekle</h2>
            <p>Öğrenci hesabını tamamlamak için e-posta adresini paylaş.</p>
            {studentEmailError && <p className="auth-error" role="alert">{studentEmailError}</p>}
            <form className="auth-form" onSubmit={(event) => void handleStudentEmailSubmit(event)}>
              <label htmlFor="student-email">E-posta</label>
              <input
                autoComplete="email"
                id="student-email"
                maxLength={254}
                onChange={(event) => setStudentEmail(event.target.value)}
                required
                type="email"
                value={studentEmail}
              />
              <button className="primary-button" disabled={savingStudentEmail} type="submit">
                {savingStudentEmail ? 'Kaydediliyor…' : 'Kaydet ve devam et'}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
