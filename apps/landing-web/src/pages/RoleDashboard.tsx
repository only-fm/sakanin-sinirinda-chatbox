import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { UserRole } from '../auth/AuthContext';
import { useAuth } from '../auth/AuthContext';

const dashboardDetails: Record<UserRole, { title: string; description: string }> = {
  student: {
    title: 'Öğrenci Paneli',
    description: 'Senaryoları keşfedin, düşüncelerinizi değerlendirin ve uzmana güvenle soru sorun.',
  },
  expert: {
    title: 'Uzman Paneli',
    description: 'Öğrenci sorularını yanıtlayın ve eğitim içeriklerini takip edin.',
  },
  admin: {
    title: 'Admin Paneli',
    description: 'Platform kullanıcılarını ve içeriklerini yönetin.',
  },
};

export function RoleDashboard({ role }: { role: UserRole }) {
  const { session, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const details = dashboardDetails[role];

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Oturum kapatılamadı.');
      setSigningOut(false);
    }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/" className="dashboard-brand">Şakanın Sınırında</Link>
        <button disabled={signingOut} onClick={handleSignOut} type="button">
          {signingOut ? 'Çıkış yapılıyor…' : 'Oturumu Kapat'}
        </button>
      </header>
      <section className="dashboard-content">
        <span className="dashboard-role">{role}</span>
        <h1>{details.title}</h1>
        <p>{details.description}</p>
        <div className="dashboard-card">
          <h2>Hoş geldiniz</h2>
          <p>{session?.user.email}</p>
          <p>Bu alan {role} rolüne özel olarak korunmaktadır.</p>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
