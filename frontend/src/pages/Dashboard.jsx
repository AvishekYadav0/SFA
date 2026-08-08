import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { FiTrendingUp, FiUsers, FiShoppingBag, FiDollarSign, FiClipboard, FiMapPin, FiAlertCircle, FiCheckCircle, FiClock, FiTarget } from 'react-icons/fi';
import { PageLoader } from '../components/common/Spinner';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];

const fmt = (n) => new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(n || 0);
const fmtN = (n) => new Intl.NumberFormat('en-NP').format(n || 0);

const KPI = ({ icon: Icon, label, value, sub, color = 'blue', trend }) => (
  <div className="card p-5 flex items-start gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-${color}-100 dark:bg-${color}-900/30`}>
      <Icon className={`text-xl text-${color}-600 dark:text-${color}-400`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 truncate">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      {trend !== undefined && (
        <p className={`text-xs font-medium mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last month
        </p>
      )}
    </div>
  </div>
);

const SectionTitle = ({ title, sub }) => (
  <div className="mb-4">
    <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
    {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Dealer role has its own portal — redirect immediately
  useEffect(() => {
    if (user?.role === 'dealer') navigate('/dealer-portal', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    dashboardService.get()
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (!data)   return <div className="text-center py-20 text-slate-400">Failed to load dashboard</div>;

  const role = user?.role;

  // ── Target progress ──────────────────────────────────────────────────────
  const targetPct = data.target?.salesTarget
    ? Math.min(100, Math.round((data.monthlySales / data.target.salesTarget) * 100))
    : null;

  return (
    <div className="space-y-6">

      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('en-NP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {targetPct !== null && (
          <div className="card p-4 min-w-48">
            <p className="text-xs text-slate-500 mb-2 font-medium">Monthly Target</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${targetPct}%` }} />
              </div>
              <span className="text-sm font-bold text-primary-600">{targetPct}%</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{fmt(data.monthlySales)} / {fmt(data.target?.salesTarget)}</p>
          </div>
        )}
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <KPI icon={FiTrendingUp}  label="Today's Sales"    value={fmt(data.todaySales)}        color="blue" />
        <KPI icon={FiTrendingUp}  label="Monthly Sales"    value={fmt(data.monthlySales)}       color="green" />
        <KPI icon={FiDollarSign}  label="Today Collection" value={fmt(data.todayCollection)}    color="purple" />
        <KPI icon={FiDollarSign}  label="Monthly Collection" value={fmt(data.monthlyCollection)} color="indigo" />
        <KPI icon={FiAlertCircle} label="Outstanding"      value={fmt(data.totalOutstanding)}   color="red" />
        <KPI icon={FiShoppingBag} label="Total Dealers"    value={fmtN(data.totalDealers)}      sub={`${data.activeDealers} active`} color="orange" />
        <KPI icon={FiClipboard}   label="Pending Orders"   value={fmtN(data.pendingOrders)}     color="yellow" />
        <KPI icon={FiClipboard}   label="Total Orders"     value={fmtN(data.totalOrders)}       color="teal" />
        {role === 'nsm' || role === 'admin' ? <>
          <KPI icon={FiUsers} label="Total RSM" value={fmtN(data.totalRSM)} color="blue" />
          <KPI icon={FiUsers} label="Total ASM" value={fmtN(data.totalASM)} color="green" />
          <KPI icon={FiUsers} label="Total SE"  value={fmtN(data.totalSE)}  color="orange" />
        </> : null}
        {role === 'rsm' ? <>
          <KPI icon={FiUsers} label="Total ASM" value={fmtN(data.totalASM)} color="green" />
          <KPI icon={FiUsers} label="Total SE"  value={fmtN(data.totalSE)}  color="orange" />
        </> : null}
        {role === 'asm' ? <>
          <KPI icon={FiUsers}  label="Total SE"     value={fmtN(data.totalSE)}     color="orange" />
          <KPI icon={FiMapPin} label="Today Visits" value={fmtN(data.todayVisits)} color="teal" />
        </> : null}
        {role === 'se' ? <>
          <KPI icon={FiUsers} label="Total SO"      value={fmtN(data.totalSO)}       color="yellow" />
          <KPI icon={FiMapPin} label="Today Visits"   value={fmtN(data.todayVisits)}   color="teal" />
          <KPI icon={FiMapPin} label="Monthly Visits" value={fmtN(data.totalVisits)}   color="blue" />
        </> : null}
        {role === 'so' ? <>
          <KPI icon={FiMapPin} label="Today Visits"   value={fmtN(data.todayVisits)}   color="teal" />
          <KPI icon={FiMapPin} label="Monthly Visits" value={fmtN(data.totalVisits)}   color="blue" />
        </> : null}
      </div>

      {/* ── Charts Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Sales Trend */}
        <div className="card p-5">
          <SectionTitle title="Sales Trend (Last 7 Days)" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.salesTrend || []}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#salesGrad)" strokeWidth={2} name="Sales" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Province Wise Sales */}
        <div className="card p-5">
          <SectionTitle title="Province Wise Sales" sub="This month" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(data.provinceSales || []).slice(0, 7)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="_id" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Sales" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top Products & Dealers ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Products */}
        <div className="card p-5">
          <SectionTitle title="Top Products" sub="By revenue this month" />
          {(data.topProducts || []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {(data.topProducts || []).slice(0, 8).map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{p._id || 'Unknown'}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white ml-2">{fmt(p.total)}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (p.total / (data.topProducts[0]?.total || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Dealers */}
        <div className="card p-5">
          <SectionTitle title="Top Dealers" sub="By purchase this month" />
          {(data.topDealers || []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {(data.topDealers || []).slice(0, 8).map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{d.dealer?.dealerName || 'Unknown'}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white ml-2">{fmt(d.total)}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (d.total / (data.topDealers[0]?.total || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Role-specific ranking tables ──────────────────────────────────── */}
      {(role === 'nsm' || role === 'admin') && data.rsmRanking?.length > 0 && (
        <div className="card p-5">
          <SectionTitle title="RSM Performance Ranking" sub="Monthly sales" />
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>#</th><th>RSM Name</th><th>Monthly Sales</th></tr></thead>
              <tbody>
                {data.rsmRanking.map((r, i) => (
                  <tr key={i}>
                    <td className="font-bold text-primary-600">{i + 1}</td>
                    <td className="font-medium">{r.user?.name || '—'}</td>
                    <td className="font-bold text-green-600">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {role === 'rsm' && data.asmRanking?.length > 0 && (
        <div className="card p-5">
          <SectionTitle title="ASM Performance Ranking" sub="Monthly sales" />
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>#</th><th>ASM Name</th><th>Monthly Sales</th></tr></thead>
              <tbody>
                {data.asmRanking.map((r, i) => (
                  <tr key={i}>
                    <td className="font-bold text-primary-600">{i + 1}</td>
                    <td className="font-medium">{r.user?.name || '—'}</td>
                    <td className="font-bold text-green-600">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {role === 'asm' && data.seRanking?.length > 0 && (
        <div className="card p-5">
          <SectionTitle title="Sales Executive Ranking" sub="Monthly sales" />
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>#</th><th>SE Name</th><th>Monthly Sales</th></tr></thead>
              <tbody>
                {data.seRanking.map((r, i) => (
                  <tr key={i}>
                    <td className="font-bold text-primary-600">{i + 1}</td>
                    <td className="font-medium">{r.user?.name || '—'}</td>
                    <td className="font-bold text-green-600">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
