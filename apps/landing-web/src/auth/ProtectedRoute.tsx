import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import type { UserRole } from './AuthContext';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ allowedRole }: { allowedRole: UserRole }) {
  const { error, loading, role, session } = useAuth();
  const location = useLocation();

  if (loading) {
    return <main className="auth-page"><p role="status">Oturum ve rol bilgisi kontrol ediliyor…</p></main>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (error) {
    return (
      <main className="auth-page">
        <section className="auth-card" role="alert">
          <h1>Rol bilgisi alınamadı</h1>
          <p>{error}</p>
          <Link to="/">Tanıtım sayfasına dön</Link>
        </section>
      </main>
    );
  }

  if (role !== allowedRole) {
    return (
      <main className="auth-page">
        <section className="auth-card" role="alert">
          <h1>Bu panele erişim izniniz yok</h1>
          <p>Bu sayfa yalnızca {allowedRole} rolündeki kullanıcılar içindir.</p>
          <Link to={role ? `/${role}` : '/'}>Kendi panelinize dönün</Link>
        </section>
      </main>
    );
  }

  return <Outlet />;
}
