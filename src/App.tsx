import * as React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import MeetingPage from './pages/MeetingPage';
import MeetingRunPage from './pages/MeetingRunPage';
import MeetingReport from './pages/MeetingReport';
import { Toaster } from '@/components/ui/sonner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  console.log('PrivateRoute - Loading:', loading, 'User:', user?.email);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    console.log('PrivateRoute - No user, redirecting to /auth');
    return <Navigate to="/auth" />;
  }

  console.log('PrivateRoute - User authenticated, rendering children');
  return <>{children}</>;
}

import AppLayout from './components/AppLayout';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/meeting/:id"
            element={
              <PrivateRoute>
                <AppLayout>
                  <MeetingPage />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/meeting/:id/run"
            element={
              <PrivateRoute>
                <MeetingRunPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/meeting/:id/report"
            element={
              <PrivateRoute>
                <AppLayout>
                  <MeetingReport />
                </AppLayout>
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </Router>
  );
}
