import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { FiTrendingUp, FiUsers, FiShoppingBag, FiDollarSign, FiClipboard, FiMapPin, FiAlertCircle, FiPackage } from 'react-icons/fi';
import { PageLoader } from '../components/common/Spinner';

const fmt  = (n) => new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(n || 0);
const fmtN = (n) => new Intl.NumberFormat('en-NP').format(n || 0);

function KPI({ icon: Icon, label, value, sub, color = 'blue', onClick }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green:  'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    red:    'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    teal:   'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  };
  return (
    <div
      onClick={onClick}
      className={`card p-4 flex items-center gap-3 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-95' : ''}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="text-lg" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-tight">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white truncate leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {onClick && <span className="text-slate-300 text-xs flex-shrink-0">›</span>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

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

  const targetPct = data.target?.salesTarget
    ? Math.min(100, Math.round((data.monthlySales / data.target.salesTarget) * 100))
    : null;

  return (
    <div className="space-y-5">

      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-NP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {targetPct !== null && (
          <div className="card p-3 sm:min-w-44">
            <p className="text-xs text-slate-500 mb-1.5 font-medium">Monthly Target</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${targetPct}%` }} />
              </div>
              <span className="text-sm font-bold text-primary-600">{targetPct}%</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{fmt(data.monthlySales)} / {fmt(data.target?.salesTarget)}</p>
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KPI icon={FiTrendingUp}  label="Today's Sales"       value={fmt(data.todaySales)}         color="blue"   onClick={() => navigate('/orders')} />
        <KPI icon={FiTrendingUp}  label="Last 30 Days Sales"   value={fmt(data.monthlySales)}        color="green"  onClick={() => navigate('/orders')} />
        <KPI icon={FiDollarSign}  label="Today Collection"     value={fmt(data.todayCollection)}     color="purple" onClick={() => navigate('/collections')} />
        <KPI icon={FiDollarSign}  label="Last 30 Days Collect" value={fmt(data.monthlyCollection)}   color="indigo" onClick={() => navigate('/collections')} />
        <KPI icon={FiAlertCircle} label="Outstanding"        value={fmt(data.totalOutstanding)}    color="red"    onClick={() => navigate('/dealers')} />
        <KPI icon={FiShoppingBag} label="Total Dealers"      value={fmtN(data.totalDealers)}       sub={`${data.activeDealers} active`} color="orange" onClick={() => navigate('/dealers')} />
        <KPI icon={FiClipboard}   label="Pending Orders"     value={fmtN(data.pendingOrders)}      color="yellow" onClick={() => navigate('/orders')} />
        <KPI icon={FiClipboard}   label="Total Orders"       value={fmtN(data.totalOrders)}        color="teal"   onClick={() => navigate('/orders')} />

        {(role === 'nsm' || role === 'admin') && <>
          <KPI icon={FiUsers} label="Total RSM" value={fmtN(data.totalRSM)} color="blue"   onClick={() => navigate('/users')} />
          <KPI icon={FiUsers} label="Total ASM" value={fmtN(data.totalASM)} color="green"  onClick={() => navigate('/users')} />
          <KPI icon={FiUsers} label="Total SE"  value={fmtN(data.totalSE)}  color="orange" onClick={() => navigate('/users')} />
        </>}
        {role === 'rsm' && <>
          <KPI icon={FiUsers} label="Total ASM" value={fmtN(data.totalASM)} color="green"  onClick={() => navigate('/users')} />
          <KPI icon={FiUsers} label="Total SE"  value={fmtN(data.totalSE)}  color="orange" onClick={() => navigate('/users')} />
        </>}
        {role === 'asm' && <>
          <KPI icon={FiUsers}  label="Total SE"      value={fmtN(data.totalSE)}     color="orange" onClick={() => navigate('/users')} />
          <KPI icon={FiMapPin} label="Today Visits"  value={fmtN(data.todayVisits)} color="teal"   onClick={() => navigate('/visits')} />
        </>}
        {role === 'se' && <>
          <KPI icon={FiUsers}  label="Total SO"       value={fmtN(data.totalSO)}      color="yellow" onClick={() => navigate('/users')} />
          <KPI icon={FiMapPin} label="Today Visits"   value={fmtN(data.todayVisits)}  color="teal"   onClick={() => navigate('/visits')} />
          <KPI icon={FiMapPin} label="Monthly Visits" value={fmtN(data.totalVisits)}  color="blue"   onClick={() => navigate('/visits')} />
        </>}
        {role === 'so' && <>
          <KPI icon={FiMapPin} label="Today Visits"   value={fmtN(data.todayVisits)} color="teal" onClick={() => navigate('/visits')} />
          <KPI icon={FiMapPin} label="Monthly Visits" value={fmtN(data.totalVisits)} color="blue" onClick={() => navigate('/visits')} />
        </>}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">Sales Trend (Last 7 Days)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.salesTrend || []}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="_id" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#sg)" strokeWidth={2} name="Sales" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">Province Wise Sales <span className="text-xs font-normal text-slate-400">This month</span></p>
          {(data.provinceSales || []).length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(data.provinceSales || []).slice(0, 7)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <YAxis dataKey="_id" type="category" tick={{ fontSize: 9 }} width={90} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Products & Dealers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/products')}>
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">Top Products <span className="text-xs font-normal text-slate-400">By revenue this month</span></p>
          {(data.topProducts || []).length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No data yet</div>
          ) : (
            <div className="space-y-2.5">
              {(data.topProducts || []).slice(0, 6).map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{p._id || 'Unknown'}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white ml-2 flex-shrink-0">{fmt(p.total)}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (p.total / (data.topProducts[0]?.total || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/dealers')}>
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">Top Dealers <span className="text-xs font-normal text-slate-400">By purchase this month</span></p>
          {(data.topDealers || []).length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No data yet</div>
          ) : (
            <div className="space-y-2.5">
              {(data.topDealers || []).slice(0, 6).map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{d.dealer?.dealerName || 'Unknown'}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white ml-2 flex-shrink-0">{fmt(d.total)}</span>
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

      {/* Role-specific ranking tables */}
      {(role === 'nsm' || role === 'admin') && data.rsmRanking?.length > 0 && (
        <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/users')}>
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">RSM Performance Ranking <span className="text-xs font-normal text-slate-400">Monthly sales</span></p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-900 text-white text-xs"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">RSM Name</th><th className="px-3 py-2 text-right">Monthly Sales</th></tr></thead>
              <tbody>
                {data.rsmRanking.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-bold text-blue-600">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.user?.name || '—'}</td>
                    <td className="px-3 py-2 text-right font-bold text-green-600">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {role === 'asm' && data.seRanking?.length > 0 && (
        <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/users')}>
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">SE Performance Ranking <span className="text-xs font-normal text-slate-400">Monthly sales</span></p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-900 text-white text-xs"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">SE Name</th><th className="px-3 py-2 text-right">Monthly Sales</th></tr></thead>
              <tbody>
                {data.seRanking.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-bold text-blue-600">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.user?.name || '—'}</td>
                    <td className="px-3 py-2 text-right font-bold text-green-600">{fmt(r.total)}</td>
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
