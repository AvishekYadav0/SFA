import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Building2, RefreshCw, Users, CreditCard, Clock3 } from 'lucide-react';
import { platformAdminApi } from '../services/platformAdminApi';

const cards = [
  { label: 'Total Companies', key: 'totalCompanies', icon: Building2 },
  { label: 'Active Companies', key: 'activeCompanies', icon: Building2 },
  { label: 'Suspended Companies', key: 'suspendedCompanies', icon: Building2 },
  { label: 'Expired Subscriptions', key: 'expiredSubscriptions', icon: Clock3 },
  { label: 'Basic Plan Companies', key: 'basicPlanCompanies', icon: Building2 },
  { label: 'Pro Plan Companies', key: 'proPlanCompanies', icon: Building2 },
  { label: 'Registered Users', key: 'totalRegisteredUsers', icon: Users },
  { label: 'Active Users', key: 'activeUsers', icon: Users },
  { label: 'Expiring Soon', key: 'subscriptionsExpiringSoon', icon: Clock3 },
  { label: 'Total Revenue', key: 'totalRevenue', icon: CreditCard, currency: true },
];

export default function PlatformAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await platformAdminApi.getDashboard();
      setData(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load platform dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading platform dashboard...</div>;
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
        <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5" /><p>{error}</p></div>
        <button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium hover:bg-red-100">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentCompanies = data?.recentCompanies || [];
  const companyTotal = Number(stats.totalCompanies || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Platform</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Master Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Live subscription and company data.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, key, icon: Icon, currency }) => (
          <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-sm">{label}</span>
              <Icon className="h-4 w-4" />
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-900">
              {currency ? `${stats.currency || 'INR'} ${Number(stats[key] || 0).toLocaleString()}` : Number(stats[key] || 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Recent company registrations</h2>
            <Link to="/platform-admin/companies" className="text-sm font-medium text-blue-600 hover:text-blue-700">All companies</Link>
          </div>
          {recentCompanies.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {recentCompanies.map((company) => (
                <Link key={company._id} to={`/platform-admin/companies/${company._id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:text-blue-700">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{company.name}</p>
                    <p className="truncate text-sm text-slate-500">{company.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{company.subscription?.planName || company.plan || 'Unassigned'}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No companies have registered yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Plan distribution</h2>
          {companyTotal ? (
            <div className="mt-5 space-y-5">
              {[
                ['Basic', data?.planDistribution?.basic || 0, 'bg-blue-500'],
                ['Pro', data?.planDistribution?.pro || 0, 'bg-violet-500'],
              ].map(([label, count, barClass]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className="font-medium text-slate-900">{count} companies</span></div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.min(Number(count) / companyTotal * 100, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Plan statistics will appear when companies are registered.</p>
          )}
        </section>
      </div>
    </div>
  );
}
