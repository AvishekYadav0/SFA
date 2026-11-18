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
const CompanyRegister = lazy(() => import('./pages/CompanyRegister'));
const CompanyVerification = lazy(() => import('./pages/CompanyVerification'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Users         = lazy(() => import('./pages/Users'));
const Dealers       = lazy(() => import('./pages/Dealers'));
const Products      = lazy(() => import('./pages/Products'));
const Orders        = lazy(() => import('./pages/Orders'));
const Collections   = lazy(() => import('./pages/Collections'));
const CollectionPlans = lazy(() => import('./pages/CollectionPlans'));
const MonthlyPlanning = lazy(() => import('./pages/MonthlyPlanning'));
const Targets       = lazy(() => import('./pages/Targets'));
const Visits        = lazy(() => import('./pages/Visits'));
const Reports       = lazy(() => import('./pages/Reports'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile       = lazy(() => import('./pages/Profile'));
const Settings      = lazy(() => import('./pages/Settings'));
const Lifting       = lazy(() => import('./pages/Lifting'));
const Pipeline      = lazy(() => import('./pages/Pipeline'));
const Sales         = lazy(() => import('./pages/Sales'));
const StockStatus   = lazy(() => import('./pages/StockStatus'));
const DealerPortal  = lazy(() => import('./pages/DealerPortal'));
const DealerDetail  = lazy(() => import('./pages/DealerDetail'));
const DatabaseBackup = lazy(() => import('./pages/DatabaseBackup'));
const PlatformAdminLogin = lazy(() => import('./pages/PlatformAdminLogin'));
const PlatformAdminDashboard = lazy(() => import('./pages/PlatformAdminDashboard'));
const PlatformAdminCompanies = lazy(() => import('./pages/PlatformAdminCompanies'));
const PlatformAdminCompanyDetails = lazy(() => import('./pages/PlatformAdminCompanyDetails'));
const PlatformAdminPlans = lazy(() => import('./pages/PlatformAdminPlans'));
const PlatformAdminSubscriptions = lazy(() => import('./pages/PlatformAdminSubscriptions'));
const PlatformAdminUsers = lazy(() => import('./pages/PlatformAdminUsers'));
const PlatformAdminFeatures = lazy(() => import('./pages/PlatformAdminFeatures'));
const PlatformAdminPayments = lazy(() => import('./pages/PlatformAdminPayments'));
const PlatformAdminReports = lazy(() => import('./pages/PlatformAdminReports'));
const PlatformAdminNotifications = lazy(() => import('./pages/PlatformAdminNotifications'));
const PlatformAdminAuditLogs = lazy(() => import('./pages/PlatformAdminAuditLogs'));
const PlatformAdminSettings = lazy(() => import('./pages/PlatformAdminSettings'));
const PlatformAdminLayout = lazy(() => import('./components/platform-admin/PlatformAdminLayout'));

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

const PlatformAdminRoute = ({ children }) => {
  const hasPlatformToken = Boolean(localStorage.getItem('platformAdminToken'));
  return hasPlatformToken ? children : <Navigate to="/platform-admin/login" replace />;
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
        <Route path="/company-register" element={user ? <Navigate to="/dashboard" replace /> : <CompanyRegister />} />
        <Route path="/company-verification" element={user ? <Navigate to="/dashboard" replace /> : <CompanyVerification />} />
        <Route path="/platform-admin/login" element={localStorage.getItem('platformAdminToken') ? <Navigate to="/platform-admin/dashboard" replace /> : <PlatformAdminLogin />} />

        <Route element={<PlatformAdminRoute><PlatformAdminLayout /></PlatformAdminRoute>}>
          <Route path="/platform-admin/dashboard" element={<PlatformAdminDashboard />} />
          <Route path="/platform-admin/companies" element={<PlatformAdminCompanies />} />
          <Route path="/platform-admin/companies/:companyId" element={<PlatformAdminCompanyDetails />} />
          <Route path="/platform-admin/plans" element={<PlatformAdminPlans />} />
          <Route path="/platform-admin/subscriptions" element={<PlatformAdminSubscriptions />} />
          <Route path="/platform-admin/users" element={<PlatformAdminUsers />} />
          <Route path="/platform-admin/features" element={<PlatformAdminFeatures />} />
          <Route path="/platform-admin/payments" element={<PlatformAdminPayments />} />
          <Route path="/platform-admin/reports" element={<PlatformAdminReports />} />
          <Route path="/platform-admin/notifications" element={<PlatformAdminNotifications />} />
          <Route path="/platform-admin/audit-logs" element={<PlatformAdminAuditLogs />} />
          <Route path="/platform-admin/settings" element={<PlatformAdminSettings />} />
        </Route>

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
          <Route path="/stock-status"  element={<RoleRoute roles={['nsm','rsm','asm','se','so','dealer','admin']}><StockStatus /></RoleRoute>} />
          <Route path="/collections"  element={<Collections />} />
          <Route path="/collection-plans" element={<CollectionPlans />} />
          <Route path="/monthly-planning" element={<MonthlyPlanning />} />
          <Route path="/targets" element={<RoleRoute roles={['nsm','rsm','asm','se','admin']}><Targets /></RoleRoute>} />
          <Route path="/visits"       element={<Visits />} />
          <Route path="/reports"      element={<RoleRoute roles={['nsm','rsm','asm','se','admin']}><Reports /></RoleRoute>} />
          <Route path="/dealer-portal" element={<RoleRoute roles={['dealer']}><DealerPortal /></RoleRoute>} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile"      element={<Profile />} />
          <Route path="/settings"     element={<RoleRoute roles={['nsm','admin']}><Settings /></RoleRoute>} />
          <Route path="/admin/backups" element={<RoleRoute roles={['admin']}><DatabaseBackup /></RoleRoute>} />
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
