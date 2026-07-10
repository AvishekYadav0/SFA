import { useState } from 'react';
import { reportService } from '../services';
import { formatCurrency, formatDate } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { FiDownload, FiPrinter, FiBarChart2, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

const REPORT_TYPES = [
  { id: 'sales', label: 'Sales Report' },
  { id: 'collections', label: 'Collection Report' },
  { id: 'lifting', label: 'Lifting Report' },
  { id: 'dealer-outstanding', label: 'Dealer Outstanding' },
  { id: 'salesperson-performance', label: 'Salesperson Performance' },
  { id: 'product-wise', label: 'Product Wise Sales' },
  { id: 'monthly-sales', label: 'Monthly Sales Report' },
  { id: 'province-wise', label: 'Province Wise Sales' },
];

const exportCSV = (data, filename) => {
  if (!data?.length) return toast.error('No data to export');
  const flatten = (obj, prefix = '') =>
    Object.keys(obj).reduce((acc, k) => {
      const val = obj[k];
      const key = prefix ? `${prefix}_${k}` : k;
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        Object.assign(acc, flatten(val, key));
      } else {
        acc[key] = val;
      }
      return acc;
    }, {});
  const flat = data.map(r => flatten(r));
  const keys = [...new Set(flat.flatMap(Object.keys))];
  const csv = [keys.join(','), ...flat.map(row => keys.map(k => `"${row[k] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  URL.revokeObjectURL(url);
};

const ProgressBar = ({ percent }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5">
      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, percent)}%`, backgroundColor: percent >= 100 ? '#22C55E' : percent >= 50 ? '#F59E0B' : '#2563EB' }} />
    </div>
    <span className="text-xs w-8 text-right">{percent}%</span>
  </div>
);

export default function Reports() {
  const [activeReport, setActiveReport] = useState('sales');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', year: new Date().getFullYear() });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const serviceMap = {
        'sales': () => reportService.sales(filters),
        'collections': () => reportService.collections(filters),
        'lifting': () => reportService.lifting(filters),
        'dealer-outstanding': () => reportService.dealerOutstanding(),
        'salesperson-performance': () => reportService.salespersonPerformance(filters),
        'product-wise': () => reportService.productWise(),
        'monthly-sales': () => reportService.monthlySales({ year: filters.year }),
        'province-wise': () => reportService.provinceWise(),
      };
      const res = await serviceMap[activeReport]();
      setData(res.data.data || []);
      if (!res.data.data?.length) toast('No records found for selected filters', { icon: 'ℹ️' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (!data.length) return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl mb-4">
          <FiBarChart2 className="text-3xl text-slate-400" />
        </div>
        <p className="font-medium text-slate-600 dark:text-slate-400">No data available</p>
        <p className="text-sm text-slate-400 mt-1">Apply filters and click Generate Report</p>
      </div>
    );

    if (activeReport === 'sales') return (
      <table className="table">
        <thead><tr><th>Order #</th><th>Date</th><th>Sales Person</th><th>Dealer</th><th>Area</th><th>Basic Amt</th><th>Excise</th><th>VAT</th><th>Grand Total</th></tr></thead>
        <tbody>
          {data.map(o => (
            <tr key={o._id}>
              <td className="font-medium text-primary-600">{o.orderNumber}</td>
              <td>{formatDate(o.date)}</td>
              <td>{o.salesperson?.fullName}</td>
              <td>{o.dealer?.dealerName}</td>
              <td>{o.area || o.dealer?.area}</td>
              <td>{formatCurrency(o.totalBasicAmount)}</td>
              <td>{formatCurrency(o.totalExciseAmount)}</td>
              <td>{formatCurrency(o.totalVatAmount)}</td>
              <td className="font-bold text-primary-600">{formatCurrency(o.grandTotal)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 dark:bg-slate-700/50 font-bold">
            <td colSpan={5} className="text-right text-slate-600 dark:text-slate-300">Totals:</td>
            <td>{formatCurrency(data.reduce((s, o) => s + o.totalBasicAmount, 0))}</td>
            <td>{formatCurrency(data.reduce((s, o) => s + o.totalExciseAmount, 0))}</td>
            <td>{formatCurrency(data.reduce((s, o) => s + o.totalVatAmount, 0))}</td>
            <td className="text-primary-600">{formatCurrency(data.reduce((s, o) => s + o.grandTotal, 0))}</td>
          </tr>
        </tbody>
      </table>
    );

    if (activeReport === 'collections') return (
      <table className="table">
        <thead><tr><th>Dealer</th><th>Area</th><th>Month</th><th>Opening Bal.</th><th>Order Amt.</th><th>Total Due</th><th>Total Coll.</th><th>Closing Bal.</th></tr></thead>
        <tbody>
          {data.map(c => (
            <tr key={c._id}>
              <td className="font-medium">{c.dealer?.dealerName}</td>
              <td>{c.dealer?.area}</td>
              <td>{c.month}</td>
              <td>{formatCurrency(c.openingBalance)}</td>
              <td>{formatCurrency(c.currentOrderAmount)}</td>
              <td className="font-medium">{formatCurrency(c.totalDue)}</td>
              <td className="text-success font-medium">{formatCurrency(c.totalCollection)}</td>
              <td className={c.closingBalance > 0 ? 'text-danger font-bold' : 'text-success font-bold'}>{formatCurrency(c.closingBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    if (activeReport === 'lifting') return (
      <table className="table">
        <thead><tr><th>Order #</th><th>Dealer</th><th>Product</th><th>Ordered</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>Total Lifted</th><th>Remaining</th><th>Progress</th></tr></thead>
        <tbody>
          {data.map(l => (
            <tr key={l._id}>
              <td className="font-medium text-primary-600">{l.order?.orderNumber}</td>
              <td>{l.dealer?.dealerName}</td>
              <td>{l.product?.productName}</td>
              <td className="font-medium">{l.orderedQuantity}</td>
              <td>{l.week1}</td><td>{l.week2}</td><td>{l.week3}</td><td>{l.week4}</td>
              <td className="text-success font-medium">{l.totalLifted}</td>
              <td className={l.remainingQuantity < 0 ? 'text-danger' : ''}>{l.remainingQuantity}</td>
              <td className="min-w-28"><ProgressBar percent={l.progressPercent} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    if (activeReport === 'dealer-outstanding') return (
      <table className="table">
        <thead><tr><th>Dealer</th><th>Area</th><th>Total Due</th><th>Total Collection</th><th>Outstanding Balance</th></tr></thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td className="font-medium">{d.dealerName}</td>
              <td>{d.area}</td>
              <td>{formatCurrency(d.totalDue)}</td>
              <td className="text-success font-medium">{formatCurrency(d.totalCollection)}</td>
              <td className={d.closingBalance > 0 ? 'text-danger font-bold' : 'text-success font-bold'}>{formatCurrency(d.closingBalance)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 dark:bg-slate-700/50 font-bold">
            <td colSpan={2} className="text-right text-slate-600 dark:text-slate-300">Totals:</td>
            <td>{formatCurrency(data.reduce((s, d) => s + d.totalDue, 0))}</td>
            <td className="text-success">{formatCurrency(data.reduce((s, d) => s + d.totalCollection, 0))}</td>
            <td className="text-danger">{formatCurrency(data.reduce((s, d) => s + d.closingBalance, 0))}</td>
          </tr>
        </tbody>
      </table>
    );

    if (activeReport === 'salesperson-performance') return (
      <>
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="totalSales" fill="#2563EB" radius={[6, 6, 0, 0]} name="Total Sales" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="table">
          <thead><tr><th>Rank</th><th>Sales Person</th><th>Province</th><th>Designation</th><th>Total Orders</th><th>Total Sales</th></tr></thead>
          <tbody>
            {data.map((sp, i) => (
              <tr key={i}>
                <td><span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs font-bold inline-flex items-center justify-center">{i + 1}</span></td>
                <td className="font-medium">{sp.name}</td>
                <td>{sp.province}</td>
                <td>{sp.designation}</td>
                <td>{sp.orderCount}</td>
                <td className="font-bold text-primary-600">{formatCurrency(sp.totalSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );

    if (activeReport === 'product-wise') return (
      <table className="table">
        <thead><tr><th>Product</th><th>Brand</th><th>Category</th><th>Total Qty</th><th>Total Amount</th></tr></thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={i}>
              <td className="font-medium">{p.productName}</td>
              <td>{p.brand}</td>
              <td>{p.category}</td>
              <td className="font-medium">{p.totalQty}</td>
              <td className="font-bold text-primary-600">{formatCurrency(p.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

    if (activeReport === 'monthly-sales') return (
      <>
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="totalSales" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} name="Total Sales" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <table className="table">
          <thead><tr><th>Month</th><th>Orders</th><th>Basic Amount</th><th>Excise</th><th>VAT</th><th>Total Sales</th></tr></thead>
          <tbody>
            {data.map((m, i) => (
              <tr key={i}>
                <td className="font-medium">{m.month}</td>
                <td>{m.orderCount}</td>
                <td>{formatCurrency(m.totalBasic)}</td>
                <td>{formatCurrency(m.totalExcise)}</td>
                <td>{formatCurrency(m.totalVat)}</td>
                <td className="font-bold text-primary-600">{formatCurrency(m.totalSales)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 dark:bg-slate-700/50 font-bold">
              <td>Annual Total</td>
              <td>{data.reduce((s, m) => s + m.orderCount, 0)}</td>
              <td>{formatCurrency(data.reduce((s, m) => s + m.totalBasic, 0))}</td>
              <td>{formatCurrency(data.reduce((s, m) => s + m.totalExcise, 0))}</td>
              <td>{formatCurrency(data.reduce((s, m) => s + m.totalVat, 0))}</td>
              <td className="text-primary-600">{formatCurrency(data.reduce((s, m) => s + m.totalSales, 0))}</td>
            </tr>
          </tbody>
        </table>
      </>
    );

    if (activeReport === 'province-wise') return (
      <>
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="_id" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="totalSales" fill="#22C55E" radius={[6, 6, 0, 0]} name="Total Sales" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="table">
          <thead><tr><th>Province</th><th>Total Orders</th><th>Total Sales</th></tr></thead>
          <tbody>
            {data.map((a, i) => (
              <tr key={i}>
                <td className="font-medium">{a._id || 'N/A'}</td>
                <td>{a.orderCount}</td>
                <td className="font-bold text-primary-600">{formatCurrency(a.totalSales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Generate and export business reports</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => exportCSV(data, activeReport)} disabled={!data.length}>
            <FiDownload />Export CSV
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            <FiPrinter />Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="card p-3 space-y-1 h-fit">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-3">Report Types</p>
          {REPORT_TYPES.map(r => (
            <button key={r.id} onClick={() => { setActiveReport(r.id); setData([]); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeReport === r.id ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-end gap-4">
              {activeReport === 'monthly-sales' ? (
                <div>
                  <label className="label">Year</label>
                  <input type="number" className="input w-32" value={filters.year}
                    onChange={e => setFilters(f => ({ ...f, year: e.target.value }))} min={2020} max={2099} />
                </div>
              ) : (
                <>
                  <div>
                    <label className="label">Start Date</label>
                    <input type="date" className="input" value={filters.startDate}
                      onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input type="date" className="input" value={filters.endDate}
                      onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </>
              )}
              <button className="btn-primary" onClick={fetchReport} disabled={loading}>
                {loading ? <FiRefreshCw className="animate-spin" /> : <FiBarChart2 />}
                {loading ? 'Loading...' : 'Generate Report'}
              </button>
              {data.length > 0 && (
                <span className="text-sm text-slate-500 ml-auto">{data.length} records</span>
              )}
            </div>
          </div>

          <div className="card p-0">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {REPORT_TYPES.find(r => r.id === activeReport)?.label}
              </h3>
            </div>
            <div className="p-4">
              {loading ? <PageLoader /> : (
                <div className="table-wrapper">{renderContent()}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
