import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { StudentEmailOnboarding } from './auth/StudentEmailOnboarding';
import { LandingPage } from './main';
import { LoginPage } from './pages/LoginPage';
import { AdminApp } from '../../admin-web/src/main';
import { StudentApp } from '../../student-web/src/main';
import { TeacherApp } from '../../teacher-web/src/main';

function LegacyPanelRedirect({ to }: { to: string }) {
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: to, search: location.search, hash: location.hash }}
      replace
    />
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudentEmailOnboarding />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute allowedRole="student" />}>
            <Route path="/student" element={<StudentApp />} />
          </Route>
          <Route element={<ProtectedRoute allowedRole="expert" />}>
            <Route path="/expert" element={<TeacherApp />} />
          </Route>
          <Route element={<ProtectedRoute allowedRole="admin" />}>
            <Route path="/admin" element={<AdminApp />} />
          </Route>
          <Route path="/ogrenci" element={<LegacyPanelRedirect to="/student" />} />
          <Route path="/uzman" element={<LegacyPanelRedirect to="/expert" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
