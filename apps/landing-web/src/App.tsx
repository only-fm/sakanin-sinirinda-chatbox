import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LandingPage } from './main';
import { LoginPage } from './pages/LoginPage';
import { RoleDashboard } from './pages/RoleDashboard';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute allowedRole="student" />}>
            <Route path="/student" element={<RoleDashboard role="student" />} />
          </Route>
          <Route element={<ProtectedRoute allowedRole="expert" />}>
            <Route path="/expert" element={<RoleDashboard role="expert" />} />
          </Route>
          <Route element={<ProtectedRoute allowedRole="admin" />}>
            <Route path="/admin" element={<RoleDashboard role="admin" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
