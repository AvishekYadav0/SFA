import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BarChart3, Download, RefreshCw } from 'lucide-react';
import { platformAdminApi } from '../services/platformAdminApi';

function exportCsv(stats) {
  const rows = [
    ['Metric', 'Value'],
    ['Total Companies', stats.totalCompanies ?? 0],
    ['Active Companies', stats.activeCompanies ?? 0],
    ['Suspended Companies', stats.suspendedCompanies ?? 0],
    ['Expired Subscriptions', stats.expiredSubscriptions ?? 0],
    ['Basic Plan Companies', stats.basicPlanCompanies ?? 0],
    ['Pro Plan Companies', stats.proPlanCompanies ?? 0],
    ['Total Registered Users', stats.totalRegisteredUsers ?? 0],
    ['Active Users', stats.activeUsers ?? 0],
    ['Subscriptions Expiring Soon', stats.subscriptionsExpiringSoon ?? 0],
    ['Total Revenue', stats.totalRevenue ?? 0],
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'platform-summary.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function PlatformAdminReports() {
  const [stats, setStats] = useState(null);
  const [distribution, setDistribution] = useState({ basic: 0, pro: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await platformAdminApi.getDashboard();
      setStats(data.data?.stats || {});
      setDistribution(data.data?.planDistribution || { basic: 0, pro: 0 });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load platform report data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cards = [
    ['Total Companies', stats?.totalCompanies],
    ['Active Companies', stats?.activeCompanies],
    ['Basic Plan Companies', stats?.basicPlanCompanies],
    ['Pro Plan Companies', stats?.proPlanCompanies],
    ['Expired Subscriptions', stats?.expiredSubscriptions],
    ['Active Users', stats?.activeUsers],
    ['Users Registered', stats?.totalRegisteredUsers],
    ['Expiring Soon', stats?.subscriptionsExpiringSoon],
    [`Revenue (${stats?.currency || 'INR'})`, stats?.totalRevenue],
  ];
  const companyCount = Number(stats?.totalCompanies || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Platform</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Reports & Analytics</h1><p className="mt-1 text-sm text-slate-500">Metrics below are sourced from the platform dashboard API.</p></div>
        <div className="flex gap-2"><button type="button" disabled={!stats} onClick={() => exportCsv(stats)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Download className="h-4 w-4" />Export CSV</button><button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Refresh</button></div>
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-red-700 shadow-sm"><div className="flex items-center gap-2"><AlertCircle className="h-5 w-5" />{error}</div><button type="button" onClick={load} className="mt-4 font-semibold underline">Retry</button></div> : loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading platform report data...</div> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-slate-500"><span className="text-sm">{label}</span><BarChart3 className="h-4 w-4" /></div><p className="mt-4 text-2xl font-bold text-slate-900">{Number(value || 0).toLocaleString()}</p></div>)}
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Plan distribution</h2>
            {companyCount ? <div className="mt-5 space-y-5">{[['Basic', distribution.basic || 0, 'bg-blue-500'], ['Pro', distribution.pro || 0, 'bg-violet-500']].map(([label, count, color]) => <div key={label}><div className="flex justify-between text-sm"><span>{label}</span><span>{count} companies</span></div><div className="mt-2 h-2.5 rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(Number(count) / companyCount * 100, 100)}%` }} /></div></div>)}</div> : <p className="mt-3 text-sm text-slate-500">No company records are available for this report.</p>}
          </section>
          <p className="text-xs text-slate-500">Registration growth and revenue time-series are not included because the backend currently provides summary aggregates only.</p>
        </>
      )}
    </div>
  );
}
