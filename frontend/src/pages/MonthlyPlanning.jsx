import { useEffect, useState } from 'react';
import { FiCalendar, FiTarget, FiDollarSign, FiTrendingUp, FiAward } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services';
import { PageLoader } from '../components/common/Spinner';

const fmt = (n) => new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(n || 0);
const fmtPct = (n) => `${n != null ? Math.round(n) : 0}%`;

export default function MonthlyPlanning() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardService.getMonthlyPlanning()
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (!data) return <div className="text-center py-20 text-slate-400">No monthly planning data available</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Monthly Planning Auto</h1>
          <p className="text-sm text-slate-500 mt-1">Month: {new Date(data.year, data.month - 1).toLocaleString('en-NP', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="rounded-3xl bg-slate-100 dark:bg-slate-800 p-4 text-sm text-slate-500">
          {user?.role === 'admin' ? 'Admin view — full access' : 'Auto dashboard with hierarchy-aware scope'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3 text-slate-500"><FiTarget className="text-xl" /><span>Target</span></div>
          <p className="text-3xl font-bold text-slate-900">{fmt(data.target)}</p>
          <p className="text-sm text-slate-500 mt-2">Scheme Budget: {fmt(data.schemeBudget)}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3 text-slate-500"><FiDollarSign className="text-xl" /><span>Sales Till Today</span></div>
          <p className="text-3xl font-bold text-slate-900">{fmt(data.salesTillToday)}</p>
          <p className="text-sm text-slate-500 mt-2">Collected this month: {fmt(data.collectedThisMonth)}</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3 text-slate-500"><FiTrendingUp className="text-xl" /><span>Achievement</span></div>
          <p className="text-3xl font-bold text-slate-900">{fmtPct(data.achievement)}</p>
          <p className="text-sm text-slate-500 mt-2">Balance: {fmt(data.balance)}</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4 text-slate-500"><FiAward className="text-xl" /><span>Expected Collection</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Expected Collection</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{fmt(data.expectedCollection)}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Scheme Budget</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{fmt(data.schemeBudget)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
