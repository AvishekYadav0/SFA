import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { saleService, dealerService, userService, productService } from '../services';
import { formatCurrency, formatDate } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { Pagination } from '../components/common/Pagination';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  FiMapPin, FiUsers, FiShoppingCart, FiDollarSign,
  FiTrendingUp, FiRefreshCw, FiDownload, FiArrowLeft,
  FiAlertCircle, FiCheckCircle, FiBarChart2, FiPackage, FiEdit3,
  FiPlus, FiMinus,
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

const SALE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'hold', label: 'Hold' },
];

const EMPTY_PROVINCES = [
  'Koshi Province', 'Madhesh Province', 'Bagmati Province', 'Gandaki Province',
  'Lumbini Province', 'Karnali Province', 'Sudurpashchim Province',
].map(name => ({ province: name, totalOrders: 0, totalSales: 0, collected: 0, outstanding: 0, dealerCount: 0, activeStaffCount: 0, collectionRate: 0, paymentBreakdown: {} }));

const DEFAULT_OVERALL = { totalOrders: 0, totalSales: 0, collected: 0, outstanding: 0, paymentBreakdown: {} };

const getDealerAssignedSalesperson = (dealer) => {
  if (!dealer) return { id: '', label: '', role: null };

  const resolve = (value, role) => {
    if (!value) return null;
    const first = Array.isArray(value) ? value[0] : value;
    const id = first?._id || first;
    return {
      id: id != null ? String(id) : '',
      label: first?.fullName || first?.name || '',
      role,
    };
  };

  const directField = dealer.assignedRole;
  if (directField) {
    const direct = resolve(dealer[directField], directField.toUpperCase());
    if (direct) return direct;
  }

  return resolve(dealer.so, 'SO')
    || resolve(dealer.se, 'SE')
    || resolve(dealer.asm, 'ASM')
    || resolve(dealer.rsm, 'RSM')
    || resolve(dealer.nsm, 'NSM')
    || { id: '', label: '', role: null };
};

const getStaffName = (staff) => staff?.fullName || staff?.name || '';

/* ── Sales Items Spreadsheet (mirrors Orders sheet) ─── */
const CUSTOMER_TYPES = ['MM', 'ADPL'];

const calcRow = (qty, rate, excAmt, vatAmt) => {
  const q = +qty || 0;
  const basic = q * (+rate || 0);
  const excise = (+excAmt || 0) * q;
  const vat = (+vatAmt || 0) * q;
  return { basic, excise, vat, total: basic + excise + vat };
};

const SalesItemRow = ({ index, item, products, onChange, onRemove }) => {
  const filteredProducts = products.filter(p => p.customerType === (item.customerType || 'MM'));
  const c = calcRow(item.quantity, item.rate, item.exciseAmount, item.vatAmount);

  const handleProductChange = (productId) => {
    const p = products.find(x => x._id === productId);
    if (p) {
      onChange(index, {
        ...item,
        product: p._id,
        productName: p.productName,
        customerType: p.customerType || item.customerType || 'MM',
        ml: p.ml || '',
        up: p.up || '',
        rate: p.customerType === (item.customerType || 'MM') ? (p.customerPrice || p.rate || 0) : 0,
        exciseAmount: p.exciseAmount || 0,
        vatAmount: p.vatAmount || 0,
      });
    } else {
      onChange(index, { ...item, product: '', productName: '', ml: '', up: '', rate: 0, exciseAmount: 0, vatAmount: 0 });
    }
  };

  const handleCustomerTypeChange = (ct) => {
    onChange(index, { ...item, customerType: ct, product: '', productName: '', ml: '', up: '', rate: 0, exciseAmount: 0, vatAmount: 0 });
  };

  return (
    <tr style={{ background: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
      <td className="px-2 py-1.5 text-center text-xs text-slate-400 font-medium">{index + 1}</td>
      <td className="px-2 py-1.5">
        <select value={item.product || ''} onChange={e => handleProductChange(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white">
          <option value="">-- Select --</option>
          {filteredProducts.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <select value={item.customerType || 'MM'} onChange={e => handleCustomerTypeChange(e.target.value)}
          className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white">
          {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5 text-xs text-slate-600 text-center">{item.ml || '—'}</td>
      <td className="px-2 py-1.5 text-xs text-slate-600 text-center">{item.up || '—'}</td>
      <td className="px-2 py-1.5">
        <input type="number" min="0" value={item.quantity}
          onChange={e => onChange(index, { ...item, quantity: e.target.value })}
          className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 text-center" />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" step="0.01" min="0" value={item.rate} readOnly
          className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 text-right" />
      </td>
      <td className="px-2 py-1.5 text-right text-xs font-medium text-slate-700">{c.basic.toFixed(2)}</td>
      <td className="px-2 py-1.5">
        <input type="number" step="0.01" min="0" value={item.exciseAmount} readOnly
          className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-orange-50 text-orange-600 text-right" />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" step="0.01" min="0" value={item.vatAmount} readOnly
          className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-blue-50 text-blue-600 text-right" />
      </td>
      <td className="px-2 py-1.5 text-right text-sm font-bold text-primary-600">{c.total.toFixed(2)}</td>
      <td className="px-2 py-1.5 text-center">
        <button type="button" onClick={() => onRemove(index)}
          className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50">
          <FiMinus size={14} />
        </button>
      </td>
    </tr>
  );
};

const SalesTotalsRow = ({ items }) => {
  const t = items.reduce((a, i) => {
    const c = calcRow(i?.quantity, i?.rate, i?.exciseAmount, i?.vatAmount);
    return { basic: a.basic + c.basic, excise: a.excise + c.excise, vat: a.vat + c.vat, total: a.total + c.total };
  }, { basic: 0, excise: 0, vat: 0, total: 0 });
  return (
    <tr style={{ background: '#eff6ff', borderTop: '2px solid #2563EB' }}>
      <td colSpan={7} className="px-3 py-2 text-xs font-bold text-slate-600 text-right">TOTALS →</td>
      <td className="px-2 py-2 text-right text-xs font-bold text-slate-800">{t.basic.toFixed(2)}</td>
      <td className="px-2 py-2 text-right text-xs font-bold text-orange-600">{t.excise.toFixed(2)}</td>
      <td className="px-2 py-2 text-right text-xs font-bold text-blue-600">{t.vat.toFixed(2)}</td>
      <td className="px-2 py-2 text-right text-sm font-bold text-primary-600">{formatCurrency(t.total)}</td>
      <td></td>
    </tr>
  );
};

/* ── Summary Stat Card ───────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="card p-4 flex items-center gap-3 min-h-[80px]">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: color + '22' }}>
      <Icon size={18} style={{ color }} />
    </div>
    <div className="min-w-0 overflow-hidden">
      <p className="text-xs text-slate-500 truncate">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white truncate">{value}</p>
      {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
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
                      <p className="font-semibold text-slate-800 text-sm truncate">{getStaffName(sp)}</p>
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
        💳 Payment Method Breakdown (All Sales)
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
          <FiBarChart2 size={13} /> Sales Trend{province ? ` — ${province}` : ' (All Sales)'}
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
  const [sales, setSales] = useState([]);
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
      const res = await api.get('/sales/records', { params });
      setSales(res.data.data || []);
      setPages(res.data.pages || 1);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch { setSales([]); }
    finally { setLoading(false); }
  }, [province, range, from, to]);

  useEffect(() => { load(1); }, [load]);

  if (loading) return <PageLoader />;
  if (!sales.length) return (
    <div className="text-center py-10 text-slate-400 text-sm">No sales found.</div>
  );

  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">{total} sales</p>
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead style={{ background: '#1e3a8a', color: '#fff' }}>
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold">Sale / Order #</th>
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
            {sales.map((o, i) => {
              const c = PAYMENT_COLORS[o.paymentType] || { bg: '#f8fafc', text: '#475569', label: o.paymentType };
              return (
                <tr key={o._id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}
                  className="border-b border-slate-100">
                  <td className="px-3 py-2.5 font-bold text-primary-600 text-xs">{o.orderNumber || o.invoiceNumber || o.manualSaleId || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{formatDate(o.date || o.createdAt)}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{o.dealer?.dealerName}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">
                    {o.salesperson
                      ? `${o.salesperson.fullName || o.salesperson.name} (${(o.salesperson.role || '').toUpperCase()})`
                      : (o.staffId?.name || '—')}
                  </td>
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
                      {c.label || o.paymentType || '—'}
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

  const [provinces, setProvinces] = useState(EMPTY_PROVINCES);
  const [overall, setOverall] = useState(DEFAULT_OVERALL);
  const [loading, setLoading] = useState(true);
  const view = selectedProvince ? 'detail' : 'overview';
  const [staffModal, setStaffModal] = useState(null); // province name or null
  const [ordersKey, setOrdersKey] = useState(0);
  const [salespersons, setSalespersons] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [products, setProducts] = useState([]);
  const [assignedSalespersonId, setAssignedSalespersonId] = useState('');
  const [assignedSalespersonLabel, setAssignedSalespersonLabel] = useState('');
  const [assignedSalespersonRole, setAssignedSalespersonRole] = useState('');
  const [manualSale, setManualSale] = useState({
    date: new Date().toISOString().split('T')[0],
    salesperson: '',
    dealer: '',
    province: '',
    area: '',
    items: [{ product: '', productName: '', customerType: 'MM', ml: '', up: '', quantity: 1, rate: 0, exciseAmount: 0, vatAmount: 0 }],
    grandTotal: '',
    collectedAmount: '',
    paymentType: 'cash',
    status: 'completed',
    remarks: '',
  });
  const [savingSale, setSavingSale] = useState(false);
  const [dealerWarning, setDealerWarning] = useState('');
  const [entryMode, setEntryMode] = useState('choice');
  const [eligibleOrders, setEligibleOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = { range };
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get('/sales/by-province', { params });
      setProvinces(res.data.provinces?.length ? res.data.provinces : EMPTY_PROVINCES);
      setOverall(res.data.overall || DEFAULT_OVERALL);
    } catch {
      setProvinces(EMPTY_PROVINCES);
      setOverall(DEFAULT_OVERALL);
    } finally { setLoading(false); }
  }, [range, from, to]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    userService.getAll({ limit: 200 }).then(r => setSalespersons((r.data.data || []).filter(s => ['nsm', 'rsm', 'asm', 'se', 'so'].includes(s.role)))).catch(() => setSalespersons([]));
    dealerService.getAll({ limit: 200 }).then(r => setDealers(r.data.data || [])).catch(() => setDealers([]));
    productService.getAll({ limit: 500 }).then(r => setProducts(r.data.data || [])).catch(() => setProducts([]));
  }, []);


  const setParam = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    setSearchParams(p);
  };

  const openProvince = (province) => {
    fetchStats();
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

/* ── DETAIL VIEW (single province) ──────────────────── */
  if (view === 'detail') {
    const c = PROVINCE_COLORS[selectedProvince] || {};
    const pData = provinces.find(p => p.province === selectedProvince) || {
      province: selectedProvince, totalOrders: 0, totalSales: 0,
      collected: 0, outstanding: 0, paymentBreakdown: {},
    };

    if (loading) return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={backToOverview} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary-600">
            <FiArrowLeft size={12} /> All Sales
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
        <div className="h-72 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );

    return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={backToOverview}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary-600 mb-1">
            <FiArrowLeft size={12} /> All Sales
          </button>
          <div className="flex items-center gap-2">
            {selectedProvince && <FiMapPin style={{ color: c.border }} size={18} />}
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedProvince}</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Completed sales — province detail</p>
        </div>
        <Filters range={range} from={from} to={to} setParam={setParam} onRefresh={fetchStats} loading={loading} />
      </div>

      {/* province stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={FiShoppingCart} label="Total Orders" value={pData.totalOrders} color="#2563EB" />
          <StatCard icon={FiTrendingUp}   label="Total Sales"  value={formatCurrency(pData.totalSales)} color="#8B5CF6" />
          <StatCard icon={FiCheckCircle}  label="Collected"    value={formatCurrency(pData.collected)} color="#22C55E" />
          <StatCard icon={FiAlertCircle}  label="Outstanding"  value={formatCurrency(pData.outstanding)} color="#EF4444" />
        </div>
      )}

      {/* trend chart */}
      <SalesTrendChart province={selectedProvince} range={range} from={from} to={to} />

      {/* payment breakdown */}
      {!loading && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            💳 Payment Methods
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {Object.entries(pData.paymentBreakdown || {}).filter(([, v]) => v?.amount > 0).map(([method, v]) => {
              const pc = PAYMENT_COLORS[method] || { bg: '#f8fafc', text: '#475569', label: method };
              return (
                <div key={method} className="rounded-xl px-4 py-2.5 text-center min-w-[100px]"
                  style={{ background: pc.bg }}>
                  <p className="text-[10px] font-semibold uppercase" style={{ color: pc.text }}>{pc.label}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: pc.text }}>{formatCurrency(v.amount)}</p>
                  <p className="text-[10px] text-slate-400">{v.count} orders</p>
                </div>
              );
            })}
            {!Object.values(pData.paymentBreakdown || {}).some(v => v?.amount > 0) && (
              <p className="text-xs text-slate-400 col-span-full">No payment data yet.</p>
            )}
          </div>
        </div>
      )}

      {/* orders table */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Orders — {selectedProvince}
        </h3>
        <OrdersTable province={selectedProvince} range={range} from={from} to={to} />
      </div>
    </div>
  );
  }

  /* ── OVERVIEW (all provinces) ────────────────────────── */
  const handleManualInput = (field, value) => {
    if (field === 'salesperson' && user?.role !== 'admin') return;
    setManualSale(prev => ({ ...prev, [field]: value }));
  };

  const handleDealerChange = (dealerId) => {
    const dealer = dealers.find(d => d._id === dealerId);
    if (!dealer) {
      setManualSale(prev => ({ ...prev, dealer: dealerId, province: '', area: '', salesperson: '' }));
      setDealerWarning('');
      setAssignedSalespersonId('');
      setAssignedSalespersonLabel('');
      setAssignedSalespersonRole('');
      return;
    }
    const assignment = getDealerAssignedSalesperson(dealer);
    const baseLabel = assignment.label || salespersons.find(sp => String(sp._id) === String(assignment.id))?.fullName || salespersons.find(sp => String(sp._id) === String(assignment.id))?.name || '';
    const label = baseLabel ? `${baseLabel}(${assignment.role})` : `Assigned ${assignment.role}`;
    setManualSale(prev => ({
      ...prev,
      dealer: dealer._id,
      province: dealer.province || '',
      area: dealer.address || dealer.area || '',
      salesperson: assignment.id,
    }));
    setDealerWarning(assignment.id ? '' : 'No assigned employee found for the selected dealer.');
    setAssignedSalespersonId(String(assignment.id || ''));
    setAssignedSalespersonLabel(label);
    setAssignedSalespersonRole(assignment.role || '');
  };

  useEffect(() => {
    if (manualSale.dealer && dealers.length && salespersons.length) {
      handleDealerChange(manualSale.dealer);
    }
  }, [manualSale.dealer, dealers, salespersons]);

  const handleItemChange = (index, updatedItem) => {
    setManualSale(prev => {
      const items = prev.items.slice();
      items[index] = updatedItem;
      return { ...prev, items };
    });
  };

  const addItemRow = () => {
    setManualSale(prev => ({
      ...prev,
      items: [...(prev.items || []), { product: '', productName: '', customerType: 'MM', ml: '', up: '', quantity: 1, rate: 0, exciseAmount: 0, vatAmount: 0 }],
    }));
  };

  const removeItemRow = (idx) => {
    setManualSale(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const computeItemTotals = (it) => {
    const c = calcRow(it.quantity, it.rate, it.exciseAmount, it.vatAmount);
    return { basic: c.basic, exc: c.excise, vat: c.vat, total: c.total };
  };

  const computeGrandTotal = () =>
    (manualSale.items || []).reduce((s, it) => s + computeItemTotals(it).total, 0);

  const handleOrderSelection = (order) => {
    setSelectedOrder(order);
    setEntryMode('from-order');
    const initialItems = (order.items || []).map(item => ({
      product: item.product?._id || item.product || '',
      productName: item.product?.productName || item.productName || '',
      customerType: item.customerType || 'MM',
      ml: item.ml || '',
      up: item.up || '',
      quantity: item.quantity || 1,
      rate: item.rate || 0,
      exciseAmount: item.exciseAmount || 0,
      vatAmount: item.vatAmount || 0,
    }));
    setManualSale({
      order: order._id,
      date: new Date(order.date || Date.now()).toISOString().split('T')[0],
      salesperson: order.salesperson?._id || order.salesperson || '',
      dealer: order.dealer?._id || order.dealer || '',
      province: order.province || '',
      area: order.area || order.dealer?.address || order.dealer?.area || '',
      items: initialItems.length ? initialItems : [{ product: '', productName: '', customerType: 'MM', ml: '', up: '', quantity: 1, rate: 0, exciseAmount: 0, vatAmount: 0 }],
      grandTotal: order.grandTotal || '',
      collectedAmount: order.collectedAmount || '',
      paymentType: order.paymentMethod || 'cash',
      status: 'completed',
      remarks: order.remarks || '',
    });
  };

  const startManualFlow = () => {
    setSelectedOrder(null);
    setEntryMode('manual');
    setManualSale({
      order: null,
      orderNumber: '',
      date: new Date().toISOString().split('T')[0],
      salesperson: '',
      dealer: '',
      province: '',
      area: '',
      items: [{ product: '', productName: '', customerType: 'MM', ml: '', up: '', quantity: 1, rate: 0, exciseAmount: 0, vatAmount: 0 }],
      grandTotal: '',
      collectedAmount: '',
      paymentType: 'cash',
      status: 'completed',
      remarks: '',
    });
  };

  const loadEligibleOrders = useCallback(async () => {
    if (!user?.role || user.role !== 'admin') return;
    setLoadingOrders(true);
    try {
      const res = await api.get('/sales/eligible-orders');
      setEligibleOrders(res.data.data || []);
    } catch {
      setEligibleOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [user?.role]);

  useEffect(() => { loadEligibleOrders(); }, [loadEligibleOrders]);

  const submitManualSale = async () => {
    const gt = Number(manualSale.grandTotal) || computeGrandTotal();
    if (!manualSale.salesperson || !manualSale.dealer || !manualSale.province || !manualSale.area || !gt) {
      toast.error('Fill dealer, salesperson, amount, province and area before saving.');
      return;
    }
    setSavingSale(true);
    try {
      const items = (manualSale.items || []).map(it => {
        const t = computeItemTotals(it);
        return {
          product: it.product,
          productName: it.productName,
          customerType: it.customerType,
          ml: it.ml,
          up: it.up,
          quantity: Number(it.quantity) || 0,
          rate: Number(it.rate) || 0,
          exciseAmount: Number(it.exciseAmount) || 0,
          vatAmount: Number(it.vatAmount) || 0,
          basicAmount: t.basic,
          grandTotal: t.total,
        };
      });
      const payload = {
        ...manualSale,
        items,
        grandTotal: Number(manualSale.grandTotal) || items.reduce((s, i) => s + (i.grandTotal || 0), 0),
        collectedAmount: manualSale.collectedAmount
          ? Number(manualSale.collectedAmount)
          : (Number(manualSale.grandTotal) || items.reduce((s, i) => s + (i.grandTotal || 0), 0)),
      };

      const endpoint = selectedOrder ? '/sales/from-order' : '/sales/manual';
      if (!selectedOrder) {
        delete payload.order;
        delete payload.orderNumber;
      }
      await api.post(endpoint, payload);
      toast.success(entryMode === 'from-order' ? 'Sale created from order and invoice generated.' : 'Manual sale saved and province totals refreshed.');
      setEntryMode('choice');
      setSelectedOrder(null);
      setManualSale({
        date: new Date().toISOString().split('T')[0],
        salesperson: '',
        dealer: '',
        province: '',
        area: '',
        items: [{ product: '', productName: '', customerType: 'MM', ml: '', up: '', quantity: 1, rate: 0, exciseAmount: 0, vatAmount: 0 }],
        grandTotal: '',
        collectedAmount: '',
        paymentType: 'cash',
        status: 'completed',
        remarks: '',
      });
      fetchStats();
      loadEligibleOrders();
      setOrdersKey(k => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save sale.');
    } finally {
      setSavingSale(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sales</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {user?.role === 'admin' ? 'Enterprise sales entry workflow' : 'Your sales by province'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Filters range={range} from={from} to={to} setParam={setParam} onRefresh={fetchStats} loading={loading} />
          {user?.role === 'admin' && (
            <button onClick={exportCSV} disabled={loading}
              className="flex items-center gap-1.5 btn-primary text-xs px-3 py-2">
              <FiDownload size={13} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {user?.role === 'admin' && entryMode === 'choice' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <button onClick={() => { setEntryMode('from-order'); loadEligibleOrders(); }} className="card p-6 text-left border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all bg-white">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                <FiPackage size={22} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Create From Order</h2>
                <p className="text-sm text-slate-500 mt-1">Convert an existing delivered order into a sale.</p>
              </div>
            </div>
          </button>
          <button onClick={startManualFlow} className="card p-6 text-left border-2 border-slate-200 hover:border-primary-400 hover:shadow-lg transition-all bg-white">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600">
                <FiEdit3 size={22} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Manual Sale</h2>
                <p className="text-sm text-slate-500 mt-1">Create a completely new sale without an existing order.</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {user?.role === 'admin' && entryMode === 'from-order' && (
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Order-Based Sale Entry</p>
              <h2 className="text-lg font-semibold text-slate-900">Select a delivered order to convert</h2>
            </div>
            <button onClick={() => setEntryMode('choice')} className="text-sm text-slate-500 hover:text-primary-600">Back</button>
          </div>
          {loadingOrders ? (
            <div className="grid gap-3 md:grid-cols-2">{Array(4).fill(0).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : !eligibleOrders.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No delivered orders are currently available to convert.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {eligibleOrders.map(order => (
                <button key={order._id} onClick={() => handleOrderSelection(order)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-400 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                    <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-1">Delivered</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{order.dealer?.dealerName} · {order.salesperson?.fullName}</p>
                  <p className="text-xs text-slate-500 mt-2">{order.province} · {order.area}</p>
                  <div className="flex items-center justify-between mt-3 text-sm">
                    <span className="font-semibold text-slate-800">NPR {Number(order.grandTotal || 0).toFixed(2)}</span>
                    <span className="text-primary-600">Open form</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(user?.role !== 'admin' || entryMode === 'manual' || selectedOrder) && (
        <div className="space-y-4">
          <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">{selectedOrder ? 'Sales Entry From Order' : 'Manual Sale Entry'}</p>
                <h2 className="text-lg font-semibold text-slate-900">{selectedOrder ? `Create sale from ${selectedOrder.orderNumber}` : 'Create a sale record'}</h2>
              </div>
              {user?.role === 'admin' && (
                <button onClick={() => { setSelectedOrder(null); setEntryMode('choice'); }} className="text-sm text-slate-500 hover:text-primary-600">Choose another path</button>
              )}
            </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-600">Order Number (Optional)</label>
              <input value={manualSale.orderNumber || ''} onChange={e => handleManualInput('orderNumber', e.target.value)}
                className="input mt-1 w-full text-xs" placeholder="Leave blank to use order reference" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Salesperson</label>
              <select value={manualSale.salesperson} onChange={e => handleManualInput('salesperson', e.target.value)}
                className="input mt-1 w-full text-xs"
                disabled={user?.role !== 'admin'}>
                <option value="">Select salesperson</option>
                {assignedSalespersonId && (
                  <option key={`${assignedSalespersonId}-assigned`} value={assignedSalespersonId}>
                    {assignedSalespersonLabel || 'Assigned sales officer'}
                  </option>
                )}
                {salespersons
                  .filter(sp => String(sp._id) !== assignedSalespersonId)
                  .map(sp => (
                    <option key={sp._id} value={sp._id}>{getStaffName(sp)} · {sp.area}</option>
                  ))}
              </select>
              {assignedSalespersonLabel && (
                <p className="text-xs text-slate-500 mt-1">
                  Assigned from dealer: {assignedSalespersonLabel}
                </p>
              )}
              {user?.role !== 'admin' && (
                <p className="text-xs text-slate-500 mt-1">Salesperson is assigned from dealer hierarchy and cannot be changed.</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Dealer</label>
              <select value={manualSale.dealer} onChange={e => handleDealerChange(e.target.value)}
                className="input mt-1 w-full text-xs">
                <option value="">Select dealer</option>
                {dealers.map(d => (
                  <option key={d._id} value={d._id}>{d.dealerName} · {d.address || d.area}</option>
                ))}
              </select>
              {dealerWarning && (
                <p className="text-xs text-amber-700 mt-1">{dealerWarning}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Province</label>
              <input value={manualSale.province} readOnly className="input mt-1 w-full text-xs bg-slate-50" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Address</label>
              <input value={manualSale.area} readOnly className="input mt-1 w-full text-xs bg-slate-50" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Sale Amount</label>
              <input value={manualSale.grandTotal} onChange={e => handleManualInput('grandTotal', e.target.value)}
                type="number" min="0" step="0.01" className="input mt-1 w-full text-xs" placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Collected Amount</label>
              <input value={manualSale.collectedAmount} onChange={e => handleManualInput('collectedAmount', e.target.value)}
                type="number" min="0" step="0.01" className="input mt-1 w-full text-xs" placeholder="Leave blank = full amount" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Payment Type</label>
              <select value={manualSale.paymentType} onChange={e => handleManualInput('paymentType', e.target.value)}
                className="input mt-1 w-full text-xs">
                {Object.entries(PAYMENT_COLORS).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Sale Status</label>
              <select value={manualSale.status} onChange={e => handleManualInput('status', e.target.value)}
                className="input mt-1 w-full text-xs">
                {SALE_STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mt-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Date</label>
              <input type="date" value={manualSale.date} onChange={e => handleManualInput('date', e.target.value)}
                className="input mt-1 w-full text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Remarks</label>
              <input type="text" value={manualSale.remarks} onChange={e => handleManualInput('remarks', e.target.value)}
                className="input mt-1 w-full text-xs" placeholder="Optional remarks..." />
            </div>
          </div>

          {/* Items Spreadsheet */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100" style={{ background: '#1e3a8a' }}>
              <span className="text-white font-semibold text-sm">📋 Order Items Sheet</span>
              <button type="button" onClick={addItemRow}
                className="flex items-center gap-1 text-xs bg-white text-primary-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50">
                <FiPlus size={12} /> Add Row
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: '#1e40af', color: '#fff' }}>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold w-8">#</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold min-w-40">Product Name</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold w-20">Cust. Type</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold w-20">ML</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold w-20">UP</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold w-20">Quantity</th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold w-24">Rate (NPR)</th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold w-28" style={{ background: '#1e3a8a' }}>Basic Amount</th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold w-28" style={{ background: '#92400e' }}>Excise Amt</th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold w-28" style={{ background: '#1e3a8a' }}>VAT Amt</th>
                    <th className="px-2 py-2.5 text-right text-xs font-semibold w-32" style={{ background: '#14532d' }}>Grand Total</th>
                    <th className="px-2 py-2.5 w-8"></th>
                  </tr>
                  <tr style={{ background: '#dbeafe', fontSize: '10px', color: '#475569' }}>
                    <td></td>
                    <td className="px-2 py-1">Select from list</td>
                    <td className="px-2 py-1 text-center">MM / ADPL</td>
                    <td className="px-2 py-1 text-center">Auto</td>
                    <td className="px-2 py-1 text-center">Auto</td>
                    <td className="px-2 py-1 text-center">Enter qty</td>
                    <td className="px-2 py-1 text-right">Auto-filled</td>
                    <td className="px-2 py-1 text-right font-medium text-blue-700">= Qty × Rate</td>
                    <td className="px-2 py-1 text-right text-orange-600">Auto from product</td>
                    <td className="px-2 py-1 text-right text-blue-600">Auto from product</td>
                    <td className="px-2 py-1 text-right font-bold text-green-700">= Basic+Exc+VAT</td>
                    <td></td>
                  </tr>
                </thead>
                <tbody>
                  {(manualSale.items || []).map((item, idx) => (
                    <SalesItemRow key={idx} index={idx} item={item} products={products}
                      onChange={handleItemChange} onRemove={removeItemRow} />
                  ))}
                  {!manualSale.items?.length && (
                    <tr><td colSpan={12} className="text-center py-8 text-slate-400 text-sm">No items. Click "Add Row" to start.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <SalesTotalsRow items={manualSale.items || []} />
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Sale records created here update province and payment summary totals.
            </div>
            <button onClick={submitManualSale} disabled={savingSale}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-60">
              {savingSale ? 'Saving…' : (selectedOrder ? 'Create Sale' : 'Save Manual Sale')}
            </button>
          </div>
        </div>

        <div className="card p-4 overflow-hidden">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Metrics</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <StatCard icon={FiShoppingCart} label="Province Count" value={provinces.length} color="#2563EB" />
            <StatCard icon={FiDollarSign} label="Average Sale" value={formatCurrency(overall.totalSales / Math.max(1, overall.totalOrders))} color="#8B5CF6" />
            <StatCard icon={FiCheckCircle} label="Collected Ratio" value={`${overall.totalSales ? Math.round((overall.collected / overall.totalSales) * 100) : 0}%`} color="#22C55E" />
            <StatCard icon={FiAlertCircle} label="Outstanding" value={formatCurrency(overall.outstanding)} color="#EF4444" />
          </div>
        </div>
      </div>
      )}

      {/* overall summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={FiShoppingCart} label="Total Orders"      value={overall.totalOrders} color="#2563EB" />
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
            {provinces
              .filter(stat => ['admin', 'nsm', 'rsm'].includes(user?.role) || stat.totalOrders > 0)
              .map(stat => (
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
          All Sales
        </h3>
        <OrdersTable key={ordersKey} province={null} range={range} from={from} to={to} />
      </div>

      {/* staff modal */}
      {staffModal && <ProvinceStaffModal province={staffModal} onClose={() => setStaffModal(null)} />}
    </div>
  );
}

/* ── Filter Controls ─────────────────────────────────── */
function Filters({ range, from, to, setParam, onRefresh, loading }) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select value={range} onChange={e => setParam('range', e.target.value)}
          className="input text-xs py-2 w-full sm:w-36">
          {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setParam('from', e.target.value)}
          className="input text-xs py-2 w-full sm:w-36" placeholder="From" />
        <input type="date" value={to} onChange={e => setParam('to', e.target.value)}
          className="input text-xs py-2 w-full sm:w-36" placeholder="To" />
      </div>
      <button onClick={onRefresh}
        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50">
        <FiRefreshCw size={14} className={loading ? 'animate-spin text-primary-600' : 'text-slate-500'} />
      </button>
    </div>
  );
}
