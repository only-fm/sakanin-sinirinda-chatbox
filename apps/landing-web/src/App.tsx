import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LandingPage } from './main';
import { LoginPage } from './pages/LoginPage';
import { AdminApp } from '../../admin-web/src/main';
import { StudentApp } from '../../student-web/src/main';
import { TeacherApp } from '../../teacher-web/src/main';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute allowedRole="student" />}>
            <Route path="/ogrenci" element={<StudentApp />} />
          </Route>
          <Route element={<ProtectedRoute allowedRole="expert" />}>
            <Route path="/uzman" element={<TeacherApp />} />
          </Route>
          <Route element={<ProtectedRoute allowedRole="admin" />}>
            <Route path="/admin" element={<AdminApp />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
