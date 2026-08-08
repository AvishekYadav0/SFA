import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services';
import { formatCurrency, formatDate, StatusBadge } from '../components/common/index.jsx';
import { Skeleton } from '../components/common/Spinner';
import {
  FiClipboard, FiTruck, FiDollarSign, FiPlus, FiUser, FiMapPin, FiBriefcase,
  FiAlertCircle, FiUsers, FiTarget, FiAward, FiTrendingUp, FiHome, FiCheckCircle,
} from 'react-icons/fi';

/* ------------------------------------------------------------------ */
/* Role configuration — the single source of truth for how each level */
/* of the hierarchy labels itself and what it's allowed to do.        */
/* ------------------------------------------------------------------ */
const ROLE_CONFIG = {
  SE: {
    label: 'Sales Executive',
    teamLabel: 'My Dealers',
    teamEmptyLabel: 'No dealers assigned to you yet.',
    rankingLabel: null, // SEs have no subordinates to rank
    permissions: [
      { label: 'Create & manage Order Plans', allowed: true },
      { label: 'Create & manage Lifting Plans', allowed: true },
      { label: 'Create & manage Collection Plans', allowed: true },
      { label: 'Edit pending records', allowed: true },
      { label: 'View Reports', allowed: false },
      { label: 'Manage Products / Dealers', allowed: false },
      { label: 'User Management', allowed: false },
      { label: 'Approve / Reject Orders', allowed: false },
    ],
    quickActions: [
      { label: 'Create Order Plan', icon: FiClipboard, to: '/orders', color: 'bg-blue-600 hover:bg-blue-700' },
      { label: 'Create Lifting Plan', icon: FiTruck, to: '/lifting', color: 'bg-indigo-600 hover:bg-indigo-700' },
      { label: 'Create Collection Plan', icon: FiDollarSign, to: '/collections', color: 'bg-emerald-600 hover:bg-emerald-700' },
    ],
  },
  ASM: {
    label: 'Area Sales Manager',
    teamLabel: 'My Sales Executives',
    teamEmptyLabel: 'No sales executives assigned to your area yet.',
    rankingLabel: 'Sales Executive Performance',
    permissions: [
      { label: 'Approve / Reject Orders', allowed: true },
      { label: 'View Area Reports', allowed: true },
      { label: 'Manage assigned Sales Executives', allowed: true },
      { label: 'Create & manage Order Plans', allowed: true },
      { label: 'Manage Products / Dealers', allowed: false },
      { label: 'User Management', allowed: false },
      { label: 'View Regional Reports', allowed: false },
    ],
    quickActions: [
      { label: 'Review Pending Orders', icon: FiCheckCircle, to: '/orders?status=pending', color: 'bg-amber-600 hover:bg-amber-700' },
      { label: 'Create Order Plan', icon: FiClipboard, to: '/orders', color: 'bg-blue-600 hover:bg-blue-700' },
      { label: 'View Area Report', icon: FiTrendingUp, to: '/reports', color: 'bg-indigo-600 hover:bg-indigo-700' },
    ],
  },
  RSM: {
    label: 'Regional Sales Manager',
    teamLabel: 'My Area Managers',
    teamEmptyLabel: 'No area managers assigned to your region yet.',
    rankingLabel: 'Area Performance',
    permissions: [
      { label: 'Approve / Reject Orders', allowed: true },
      { label: 'View Regional Reports', allowed: true },
      { label: 'Manage Area Managers', allowed: true },
      { label: 'Manage Dealers', allowed: true },
      { label: 'User Management', allowed: false },
      { label: 'View National Reports', allowed: false },
    ],
    quickActions: [
      { label: 'Review Pending Orders', icon: FiCheckCircle, to: '/orders?status=pending', color: 'bg-amber-600 hover:bg-amber-700' },
      { label: 'View Regional Report', icon: FiTrendingUp, to: '/reports', color: 'bg-indigo-600 hover:bg-indigo-700' },
      { label: 'Manage Dealers', icon: FiHome, to: '/dealers', color: 'bg-emerald-600 hover:bg-emerald-700' },
    ],
  },
  NSM: {
    label: 'National Sales Manager',
    teamLabel: 'My Regional Managers',
    teamEmptyLabel: 'No regional managers on record yet.',
    rankingLabel: 'Regional Performance',
    permissions: [
      { label: 'Approve / Reject Orders', allowed: true },
      { label: 'View National Reports', allowed: true },
      { label: 'Manage Regional Managers', allowed: true },
      { label: 'Manage Products / Dealers', allowed: true },
      { label: 'User Management', allowed: true },
      { label: 'Full System Access', allowed: true },
    ],
    quickActions: [
      { label: 'Review Pending Orders', icon: FiCheckCircle, to: '/orders?status=pending', color: 'bg-amber-600 hover:bg-amber-700' },
      { label: 'View National Report', icon: FiTrendingUp, to: '/reports', color: 'bg-indigo-600 hover:bg-indigo-700' },
      { label: 'User Management', icon: FiUsers, to: '/users', color: 'bg-violet-600 hover:bg-violet-700' },
    ],
  },
};

const BANNER_GRADIENT = 'linear-gradient(135deg, #1e3a8a 0%, #2563EB 50%, #3b82f6 100%)';
const STATUS_COLORS = { pending: '#f59e0b', approved: '#2563eb', completed: '#10b981', rejected: '#ef4444' };
const PIE_FALLBACK_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const QuickCard = ({ icon: Icon, label, count, sub, bg, onClick }) => (
  <button onClick={onClick}
    className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer text-left w-full">
    <div className={`p-3 rounded-2xl ${bg}`}>
      <Icon className="text-2xl text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">{count}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </button>
);

const TargetBar = ({ pct = 0 }) => {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = clamped >= 100 ? 'bg-emerald-500' : clamped >= 60 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
};

export default function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const role = data?.role || user?.role || 'SE';
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.SE;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    dashboardService.getStats()
      .then((res) => { if (!cancelled) setData(res.data?.data || res.data || {}); })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.message || 'Failed to load dashboard.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const kpis = data?.kpis || {};
  const targetPct = useMemo(() => {
    if (!kpis.targetValue) return null;
    return Math.round((Number(kpis.achievedValue || 0) / Number(kpis.targetValue)) * 100);
  }, [kpis.targetValue, kpis.achievedValue]);

  const trend = data?.trend || [];
  const statusBreakdown = data?.statusBreakdown || [];
  const rankings = data?.rankings || [];
  const team = data?.team || [];
  const dealers = data?.dealers || [];
  const recentOrders = data?.recentOrders || [];
  const alerts = data?.alerts || {};

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-28" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );

  if (error) return (
    <div className="card flex flex-col items-center justify-center py-16 text-center gap-3">
      <FiAlertCircle className="text-3xl text-red-500" />
      <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
      <button onClick={() => window.location.reload()} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
        Try again
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl p-6 text-white" style={{ background: BANNER_GRADIENT }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold">Welcome back, {user?.name}!</h1>
            <div className="flex flex-wrap gap-3 mt-1.5 text-blue-100 text-sm">
              <span className="flex items-center gap-1"><FiBriefcase size={13} />{cfg.label}</span>
              {(data?.scope?.label || user?.assignedArea || user?.province) && (
                <span className="flex items-center gap-1"><FiMapPin size={13} />{data?.scope?.label || user.assignedArea || user.province}</span>
              )}
              {user?.employeeId && (
                <span className="flex items-center gap-1"><FiUser size={13} />ID: {user.employeeId}</span>
              )}
            </div>
          </div>
          {targetPct !== null && (
            <div className="ml-auto text-right hidden sm:block">
              <p className="text-blue-100 text-xs">Target Achievement</p>
              <p className="text-2xl font-bold">{targetPct}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickCard icon={FiClipboard} label="Orders" count={kpis.totalOrders ?? 0}
          sub={kpis.orderValue ? formatCurrency(kpis.orderValue) : null}
          bg="bg-blue-600" onClick={() => navigate('/orders')} />
        <QuickCard icon={FiTruck} label="Lifting Plans" count={kpis.totalLifting ?? 0}
          bg="bg-indigo-500" onClick={() => navigate('/lifting')} />
        <QuickCard icon={FiDollarSign} label="Collections" count={kpis.totalCollections ?? 0}
          sub={kpis.collectionValue ? formatCurrency(kpis.collectionValue) : null}
          bg="bg-emerald-500" onClick={() => navigate('/collections')} />
        <QuickCard icon={FiUsers} label={cfg.teamLabel} count={team.length}
          bg="bg-violet-500" onClick={() => navigate('/salespersons')} />
      </div>

      {/* Alerts */}
      {(kpis.pendingOrders > 0 || alerts.pendingApprovals > 0 || alerts.overdueCollections > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {kpis.pendingOrders > 0 && (
            <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl">
              <FiAlertCircle className="text-yellow-600 text-xl flex-shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{kpis.pendingOrders}</strong> order{kpis.pendingOrders > 1 ? 's' : ''} awaiting approval.
              </p>
            </div>
          )}
          {alerts.overdueCollections > 0 && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <FiAlertCircle className="text-red-600 text-xl flex-shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>{alerts.overdueCollections}</strong> overdue collection{alerts.overdueCollections > 1 ? 's' : ''} need follow-up.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      {(trend.length > 0 || statusBreakdown.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {trend.length > 0 && (
            <div className="card lg:col-span-2">
              <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Performance Trend</h2>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="orders" name="Orders" stroke="#2563eb" fill="url(#ordersGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="collections" name="Collections" stroke="#10b981" fill="url(#collGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {statusBreakdown.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Order Status</h2>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {statusBreakdown.map((entry, i) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || PIE_FALLBACK_COLORS[i % PIE_FALLBACK_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cfg.quickActions.map(({ label, icon: Icon, to, color }) => (
            <button key={label} onClick={() => navigate(to)}
              className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-white font-medium text-sm transition-colors ${color}`}>
              <FiPlus className="text-lg" />
              <Icon className="text-lg" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Rankings (ASM/RSM/NSM only) */}
      {cfg.rankingLabel && rankings.length > 0 && (
        <div className="card p-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FiAward className="text-amber-500" /> {cfg.rankingLabel}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Name</th><th>Orders</th><th>Value</th><th>Target</th></tr>
              </thead>
              <tbody>
                {rankings.map((r, i) => (
                  <tr key={r.id}>
                    <td className="font-medium text-slate-400">{i + 1}</td>
                    <td className="font-medium">{r.name}</td>
                    <td>{r.orders}</td>
                    <td className="font-medium">{formatCurrency(r.value)}</td>
                    <td className="w-40">
                      <div className="flex items-center gap-2">
                        <TargetBar pct={r.targetPct} />
                        <span className="text-xs text-slate-500 w-9 text-right">{r.targetPct ?? 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="card p-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Recent Orders</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <FiClipboard className="text-4xl mb-3" />
            <p className="text-sm">No orders yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Order #</th><th>Date</th><th>Dealer</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o._id}>
                    <td className="font-bold text-blue-600">{o.orderNumber}</td>
                    <td className="text-xs text-slate-500">{formatDate(o.date)}</td>
                    <td>{o.dealer?.dealerName || '—'}</td>
                    <td className="font-medium">{formatCurrency(o.grandTotal)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Team */}
      <div className="card p-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">{cfg.teamLabel}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{team.length} in your scope</p>
          </div>
          <button onClick={() => navigate('/salespersons')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View all →
          </button>
        </div>
        {team.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <FiUsers className="text-4xl mb-2 opacity-40" />
            <p className="text-sm">{cfg.teamEmptyLabel}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Employee ID</th><th>Full Name</th><th>Phone</th><th>Area</th><th>Designation</th><th>Status</th></tr>
              </thead>
              <tbody>
                {team.slice(0, 5).map(sp => (
                  <tr key={sp.id}>
                    <td className="font-medium text-blue-600">{sp.employeeId}</td>
                    <td className="font-medium">{sp.name}</td>
                    <td className="text-slate-500">{sp.phone}</td>
                    <td className="text-slate-500">{sp.area}</td>
                    <td><span className="badge-info">{sp.designation}</span></td>
                    <td><StatusBadge status={sp.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {team.length > 5 && (
              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => navigate('/salespersons')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  +{team.length - 5} more →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top dealers (RSM/NSM) */}
      {dealers.length > 0 && (
        <div className="card p-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FiHome className="text-slate-400" /> Top Dealers
            </h2>
            <button onClick={() => navigate('/dealers')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Dealer</th><th>Area</th><th>Order Value</th><th>Last Order</th></tr>
              </thead>
              <tbody>
                {dealers.slice(0, 5).map(d => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.dealerName}</td>
                    <td className="text-slate-500">{d.area}</td>
                    <td className="font-medium">{formatCurrency(d.orderValue)}</td>
                    <td className="text-xs text-slate-500">{d.lastOrderDate ? formatDate(d.lastOrderDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Permissions info */}
      <div className="card bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <FiTarget className="text-slate-400" /> Your Access Level — {cfg.label}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {cfg.permissions.map(({ label, allowed }) => (
            <div key={label} className={`flex items-center gap-2 ${allowed ? 'text-green-700 dark:text-green-400' : 'text-slate-400'}`}>
              <span className="text-base">{allowed ? '✓' : '✗'}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
