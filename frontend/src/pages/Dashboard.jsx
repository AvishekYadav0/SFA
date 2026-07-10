import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardService } from '../services';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import {
  FiShoppingCart, FiDollarSign, FiTruck, FiAlertCircle,
  FiShoppingBag, FiPackage, FiUsers, FiMapPin, FiTrendingUp,
} from 'react-icons/fi';
import { Skeleton } from '../components/common/Spinner';
import { StatusBadge, formatCurrency } from '../components/common/index.jsx';
import { useAuth } from '../context/AuthContext';

/* ── Province color palette ──────────────────────────── */
const PROVINCE_COLORS = {
  'Koshi Province': { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
  'Madhesh Province': { bg: '#F0FDF4', border: '#22C55E', text: '#15803D' },
  'Bagmati Province': { bg: '#F5F3FF', border: '#8B5CF6', text: '#6D28D9' },
  'Gandaki Province': { bg: '#FFFBEB', border: '#F59E0B', text: '#B45309' },
  'Lumbini Province': { bg: '#FEF2F2', border: '#EF4444', text: '#B91C1C' },
  'Karnali Province': { bg: '#ECFEFF', border: '#06B6D4', text: '#0E7490' },
  'Sudurpashchim Province': { bg: '#FDF4FF', border: '#EC4899', text: '#BE185D' },
};
const getColor = (province) => PROVINCE_COLORS[province] || { bg: '#F8FAFC', border: '#94A3B8', text: '#475569' };

/* ── Stat Card ───────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color, sub, onClick }) => (
  <div
    className={`card flex items-center gap-4 p-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-150' : ''}`}
    onClick={onClick}
  >
    <div className="p-3 rounded-2xl flex-shrink-0" style={{ background: color }}>
      <Icon className="text-xl text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-slate-500 truncate">{label}</p>
      <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      {onClick && <p className="text-xs text-primary-500 mt-0.5">Click to view all →</p>}
    </div>
  </div>
);

/* ── Province Card ───────────────────────────────────── */
const ProvinceCard = ({ stat }) => {
  const c = getColor(stat.province);
  const collPct = stat.totalSales > 0 ? Math.min(100, Math.round((stat.totalCollection / stat.totalSales) * 100)) : 0;
  return (
    <div className="rounded-2xl border-2 overflow-hidden shadow-sm" style={{ borderColor: c.border, background: '#fff' }}>
      {/* header */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: c.border }}>
        <FiMapPin className="text-white flex-shrink-0" size={14} />
        <h3 className="font-bold text-white text-sm truncate">{stat.province}</h3>
      </div>
      {/* stats grid */}
      <div className="p-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl p-2.5 text-center" style={{ background: c.bg }}>
          <p className="text-xs text-slate-500 mb-0.5">Orders</p>
          <p className="text-xl font-bold" style={{ color: c.text }}>{stat.totalOrders}</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: c.bg }}>
          <p className="text-xs text-slate-500 mb-0.5">Dealers</p>
          <p className="text-xl font-bold" style={{ color: c.text }}>{stat.totalDealers}</p>
        </div>
        <div className="rounded-xl p-2.5 text-center col-span-2" style={{ background: c.bg }}>
          <p className="text-xs text-slate-500 mb-0.5">Total Sales</p>
          <p className="text-lg font-bold" style={{ color: c.text }}>{formatCurrency(stat.totalSales)}</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: '#f0fdf4' }}>
          <p className="text-xs text-slate-500 mb-0.5">Collected</p>
          <p className="text-sm font-bold text-green-700">{formatCurrency(stat.totalCollection)}</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: stat.outstandingBalance > 0 ? '#fef2f2' : '#f0fdf4' }}>
          <p className="text-xs text-slate-500 mb-0.5">Outstanding</p>
          <p className="text-sm font-bold" style={{ color: stat.outstandingBalance > 0 ? '#dc2626' : '#16a34a' }}>
            {formatCurrency(stat.outstandingBalance)}
          </p>
        </div>
      </div>
      {/* collection progress */}
      <div className="px-3 pb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Collection Rate</span><span>{collPct}%</span>
        </div>
        <div className="w-full rounded-full h-2" style={{ background: '#e2e8f0' }}>
          <div className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${collPct}%`, background: c.border }} />
        </div>
      </div>
      {/* staff count */}
      <div className="px-3 pb-3 flex items-center gap-1.5">
        <FiUsers size={11} style={{ color: c.text }} />
        <span className="text-xs" style={{ color: c.text }}>{stat.activeStaff} active staff</span>
      </div>
    </div>
  );
};

/* ── Main Dashboard ──────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin';

  const fetchDashboard = () => {
    dashboardService.get()
      .then(r => setData(r.data.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();

    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchDashboard(); };
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(fetchDashboard, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    </div>
  );

  const provinceChartData = (data?.provinceStats || []).map(p => ({
    name: p.province.replace(' Province', ''),
    Sales: Math.round(p.totalSales),
    Collection: Math.round(p.totalCollection),
    Outstanding: Math.round(p.outstandingBalance),
  }));

  return (
    <div className="space-y-6">

      {/* ── Nepal Overview ───────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          🇳🇵 Nepal — Overall Summary
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={FiShoppingCart} label="Total Orders" color="#2563EB" onClick={() => navigate('/orders')} />
          <StatCard icon={FiDollarSign} label="Total Sales" color="#22C55E" onClick={isAdmin ? () => navigate('/reports') : undefined} />
          <StatCard icon={FiDollarSign} label="Total Collection" color="#3B82F6" onClick={() => navigate('/collections')} />
          <StatCard icon={FiAlertCircle} label="Outstanding" color="#EF4444" onClick={() => navigate('/collections')} />
          <StatCard icon={FiShoppingBag} label="Active Dealers" color="#14B8A6" onClick={isAdmin ? () => navigate('/dealers') : undefined} />
          <StatCard icon={FiUsers} label="Sales Staff" color="#6366F1" onClick={isAdmin ? () => navigate('/salespersons') : undefined} />
        </div>
      </div>

      {/* ── Pending Alerts ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card flex items-center gap-4 p-4 border-l-4 border-yellow-400 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-150"
          onClick={() => navigate('/orders')}>
          <div className="p-3 rounded-2xl bg-yellow-400 flex-shrink-0"><FiAlertCircle className="text-xl text-white" /></div>
          <div>
            <p className="text-sm text-slate-500">Pending Orders (awaiting approval)</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{data?.pendingOrders ?? 0}</p>
            <p className="text-xs text-primary-500 mt-0.5">Click to view all orders →</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-4 border-l-4 border-orange-400 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-150"
          onClick={() => navigate('/lifting')}>
          <div className="p-3 rounded-2xl bg-orange-400 flex-shrink-0"><FiTruck className="text-xl text-white" /></div>
          <div>
            <p className="text-sm text-slate-500">Pending Lifting (not fully lifted)</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{data?.pendingLifting ?? 0}</p>
            <p className="text-xs text-primary-500 mt-0.5">Click to view all lifting →</p>
          </div>
        </div>
      </div>

      {/* ── Province-wise Cards (Admin only) ─────────── */}
      {isAdmin && data?.provinceStats?.length > 0 && data.provinceStats.some(p => p.totalOrders > 0 || p.totalDealers > 0 || p.activeStaff > 0) && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            📍 Province-wise Sales Breakdown
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.provinceStats.map(stat => (
              <ProvinceCard key={stat.province} stat={stat} />
            ))}
          </div>
        </div>
      )}

      {/* ── Province-wise Bar Chart (Admin only) ─────── */}
      {isAdmin && provinceChartData.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Province-wise Sales vs Collection</h3>
          <p className="text-xs text-slate-400 mb-4">Comparison of sales, collection and outstanding per province</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={provinceChartData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-10} textAnchor="end" height={45} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="Sales" fill="#2563EB" radius={[4, 4, 0, 0]} name="Sales" />
              <Bar dataKey="Collection" fill="#22C55E" radius={[4, 4, 0, 0]} name="Collection" />
              <Bar dataKey="Outstanding" fill="#EF4444" radius={[4, 4, 0, 0]} name="Outstanding" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Monthly Charts ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Monthly Sales</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.salesChart || []}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Area type="monotone" dataKey="sales" stroke="#2563EB" fill="url(#salesGrad)" strokeWidth={2} name="Sales" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Monthly Collection</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.collectionChart || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="collection" fill="#22C55E" radius={[4, 4, 0, 0]} name="Collection" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top Products + Top Staff ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <FiPackage className="text-primary-600" /> Top Selling Products
          </h3>
          <div className="space-y-3">
            {data?.topProducts?.length ? data.topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.productName || 'Unknown'}</p>
                  <p className="text-xs text-slate-500">{p.totalQty} units</p>
                </div>
                <p className="text-sm font-bold text-primary-600 flex-shrink-0">{formatCurrency(p.totalAmount)}</p>
              </div>
            )) : <p className="text-sm text-slate-400 text-center py-6">No sales data yet</p>}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <FiTrendingUp className="text-indigo-600" /> Top Performing Staff
          </h3>
          <div className="space-y-3">
            {data?.topStaff?.length ? data.topStaff.map((s, i) => {
              const c = getColor(s.province);
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{s.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                        {s.province.replace(' Province', '')}
                      </span>
                      <span className="text-xs text-slate-400">{s.orderCount} orders</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-indigo-600 flex-shrink-0">{formatCurrency(s.totalSales)}</p>
                </div>
              );
            }) : <p className="text-sm text-slate-400 text-center py-6">No staff data yet</p>}
          </div>
        </div>
      </div>

      {/* ── Recent Orders ─────────────────────────────── */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Orders</h3>
          {isAdmin && <span className="text-xs text-slate-400">Province shown for admin</span>}
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Dealer</th>
                {isAdmin && <th>Province</th>}
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentOrders?.length ? data.recentOrders.map(o => {
                const prov = o.province || o.dealer?.province || '';
                const c = getColor(prov);
                return (
                  <tr key={o._id}>
                    <td className="font-bold text-primary-600">{o.orderNumber}</td>
                    <td>{o.dealer?.dealerName}</td>
                    {isAdmin && (
                      <td>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                          {prov ? prov.replace(' Province', '') : '—'}
                        </span>
                      </td>
                    )}
                    <td className="font-medium">{formatCurrency(o.grandTotal)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={isAdmin ? 5 : 4} className="text-center text-slate-400 py-8">No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Collections ────────────────────────── */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">Recent Collections</h3>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Dealer</th>
                {isAdmin && <th>Province</th>}
                <th>Opening Bal.</th>
                <th>Order Amt.</th>
                <th>Total Due</th>
                <th>Collected</th>
                <th>Closing Bal.</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentCollections?.length ? data.recentCollections.map(c => {
                const prov = c.province || c.dealer?.province || '';
                const pc = getColor(prov);
                return (
                  <tr key={c._id}>
                    <td className="font-medium">{c.dealer?.dealerName}</td>
                    {isAdmin && (
                      <td>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>
                          {prov ? prov.replace(' Province', '') : '—'}
                        </span>
                      </td>
                    )}
                    <td>{formatCurrency(c.openingBalance)}</td>
                    <td>{formatCurrency(c.currentOrderAmount)}</td>
                    <td className="font-medium">{formatCurrency(c.totalDue)}</td>
                    <td className="text-green-600 font-medium">{formatCurrency(c.totalCollection)}</td>
                    <td className={`font-bold ${c.closingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(c.closingBalance)}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center text-slate-400 py-8">No collections yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
