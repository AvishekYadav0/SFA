import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { Spinner } from './components/common/Spinner';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const AdminRegister = lazy(() => import('./pages/AdminRegister'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const Sales = lazy(() => import('./pages/Sales'));
const Salespersons = lazy(() => import('./pages/Salespersons'));
const Dealers = lazy(() => import('./pages/Dealers'));
const Products = lazy(() => import('./pages/Products'));
const Orders = lazy(() => import('./pages/Orders'));
const Lifting = lazy(() => import('./pages/Lifting'));
const Collections = lazy(() => import('./pages/Collections'));
const Reports = lazy(() => import('./pages/Reports'));
const Profile = lazy(() => import('./pages/Profile'));
const DailyVisits = lazy(() => import('./pages/DailyVisits'));
const Pipeline    = lazy(() => import('./pages/Pipeline'));
const Settings    = lazy(() => import('./pages/Settings'));


// Admin-only Route
const AdminRoute = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return user.role === 'admin'
    ? children
    : <Navigate to="/dashboard" replace />;
};

// Logged-in Route
const PrivateRoute = ({ children }) => {
  const { user } = useAuth();

  return user
    ? children
    : <Navigate to="/login" replace />;
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <Spinner size="lg" />
        </div>
      }
    >
      <Routes>

        {/* Public Routes */}
        <Route
          path="/"
          element={
            user
              ? <Navigate to="/dashboard" replace />
              : <Landing />
          }
        />

        <Route
          path="/login"
          element={
            user
              ? <Navigate to="/dashboard" replace />
              : <Login />
          }
        />

        <Route
          path="/admin-register"
          element={
            user
              ? <Navigate to="/dashboard" replace />
              : <AdminRegister />
          }
        />

        <Route
          path="/admin-signup"
          element={<Navigate to="/admin-register" replace />}
        />

        {/* Protected Routes */}
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={
              user?.role === 'admin'
                ? <Dashboard />
                : <StaffDashboard />
            }
          />

          {/* Staff + Admin */}
          <Route path="/daily-visits" element={<DailyVisits />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/pipeline" element={<AdminRoute><Pipeline /></AdminRoute>} />
          <Route path="/lifting" element={<Lifting />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/profile" element={<Profile />} />

          {/* Admin Only */}
          <Route
            path="/salespersons"
            element={
              <AdminRoute>
                <Salespersons />
              </AdminRoute>
            }
          />

          <Route
            path="/dealers"
            element={
              <AdminRoute>
                <Dealers />
              </AdminRoute>
            }
          />

          <Route
            path="/products"
            element={
              <AdminRoute>
                <Products />
              </AdminRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <AdminRoute>
                <Reports />
              </AdminRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <AdminRoute>
                <Settings />
              </AdminRoute>
            }
          />

          <Route
            path="*"
            element={<Navigate to="/dashboard" replace />}
          />
        </Route>

        {/* Global Fallback */}
        <Route
          path="*"
          element={
            <Navigate
              to={user ? "/dashboard" : "/"}
              replace
            />
          }
        />

      </Routes>
    </Suspense>
  );
};

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
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
              success: {
                iconTheme: {
                  primary: '#22C55E',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}