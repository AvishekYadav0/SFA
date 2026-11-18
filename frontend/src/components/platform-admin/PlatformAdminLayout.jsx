import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, Building2, CreditCard, FileText, LogOut, Bell, ShieldCheck, LayoutDashboard, Users, SlidersHorizontal, BriefcaseBusiness, Settings, Infinity, Menu, X } from 'lucide-react';

const navItems = [
  { to: '/platform-admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/platform-admin/companies', label: 'Companies', icon: Building2 },
  { to: '/platform-admin/plans', label: 'Subscription Plans', icon: SlidersHorizontal },
  { to: '/platform-admin/subscriptions', label: 'Subscriptions', icon: Infinity },
  { to: '/platform-admin/users', label: 'User Management', icon: Users },
  { to: '/platform-admin/features', label: 'Feature Management', icon: ShieldCheck },
  { to: '/platform-admin/payments', label: 'Payments & Billing', icon: CreditCard },
  { to: '/platform-admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { to: '/platform-admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/platform-admin/audit-logs', label: 'Audit Logs', icon: FileText },
  { to: '/platform-admin/settings', label: 'Platform Settings', icon: Settings },
  { to: '/platform-admin/login', label: 'Logout', icon: LogOut, action: 'logout' },
];

export default function PlatformAdminLayout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    localStorage.removeItem('platformAdminToken');
    window.location.href = '/platform-admin/login';
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">SFA</p>
              <h1 className="text-lg font-bold text-slate-900">Platform Admin</h1>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-5">
          <div className="rounded-2xl bg-slate-50 p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-sm font-semibold text-blue-700">PA</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">Platform Administrator</p>
                <p className="truncate text-xs text-slate-500">admin@sfa.platform</p>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-700">
              Platform Admin
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navItems.map(({ to, label, icon: Icon, action }) => {
            const isActive = to === '/platform-admin/login' ? false : location.pathname.startsWith(to);
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (action === 'logout') handleLogout();
                  else if (to) {
                    setMobileMenuOpen(false);
                    window.location.href = to;
                  }
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SaaS Platform</p>
                <h2 className="truncate text-lg font-bold text-slate-900 sm:text-xl">Master Admin Console</h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 md:block">
                Active Tenant: All Companies
              </div>
              <button onClick={handleLogout} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Logout</button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
