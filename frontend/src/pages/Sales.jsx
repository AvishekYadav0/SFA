import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { formatCurrency, formatDate } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { Pagination } from '../components/common/Pagination';
import { useAuth } from '../context/AuthContext';
import {
  FiMapPin, FiUsers, FiShoppingCart, FiDollarSign,
  FiTrendingUp, FiRefreshCw, FiDownload, FiArrowLeft,
  FiAlertCircle, FiCheckCircle, FiBarChart2,
} from 'react-icons/fi';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

const PROVINCES = [
  'Koshi Province', 'Madhesh Province', 'Bagmati Province', 'Gandaki Province',
  'Lumbini Province', 'Karnali Province', 'Sudurpashchim Province',
];

const PROVINCE_COLORS = {
  'Koshi Province':         { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8', bar: '#3B82F6' },
  'Madhesh Province':       { bg: '#F0FDF4', border: '#22C55E', text: '#15803D', bar: '#22C55E' },
  'Bagmati Province':       { bg: '#F5F3FF', border: '#8B5CF6', text: '#6D28D9', bar: '#8B5CF6' },
  'Gandaki Province':       { bg: '#FFFBEB', border: '#F59E0B', text: '#B45309', bar: '#F59E0B' },
  'Lumbini Province':       { bg: '#FEF2F2', border: '#EF4444', text: '#B91C1C', bar: '#EF4444' },
  'Karnali Province':       { bg: '#ECFEFF', border: '#06B6D4', text: '#0E7490', bar: '#06B6D4' },
  'Sudurpashchim Province': { bg: '#FDF4FF', border: '#EC4899', text: '#BE185D', bar: '#EC4899' },
};

const PAYMENT_COLORS = {
  cash:    { bg: '#f0fdf4', text: '#15803d', label: 'Cash' },
  bank:    { bg: '#eff6ff', text: '#1d4ed8', label: 'Bank' },
  esewa:   { bg: '#f0fdf4', text: '#166534', label: 'eSewa' },
  fonepay: { bg: '#fdf4ff', text: '#7e22ce', label: 'FonePay' },
  cheque:  { bg: '#fffbeb', text: '#92400e', label: 'Cheque' },
  credit:  { bg: '#fef2f2', text: '#991b1b', label: 'Credit' },
};

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'Last 7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'year',  label: 'This Year' },
  { value: 'all',   label: 'All Time' },
];

const CHART_GROUP_OPTIONS = [
  { value: 'day',   label: 'Daily' },
  { value: 'week',  label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year',  label: 'Yearly' },
];

/* ── Summary Stat Card ───────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="card p-4 flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: color + '22' }}>
      <Icon size={18} style={{ color }} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-slate-500 truncate">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white truncate">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  </div>
);

/* ── Payment Method Pills ────────────────────────────── */
const PaymentBreakdown = ({ breakdown }) => {
  const entries = Object.entries(breakdown || {}).filter(([, v]) => v?.amount > 0);
  if (!entries.length) return <p className="text-xs text-slate-400 italic">No payments</p>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {entries.map(([method, v]) => {
        const c = PAYMENT_COLORS[method] || { bg: '#f8fafc', text: '#475569', label: method };
        return (
          <span key={method} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: c.bg, color: c.text }}>
            {c.label}: {formatCurrency(v.amount)}
          </span>
        );
      })}
    </div>
  );
};

/* ── Province Staff Modal ────────────────────────────── */
const ProvinceStaffModal = ({ province, onClose }) => {
  const c = PROVINCE_COLORS[province] || { bg: '#f8fafc', border: '#94a3b8', text: '#475569' };
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sales/staff-by-province', { params: { province } })
      .then(r => setStaff(r.data.data || []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, [province]);

  const active   = staff.filter(s => s.status !== 'inactive').length;
  const inactive = staff.length - active;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between rounded-t-2xl" style={{ background: c.border }}>
          <div className="flex items-center gap-2">
            <FiMapPin className="text-white" size={16} />
            <h2 className="font-bold text-white">{province}</h2>
            {!loading && <span className="text-white/80 text-xs ml-1">{staff.length} staff · {active} active · {inactive} inactive</span>}
          </div>
          <button onClick={onClose} className="text-white hover:opacity-70 text-xl font-bold">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : !staff.length ? (
            <p className="text-center text-slate-400 py-10 text-sm">No salespersons in this province.</p>
          ) : (
            <div className="space-y-3">
              {staff.map((sp, i) => (
                <div key={sp._id} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: c.border + '44', background: c.bg }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: c.border, color: '#fff' }}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 text-sm truncate">{sp.fullName}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        sp.status === 'inactive' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                      }`}>{sp.status || 'active'}</span>
                    </div>
                    <p className="text-xs text-slate-500">{sp.designation} · {sp.area} · {sp.employeeId}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500">{sp.orderCount} orders</p>
                    <p className="text-sm font-bold" style={{ color: c.text }}>{formatCurrency(sp.totalSales)}</p>
                    <p className="text-xs text-green-600">Collected: {formatCurrency(sp.collected)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Province Card (dashboard style) ────────────────── */
const ProvinceCard = ({ stat, onClick }) => {
  const c = PROVINCE_COLORS[stat.province] || { bg: '#f8fafc', border: '#94a3b8', text: '#475569' };
  const collPct = stat.totalSales > 0 ? Math.min(100, Math.round((stat.collected / stat.totalSales) * 100)) : 0;
  return (
    <div onClick={onClick}
      className="rounded-2xl border-2 overflow-hidden shadow-sm cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-white"
      style={{ borderColor: c.border }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: c.border }}>
        <FiMapPin className="text-white flex-shrink-0" size={14} />
        <h3 className="font-bold text-white text-sm truncate">{stat.province}</h3>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl p-2.5 text-center" style={{ background: c.bg }}>
          <p className="text-xs text-slate-500 mb-0.5">Orders</p>
          <p className="text-xl font-bold" style={{ color: c.text }}>{stat.totalOrders}</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: c.bg }}>
          <p className="text-xs text-slate-500 mb-0.5">Dealers</p>
          <p className="text-xl font-bold" style={{ color: c.text }}>{stat.dealerCount}</p>
        </div>
        <div className="rounded-xl p-2.5 text-center col-span-2" style={{ background: c.bg }}>
          <p className="text-xs text-slate-500 mb-0.5">Total Sales</p>
          <p className="text-lg font-bold" style={{ color: c.text }}>{formatCurrency(stat.totalSales)}</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: '#f0fdf4' }}>
          <p className="text-xs text-slate-500 mb-0.5">Collected</p>
          <p className="text-sm font-bold text-green-700">{formatCurrency(stat.collected)}</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: stat.outstanding > 0 ? '#fef2f2' : '#f0fdf4' }}>
          <p className="text-xs text-slate-500 mb-0.5">Outstanding</p>
          <p className="text-sm font-bold" style={{ color: stat.outstanding > 0 ? '#dc2626' : '#16a34a' }}>
            {formatCurrency(stat.outstanding)}
          </p>
        </div>
      </div>
      <div className="px-3 pb-2">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Collection Rate</span><span>{collPct}%</span>
        </div>
        <div className="w-full rounded-full h-2" style={{ background: '#e2e8f0' }}>
          <div className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${collPct}%`, background: c.border }} />
        </div>
      </div>
      <div className="px-3 pb-3 flex items-center gap-1.5">
        <FiUsers size={11} style={{ color: c.text }} />
        <span className="text-xs" style={{ color: c.text }}>{stat.activeStaffCount} active staff</span>
      </div>
    </div>
  );
};

/* ── Overall Payment Summary Bar ─────────────────────── */
const OverallPaymentBar = ({ breakdown }) => {
  const entries = Object.entries(breakdown || {}).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        💳 Payment Method Breakdown (All Provinces)
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {entries.map(([method, amount]) => {
          const c = PAYMENT_COLORS[method] || { bg: '#f8fafc', text: '#475569', label: method };
          const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
          return (
            <div key={method} className="rounded-xl p-3 text-center" style={{ background: c.bg }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: c.text }}>
                {c.label}
              </p>
              <p className="text-sm font-bold" style={{ color: c.text }}>{formatCurrency(amount)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Chart Tooltip ────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-100 p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

const yAxisTick = (v) => {
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return v;
};

/* ── Sales Trend Chart (Daily / Weekly / Monthly / Yearly) ── */
/*
  Expects a backend endpoint: GET /sales/trends
  params: { groupBy: 'daily'|'weekly'|'monthly'|'yearly', province?, range?, from?, to? }
  response: { data: [{ label, totalSales, collected, outstanding, orders }, ...] }
*/
const SalesTrendChart = ({ province, range, from, to }) => {
  const [groupBy, setGroupBy] = useState('day');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = { groupBy, range };
      if (province) params.province = province;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get('/sales/trend', { params });
      // compute outstanding = totalSales - collected
      const rows = (res.data?.data || []).map(d => ({
        ...d,
        outstanding: Math.max(0, (d.totalSales || 0) - (d.collected || 0)),
      }));
      setData(rows);
    } catch {
      setData([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [groupBy, province, range, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <FiBarChart2 size={13} /> Sales Trend{province ? ` — ${province}` : ' (All Provinces)'}
        </p>
        <div className="flex gap-1 flex-wrap">
          {CHART_GROUP_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setGroupBy(o.value)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors ${
                groupBy === o.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-72 rounded-xl bg-slate-100 animate-pulse" />
      ) : error ? (
        <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
          <FiAlertCircle size={20} />
          <span>Could not load trend data.</span>
        </div>
      ) : !data.length ? (
        <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
          No data for this period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={yAxisTick} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="totalSales" name="Total Sales" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={22} />
            <Bar dataKey="collected" name="Collected" fill="#22C55E" radius={[4, 4, 0, 0]} barSize={22} />
            <Line type="monotone" dataKey="outstanding" name="Outstanding" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

/* ── Orders Table ────────────────────────────────────── */
const OrdersTable = ({ province, range, from, to }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 15, range };
      if (province) params.province = province;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get('/sales/orders', { params });
      setOrders(res.data.data || []);
      setPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }, [province, range, from, to]);

  useEffect(() => { load(1); }, [load]);

  if (loading) return <PageLoader />;
  if (!orders.length) return (
    <div className="text-center py-10 text-slate-400 text-sm">No orders found.</div>
  );

  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">{total} orders</p>
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead style={{ background: '#1e3a8a', color: '#fff' }}>
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Order #</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Date</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Dealer</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Salesperson</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Province</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold">Order Total</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold">Payment</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold">Collected</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => {
              const c = PAYMENT_COLORS[o.paymentMethod] || { bg: '#f8fafc', text: '#475569', label: o.paymentMethod };
              return (
                <tr key={o._id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}
                  className="border-b border-slate-100">
                  <td className="px-3 py-2.5 font-bold text-primary-600 text-xs">{o.orderNumber}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(o.paidAt || o.createdAt)}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{o.dealer?.dealerName}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{o.salesperson?.fullName || o.staffId?.name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {(() => {
                      const pc = PROVINCE_COLORS[o.province] || { bg: '#f8fafc', text: '#475569', border: '#94a3b8' };
                      return (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>
                          {o.province?.replace(' Province', '') || '—'}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-slate-800">
                    {formatCurrency(o.grandTotal)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: c.bg, color: c.text }}>
                      {c.label || o.paymentMethod || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-bold text-green-700">
                    {formatCurrency(o.collectedAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3">
          <Pagination page={page} pages={pages} onPage={load} />
        </div>
      )}
    </div>
  );
};

/* ── Main Sales Page ─────────────────────────────────── */
export default function Sales() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const range = searchParams.get('range') || 'all';
  const from  = searchParams.get('from') || '';
  const to    = searchParams.get('to') || '';
  const selectedProvince = searchParams.get('province') || null;

  const DEFAULT_PROVINCES = [
    'Koshi Province', 'Madhesh Province', 'Bagmati Province', 'Gandaki Province',
    'Lumbini Province', 'Karnali Province', 'Sudurpashchim Province',
  ].map(name => ({ province: name, totalOrders: 0, totalSales: 0, collected: 0, outstanding: 0, dealerCount: 0, activeStaffCount: 0, collectionRate: 0, paymentBreakdown: {} }));

  const DEFAULT_OVERALL = { totalOrders: 0, totalSales: 0, collected: 0, outstanding: 0, paymentBreakdown: {} };

  const [provinces, setProvinces] = useState(DEFAULT_PROVINCES);
  const [overall, setOverall] = useState(DEFAULT_OVERALL);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(selectedProvince ? 'detail' : 'overview');
  const [staffModal, setStaffModal] = useState(null); // province name or null

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = { range };
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get('/sales/by-province', { params });
      setProvinces(res.data.provinces?.length ? res.data.provinces : DEFAULT_PROVINCES);
      setOverall(res.data.overall || DEFAULT_OVERALL);
    } catch {
      setProvinces(DEFAULT_PROVINCES);
      setOverall(DEFAULT_OVERALL);
    } finally { setLoading(false); }
  }, [range, from, to]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // sync view with URL
  useEffect(() => {
    setView(searchParams.get('province') ? 'detail' : 'overview');
  }, [searchParams]);

  const setParam = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    setSearchParams(p);
  };

  const openProvince = (province) => {
    const p = new URLSearchParams(searchParams);
    p.set('province', province);
    setSearchParams(p);
  };

  const backToOverview = () => {
    const p = new URLSearchParams(searchParams);
    p.delete('province');
    setSearchParams(p);
  };

  const exportCSV = () => {
    const rows = [
      ['Province', 'Orders', 'Dealers', 'Total Sales', 'Collected', 'Outstanding', 'Collection Rate %',
       'Cash', 'Bank', 'eSewa', 'FonePay', 'Cheque', 'Credit'],
      ...provinces.map(p => [
        p.province, p.totalOrders, p.dealerCount,
        p.totalSales, p.collected, p.outstanding, p.collectionRate.toFixed(1),
        p.paymentBreakdown?.cash?.amount || 0,
        p.paymentBreakdown?.bank?.amount || 0,
        p.paymentBreakdown?.esewa?.amount || 0,
        p.paymentBreakdown?.fonepay?.amount || 0,
        p.paymentBreakdown?.cheque?.amount || 0,
        p.paymentBreakdown?.credit?.amount || 0,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `sales-by-province-${range}.csv`;
    a.click();
  };

  const provinceData = selectedProvince
    ? provinces.find(p => p.province === selectedProvince)
    : null;

  /* ── DETAIL VIEW (single province) ──────────────────── */
  if (view === 'detail') return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button onClick={backToOverview}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary-600 mb-1">
            <FiArrowLeft size={12} /> All Provinces
          </button>
          <div className="flex items-center gap-2">
            {selectedProvince && (() => {
              const c = PROVINCE_COLORS[selectedProvince] || {};
              return <FiMapPin style={{ color: c.border }} size={18} />;
            })()}
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedProvince}</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Completed sales — province detail</p>
        </div>
        <Filters range={range} from={from} to={to} setParam={setParam} onRefresh={fetchStats} loading={loading} />
      </div>

      {/* province stats */}
      {provinceData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={FiShoppingCart} label="Completed Orders" value={provinceData.totalOrders} color="#2563EB" />
          <StatCard icon={FiTrendingUp}   label="Total Sales"      value={formatCurrency(provinceData.totalSales)} color="#8B5CF6" />
          <StatCard icon={FiCheckCircle}  label="Collected"        value={formatCurrency(provinceData.collected)} color="#22C55E" />
          <StatCard icon={FiAlertCircle}  label="Outstanding"      value={formatCurrency(provinceData.outstanding)} color="#EF4444" />
        </div>
      )}

      {/* trend chart */}
      <SalesTrendChart province={selectedProvince} range={range} from={from} to={to} />

      {/* payment breakdown */}
      {provinceData && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            💳 Payment Methods
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(provinceData.paymentBreakdown || {}).filter(([, v]) => v?.amount > 0).map(([method, v]) => {
              const c = PAYMENT_COLORS[method] || { bg: '#f8fafc', text: '#475569', label: method };
              return (
                <div key={method} className="rounded-xl px-4 py-2.5 text-center min-w-[100px]"
                  style={{ background: c.bg }}>
                  <p className="text-[10px] font-semibold uppercase" style={{ color: c.text }}>{c.label}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: c.text }}>{formatCurrency(v.amount)}</p>
                  <p className="text-[10px] text-slate-400">{v.count} orders</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* orders table */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Completed Orders — {selectedProvince}
        </h3>
        <OrdersTable province={selectedProvince} range={range} from={from} to={to} />
      </div>
    </div>
  );

  /* ── OVERVIEW (all provinces) ────────────────────────── */
  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sales</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {user?.role === 'admin' ? 'All provinces — all active orders' : 'Your sales by province'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filters range={range} from={from} to={to} setParam={setParam} onRefresh={fetchStats} loading={loading} />
          {user?.role === 'admin' && (
            <button onClick={exportCSV} disabled={loading}
              className="flex items-center gap-1.5 btn-primary text-xs px-3 py-2">
              <FiDownload size={13} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* overall summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={FiShoppingCart} label="Total Orders"      value={overall.totalOrders}               color="#2563EB" />
        <StatCard icon={FiTrendingUp}   label="Total Sales"       value={formatCurrency(overall.totalSales)}  color="#8B5CF6" />
        <StatCard icon={FiCheckCircle}  label="Total Collected"   value={formatCurrency(overall.collected)}   color="#22C55E" />
        <StatCard icon={FiAlertCircle}  label="Total Outstanding" value={formatCurrency(overall.outstanding)} color="#EF4444" />
      </div>

      {/* trend chart (daily / weekly / monthly / yearly) */}
      <SalesTrendChart province={null} range={range} from={from} to={to} />

      {/* payment method breakdown */}
      {overall && <OverallPaymentBar breakdown={overall.paymentBreakdown} />}

      {/* province cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array(7).fill(0).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            📍 Province-wise Sales Breakdown
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {provinces.map(stat => (
              <div key={stat.province} className="flex flex-col gap-2">
                <ProvinceCard stat={stat} onClick={() => openProvince(stat.province)} />
                <button
                  onClick={() => setStaffModal(stat.province)}
                  className="w-full text-xs font-medium py-1.5 rounded-xl border transition-colors"
                  style={{ borderColor: (PROVINCE_COLORS[stat.province]?.border || '#94a3b8') + '66', color: PROVINCE_COLORS[stat.province]?.text || '#475569', background: PROVINCE_COLORS[stat.province]?.bg || '#f8fafc' }}
                >
                  <FiUsers size={11} className="inline mr-1" /> View Salespersons
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* all orders table */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          All Orders
        </h3>
        <OrdersTable province={null} range={range} from={from} to={to} />
      </div>

      {/* staff modal */}
      {staffModal && <ProvinceStaffModal province={staffModal} onClose={() => setStaffModal(null)} />}
    </div>
  );
}

/* ── Filter Controls ─────────────────────────────────── */
function Filters({ range, from, to, setParam, onRefresh, loading }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={range} onChange={e => setParam('range', e.target.value)}
        className="input text-xs py-2 w-36">
        {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input type="date" value={from} onChange={e => setParam('from', e.target.value)}
        className="input text-xs py-2 w-36" placeholder="From" />
      <input type="date" value={to} onChange={e => setParam('to', e.target.value)}
        className="input text-xs py-2 w-36" placeholder="To" />
      <button onClick={onRefresh}
        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
        <FiRefreshCw size={14} className={loading ? 'animate-spin text-primary-600' : 'text-slate-500'} />
      </button>
    </div>
  );
}
