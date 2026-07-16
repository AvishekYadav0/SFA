import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { Spinner } from './components/common/Spinner';

const Landing       = lazy(() => import('./pages/Landing'));
const Login         = lazy(() => import('./pages/Login'));
const AdminRegister = lazy(() => import('./pages/AdminRegister'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const StaffDashboard= lazy(() => import('./pages/StaffDashboard'));
const Salespersons  = lazy(() => import('./pages/Salespersons'));
const Dealers       = lazy(() => import('./pages/Dealers'));
const Products      = lazy(() => import('./pages/Products'));
const Orders        = lazy(() => import('./pages/Orders'));
const Lifting       = lazy(() => import('./pages/Lifting'));
const Collections   = lazy(() => import('./pages/Collections'));
const Reports       = lazy(() => import('./pages/Reports'));
const Profile       = lazy(() => import('./pages/Profile'));
const Settings      = lazy(() => import('./pages/Settings'));

// Admin-only route guard
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'admin' ? children : <Navigate to="/dashboard" replace />;
};

// Protected route — any logged-in user
const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }

  const fallback = (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <Spinner size="lg" />
    </div>
  );

  return (
    <Suspense fallback={fallback}>
    <Routes>
      {/* ── Public routes ── */}
      <Route path="/"
        element={user ? <Navigate to="/dashboard" replace /> : <Landing />}
      />
      {/* allow /admin-register even if admin exists — page handles the block */}
      <Route path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route path="/admin-register"
        element={user ? <Navigate to="/dashboard" replace /> : <AdminRegister />}
      />
      <Route path="/admin-signup"
        element={<Navigate to="/admin-register" replace />}
      />

      {/* ── Protected routes inside layout ── */}
      <Route element={
        <PrivateRoute><AppLayout /></PrivateRoute>
      }>
        {/* Dashboard — role-split */}
        <Route path="/dashboard"
          element={user?.role === 'admin' ? <Dashboard /> : <StaffDashboard />}
        />

        {/* Staff + Admin */}
        <Route path="/orders"      element={<Orders />} />
        <Route path="/lifting"     element={<Lifting />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/profile"     element={<Profile />} />

        {/* Admin only */}
        <Route path="/salespersons" element={<AdminRoute><Salespersons /></AdminRoute>} />
        <Route path="/dealers"      element={<AdminRoute><Dealers /></AdminRoute>} />
        <Route path="/products"     element={<AdminRoute><Products /></AdminRoute>} />
        <Route path="/reports"      element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="/settings"     element={<AdminRoute><Settings /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*"
        element={<Navigate to={user ? '/dashboard' : '/'} replace />}
      />
    </Routes>
    </Suspense>
  );
};

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                borderRadius: '12px',
                background: '#1e293b',
                color: '#f8fafc',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
