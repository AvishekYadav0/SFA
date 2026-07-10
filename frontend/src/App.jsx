import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { Spinner } from './components/common/Spinner';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminRegister from './pages/AdminRegister';
import Dashboard from './pages/Dashboard';
import StaffDashboard from './pages/StaffDashboard';
import Salespersons from './pages/Salespersons';
import Dealers from './pages/Dealers';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Lifting from './pages/Lifting';
import Collections from './pages/Collections';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

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

  return (
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
