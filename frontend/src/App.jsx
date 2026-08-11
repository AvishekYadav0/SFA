import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { Spinner } from './components/common/Spinner';

// Pages
const Login         = lazy(() => import('./pages/Login'));
const AdminRegister = lazy(() => import('./pages/AdminRegister'));
const Landing       = lazy(() => import('./pages/Landing'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Users         = lazy(() => import('./pages/Users'));
const Dealers       = lazy(() => import('./pages/Dealers'));
const Products      = lazy(() => import('./pages/Products'));
const Orders        = lazy(() => import('./pages/Orders'));
const Collections   = lazy(() => import('./pages/Collections'));
const CollectionPlans = lazy(() => import('./pages/CollectionPlans'));
const Visits        = lazy(() => import('./pages/Visits'));
const Reports       = lazy(() => import('./pages/Reports'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile       = lazy(() => import('./pages/Profile'));
const Settings      = lazy(() => import('./pages/Settings'));
const Lifting       = lazy(() => import('./pages/Lifting'));
const Pipeline      = lazy(() => import('./pages/Pipeline'));
const Sales         = lazy(() => import('./pages/Sales'));
const DealerPortal  = lazy(() => import('./pages/DealerPortal'));
const DealerDetail  = lazy(() => import('./pages/DealerDetail'));

// Legacy pages
const DailyVisits   = lazy(() => import('./pages/DailyVisits'));
const Claims        = lazy(() => import('./pages/Claims'));

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950">
    <Spinner size="lg" />
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  return user ? children : <Navigate to="/login" replace />;
};

const RoleRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Public */}
        <Route path="/"              element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/login"         element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/admin-register" element={user ? <Navigate to="/dashboard" replace /> : <AdminRegister />} />

        {/* Protected */}
        <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/users"        element={<RoleRoute roles={['nsm','rsm','asm','se','admin']}><Users /></RoleRoute>} />
          <Route path="/dealers"      element={<Dealers />} />
          <Route path="/dealers/:id"  element={<DealerDetail />} />
          <Route path="/products"     element={<RoleRoute roles={['nsm','asm','admin']}><Products /></RoleRoute>} />
          <Route path="/orders"       element={<Orders />} />
          <Route path="/pipeline"     element={<RoleRoute roles={['nsm','rsm','asm','admin']}><Pipeline /></RoleRoute>} />
          <Route path="/sales"        element={<Sales />} />
          <Route path="/collections"  element={<Collections />} />
          <Route path="/collection-plans" element={<CollectionPlans />} />
          <Route path="/visits"       element={<Visits />} />
          <Route path="/reports"      element={<RoleRoute roles={['nsm','rsm','asm','se','admin']}><Reports /></RoleRoute>} />
          <Route path="/dealer-portal" element={<RoleRoute roles={['dealer']}><DealerPortal /></RoleRoute>} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile"      element={<Profile />} />
          <Route path="/settings"     element={<RoleRoute roles={['nsm','admin']}><Settings /></RoleRoute>} />
          <Route path="/lifting"      element={<Lifting />} />
          <Route path="/daily-visits" element={<DailyVisits />} />
          <Route path="/claims"       element={<Claims />} />
          <Route path="*"             element={<Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
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
          <Toaster position="top-right" toastOptions={{
            style: { borderRadius: '12px', background: '#1e293b', color: '#f8fafc', fontSize: '14px' },
            success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
          }} />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
