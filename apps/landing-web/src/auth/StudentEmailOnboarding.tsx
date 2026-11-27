import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function StudentEmailOnboarding() {
  const { completeStudentEmailOnboarding, loading, profile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRequired = !loading
    && profile?.role === 'student'
    && (profile.isFirstLogin || !profile.emailVerified);

  useEffect(() => {
    if (isRequired) {
      setEmail(profile?.realEmail ?? '');
      setError(null);
    }
  }, [isRequired, profile?.realEmail]);

  if (!isRequired) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await completeStudentEmailOnboarding(email);
      navigate('/student', { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'E-posta kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-backdrop">
      <section
        aria-describedby="student-email-description"
        aria-labelledby="student-email-title"
        aria-modal="true"
        className="onboarding-modal"
        role="dialog"
      >
        <h2 id="student-email-title">E-posta adresini ekle</h2>
        <p id="student-email-description">
          Devam etmek için kullanabileceğin gerçek e-posta adresini paylaş.
        </p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="student-email">E-posta</label>
          <input
            autoComplete="email"
            autoFocus
            id="student-email"
            maxLength={254}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Kaydediliyor…' : 'Kaydet ve devam et'}
          </button>
        </form>
      </section>
    </div>
  );
}
