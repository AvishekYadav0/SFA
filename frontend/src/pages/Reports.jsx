import { useState, useMemo, useEffect } from 'react';
import { reportService } from '../services';
import { formatCurrency, formatDate } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { FiDownload, FiPrinter, FiBarChart2, FiRefreshCw, FiSearch, FiShare2, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

/* ------------------------------------------------------------------ *
 * BACKEND REQUIREMENT
 * This file assumes reportService already has the 8 original methods
 * (sales, collections, lifting, dealerOutstanding,
 * salespersonPerformance, productWise, monthlySales, provinceWise)
 * PLUS four new ones you'll need to add on the backend + service layer,
 * matching the same call shape:
 *
 *   reportService.targetAchievement(filters)   -> [{ staffName, role, period,
 *       salesTarget, salesAchieved, collectionTarget, collectionAchieved }]
 *   reportService.dealerHierarchy(filters)     -> [{ soleDealerName, dealerName,
 *       region, orderCount, totalSales, totalCollection, closingBalance }]
 *   reportService.orderStatus(filters)         -> [{ orderNumber, date,
 *       dealerName, salespersonName, status, dispatchStatus, grandTotal }]
 *   reportService.staffHierarchy(filters)      -> [{ name, role, managerName,
 *       territory, subordinateCount, totalSales, totalCollection, targetPct }]
 * ------------------------------------------------------------------ */

// ---------- generic helpers ----------

const getVal = (row, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), row);

const fmt = (val, type) => {
  if (val == null || val === '') return '-';
  if (type === 'currency') return formatCurrency(val);
  if (type === 'date') return formatDate(val);
  return val;
};

const flattenForExport = (data, columns) => {
  return data.map((row) => {
    const out = {};
    columns.forEach((c) => {
      const raw = c.exportValue ? c.exportValue(row) : getVal(row, c.key);
      out[c.label] = c.format === 'currency' ? Number(raw) || 0 : c.format === 'date' ? formatDate(raw) : raw;
    });
    return out;
  });
};

const exportExcel = (data, columns, filename) => {
  if (!data?.length) return toast.error('No data to export');
  const rows = flattenForExport(data, columns);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, filename.slice(0, 31));
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

const shareWhatsApp = (reportLabel, data, columns) => {
  if (!data?.length) return toast.error('No data to share');
  const sumCol = columns.find((c) => c.sum && c.format === 'currency');
  const total = sumCol ? data.reduce((s, r) => s + (Number(getVal(r, sumCol.key)) || 0), 0) : null;
  const lines = [
    `*${reportLabel}*`,
    `Generated: ${formatDate(new Date())}`,
    `Records: ${data.length}`,
  ];
  if (total !== null) lines.push(`${sumCol.label}: ${formatCurrency(total)}`);
  lines.push('', '(Exported from SFA System)');
  const text = encodeURIComponent(lines.join('\n'));
  window.open(`https://wa.me/?text=${text}`, '_blank');
};

const ProgressBar = ({ percent }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full"
        style={{ width: `${Math.min(100, percent || 0)}%`, backgroundColor: percent >= 100 ? '#22C55E' : percent >= 50 ? '#F59E0B' : '#2563EB' }}
      />
    </div>
    <span className="text-xs w-8 text-right">{Math.round(percent || 0)}%</span>
  </div>
);

const STATUS_COLORS = {
  Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Dispatched: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Dispatch Pending': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
    {status || '-'}
  </span>
);

// ---------- report configs ----------
// Each column: { key, label, format?: 'currency'|'date', sum?: bool, className?, render?(row,i), exportValue?(row) }

const REPORT_CONFIGS = {
  sales: {
    label: 'Sales Report',
    fetch: (f) => reportService.sales(f),
    dateFilter: true,
    columns: [
      { key: 'orderNumber', label: 'Order #', className: 'font-medium text-primary-600' },
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'se.name', label: 'Sales Person', exportValue: (r) => r.se?.name || r.se?.fullName },
      { key: 'dealer.dealerName', label: 'Dealer' },
      { key: 'area', label: 'Area', exportValue: (r) => r.area || r.dealer?.area },
      { key: 'totalBasicAmount', label: 'Basic Amt', format: 'currency', sum: true },
      { key: 'totalExciseAmount', label: 'Excise', format: 'currency', sum: true },
      { key: 'totalVatAmount', label: 'VAT', format: 'currency', sum: true },
      { key: 'grandTotal', label: 'Grand Total', format: 'currency', sum: true, className: 'font-bold text-primary-600' },
    ],
  },
  collections: {
    label: 'Collection Report',
    fetch: (f) => reportService.collections(f),
    dateFilter: true,
    columns: [
      { key: 'dealer.dealerName', label: 'Dealer', className: 'font-medium' },
      { key: 'dealer.area', label: 'Area' },
      { key: 'month', label: 'Month' },
      { key: 'openingBalance', label: 'Opening Bal.', format: 'currency' },
      { key: 'currentOrderAmount', label: 'Order Amt.', format: 'currency' },
      { key: 'totalDue', label: 'Total Due', format: 'currency', sum: true },
      { key: 'totalCollection', label: 'Total Coll.', format: 'currency', sum: true, className: 'text-success font-medium' },
      { key: 'closingBalance', label: 'Closing Bal.', format: 'currency', sum: true, className: (v) => (v > 0 ? 'text-danger font-bold' : 'text-success font-bold') },
    ],
  },
  lifting: {
    label: 'Lifting Report',
    fetch: (f) => reportService.lifting(f),
    dateFilter: true,
    columns: [
      { key: 'order.orderNumber', label: 'Order #', className: 'font-medium text-primary-600' },
      { key: 'dealer.dealerName', label: 'Dealer' },
      { key: 'product.productName', label: 'Product' },
      { key: 'orderedQuantity', label: 'Ordered', className: 'font-medium' },
      { key: 'week1', label: 'W1' },
      { key: 'week2', label: 'W2' },
      { key: 'week3', label: 'W3' },
      { key: 'week4', label: 'W4' },
      { key: 'totalLifted', label: 'Total Lifted', sum: true, className: 'text-success font-medium' },
      { key: 'remainingQuantity', label: 'Remaining', className: (v) => (v < 0 ? 'text-danger' : '') },
      { key: 'progressPercent', label: 'Progress', render: (r) => <ProgressBar percent={r.progressPercent} /> },
    ],
  },
  'product-wise': {
    label: 'Product Wise Sales',
    fetch: (f) => reportService.productWise(f),
    dateFilter: true,
    chart: (data) => (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data.slice(0, 10)} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="productName" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => (typeof v === 'number' ? v.toLocaleString() : v)} />
          <Legend />
          <Bar dataKey="totalQty" fill="#2563EB" radius={[6, 6, 0, 0]} name="Qty Sold" />
          <Bar dataKey="totalAmount" fill="#22C55E" radius={[6, 6, 0, 0]} name="Sales Amount" />
        </BarChart>
      </ResponsiveContainer>
    ),
    columns: [
      { key: 'productName', label: 'Product', className: 'font-medium' },
      { key: 'brand', label: 'Brand' },
      { key: 'category', label: 'Category' },
      { key: 'totalQty', label: 'Total Qty', sum: true, className: 'font-medium' },
      { key: 'totalAmount', label: 'Total Amount', format: 'currency', sum: true, className: 'font-bold text-primary-600' },
    ],
  },
  'monthly-sales': {
    label: 'Monthly Sales Report',
    fetch: (f) => reportService.monthlySales({ year: f.year }),
    yearFilter: true,
    chart: (data) => (
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
    ),
    columns: [
      { key: 'month', label: 'Month', className: 'font-medium' },
      { key: 'orderCount', label: 'Orders' },
      { key: 'totalBasic', label: 'Basic Amount', format: 'currency', sum: true },
      { key: 'totalExcise', label: 'Excise', format: 'currency', sum: true },
      { key: 'totalVat', label: 'VAT', format: 'currency', sum: true },
      { key: 'totalSales', label: 'Total Sales', format: 'currency', sum: true, className: 'font-bold text-primary-600' },
    ],
  },
  'province-wise': {
    label: 'Province Wise Sales',
    fetch: () => reportService.provinceWise(),
    chart: (data) => (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="_id" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => formatCurrency(v)} />
          <Bar dataKey="totalSales" fill="#22C55E" radius={[6, 6, 0, 0]} name="Total Sales" />
        </BarChart>
      </ResponsiveContainer>
    ),
    columns: [
      { key: '_id', label: 'Province', className: 'font-medium', exportValue: (r) => r._id || 'N/A' },
      { key: 'orderCount', label: 'Total Orders' },
      { key: 'totalSales', label: 'Total Sales', format: 'currency', sum: true, className: 'font-bold text-primary-600' },
    ],
  },
  'dealer-hierarchy': {
    label: 'Dealer Hierarchy Report',
    fetch: (f) => reportService.dealerHierarchy(f),
    dateFilter: true,
    columns: [
      { key: 'soleDealerName', label: 'Sole Dealer', className: 'font-medium', exportValue: (r) => r.soleDealerName || r.distributor || '-' },
      { key: 'dealerName', label: 'Dealer' },
      { key: 'area', label: 'Area' },
      { key: 'province', label: 'Province' },
      { key: 'orderCount', label: 'Orders' },
      { key: 'totalSales', label: 'Total Sales', format: 'currency', sum: true, className: 'font-bold text-primary-600' },
      { key: 'totalCollection', label: 'Total Collection', format: 'currency', sum: true, className: 'text-success font-medium' },
      { key: 'outstanding', label: 'Outstanding', format: 'currency', sum: true, className: (v) => (v > 0 ? 'text-danger font-bold' : 'text-success font-bold') },
    ],
  },
  'order-status': {
    label: 'Order Status Tracking',
    fetch: (f) => reportService.orderStatus(f),
    dateFilter: true,
    columns: [
      { key: 'orderNumber', label: 'Order #', className: 'font-medium text-primary-600' },
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'dealer.dealerName', label: 'Dealer', exportValue: (r) => r.dealer?.dealerName },
      { key: 'se.name', label: 'Sales Person', exportValue: (r) => r.se?.name || r.se?.fullName },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} />, exportValue: (r) => r.status },
      { key: 'grandTotal', label: 'Grand Total', format: 'currency', sum: true, className: 'font-bold text-primary-600' },
    ],
  },
  'staff-hierarchy': {
    label: 'Staff Hierarchy (Manager-wise)',
    fetch: (f) => reportService.staffHierarchy(f),
    dateFilter: true,
    columns: [
      { key: 'name', label: 'Staff', className: 'font-medium' },
      { key: 'province', label: 'Province' },
      { key: 'designation', label: 'Designation' },
      { key: 'orderCount', label: 'Orders' },
      { key: 'totalSales', label: 'Total Sales', format: 'currency', sum: true, className: 'font-bold text-primary-600' },
    ],
  },
  'dealer-stock': {
    label: 'Dealer Stock Report',
    fetch: (f) => reportService.dealerStock(f),
    columns: [
      { key: 'dealerName',     label: 'Dealer',          className: 'font-medium' },
      { key: 'area',           label: 'Area' },
      { key: 'province',       label: 'Province' },
      { key: 'productName',    label: 'Product',         className: 'font-medium' },
      { key: 'openingStock',   label: 'Opening',         sum: true },
      { key: 'companyDispatch',label: 'Dispatch',        sum: true },
      { key: 'dealerSales',    label: 'Sales',           sum: true, className: 'text-green-600 font-medium' },
      { key: 'closingStock',   label: 'Closing',         sum: true, className: 'font-bold text-blue-600' },
      { key: 'minimumStock',   label: 'Min Stock' },
      { key: 'stockStatus',    label: 'Status',
        render: (r) => {
          const c = r.stockStatus === 'Healthy' ? 'bg-green-100 text-green-700' : r.stockStatus === 'Low Stock' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
          return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c}`}>{r.stockStatus}</span>;
        },
        exportValue: (r) => r.stockStatus,
      },
    ],
  },
  'stock-movement': {
    label: 'Stock Movement Report',
    fetch: (f) => reportService.stockMovement(f),
    dateFilter: true,
    columns: [
      { key: 'transactionDate', label: 'Date',    format: 'date' },
      { key: 'dealer.dealerName', label: 'Dealer', exportValue: (r) => r.dealer?.dealerName },
      { key: 'product.productName', label: 'Product', exportValue: (r) => r.product?.productName },
      { key: 'transactionType', label: 'Type',    className: 'font-medium' },
      { key: 'quantity',        label: 'Qty',     sum: true, className: 'font-medium' },
      { key: 'remarks',         label: 'Remarks', exportValue: (r) => r.remarks || r.reason || '' },
      { key: 'createdBy.name',  label: 'By',      exportValue: (r) => r.createdBy?.name },
    ],
  },
  'low-stock': {
    label: 'Low Stock Report',
    fetch: () => reportService.lowStock(),
    columns: [
      { key: 'dealerName',   label: 'Dealer',      className: 'font-medium' },
      { key: 'area',         label: 'Area' },
      { key: 'province',     label: 'Province' },
      { key: 'productName',  label: 'Product',     className: 'font-medium' },
      { key: 'minimumStock', label: 'Min Stock' },
      { key: 'closingStock', label: 'Current Stock', className: 'font-bold text-red-600' },
      { key: 'stockStatus',  label: 'Status',
        render: (r) => {
          const c = r.stockStatus === 'Out of Stock' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700';
          return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c}`}>{r.stockStatus}</span>;
        },
        exportValue: (r) => r.stockStatus,
      },
    ],
  },
  'dealer-sales-stock': {
    label: 'Dealer Sales Report',
    fetch: (f) => reportService.dealerSalesStock(f),
    dateFilter: true,
    columns: [
      { key: 'transactionDate',       label: 'Date',    format: 'date' },
      { key: 'dealer.dealerName',     label: 'Dealer',  exportValue: (r) => r.dealer?.dealerName },
      { key: 'dealer.area',           label: 'Area',    exportValue: (r) => r.dealer?.area },
      { key: 'product.productName',   label: 'Product', exportValue: (r) => r.product?.productName },
      { key: 'quantity',              label: 'Qty Sold', sum: true, className: 'font-bold text-green-600' },
      { key: 'remarks',               label: 'Remarks' },
      { key: 'createdBy.name',        label: 'Recorded By', exportValue: (r) => r.createdBy?.name },
    ],
  },
  'damage-expiry': {
    label: 'Damage / Expiry Report',
    fetch: (f) => reportService.damageExpiry(f),
    dateFilter: true,
    columns: [
      { key: 'transactionDate',       label: 'Date',    format: 'date' },
      { key: 'dealer.dealerName',     label: 'Dealer',  exportValue: (r) => r.dealer?.dealerName },
      { key: 'product.productName',   label: 'Product', exportValue: (r) => r.product?.productName },
      { key: 'transactionType',       label: 'Type',    className: 'font-medium text-red-600' },
      { key: 'quantity',              label: 'Qty',     sum: true, className: 'font-bold text-red-600' },
      { key: 'reason',                label: 'Reason' },
      { key: 'remarks',               label: 'Remarks' },
      { key: 'createdBy.name',        label: 'By',      exportValue: (r) => r.createdBy?.name },
    ],
  },
};

const REPORT_TYPES = Object.entries(REPORT_CONFIGS).map(([id, c]) => ({ id, label: c.label }));

const STOCK_REPORT_IDS = new Set(['dealer-stock','stock-movement','low-stock','dealer-sales-stock','damage-expiry']);

const normalizeReportData = (reportId, payload) => {
  if (Array.isArray(payload)) {
    if (reportId === 'product-wise') {
      return payload.map((row) => ({ ...row, productName: row.productName || row._id, totalQty: row.totalQty ?? row.qty, totalAmount: row.totalAmount ?? row.total }));
    }
    if (reportId === 'province-wise') {
      return payload.map((row) => ({ ...row, orderCount: row.orderCount ?? row.count, totalSales: row.totalSales ?? row.total }));
    }
    if (reportId === 'monthly-sales') {
      return payload.map((row) => ({ ...row, month: row.month || row._id, orderCount: row.orderCount ?? row.count, totalSales: row.totalSales ?? row.total }));
    }
    return payload;
  }
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  if (payload && Array.isArray(payload.byDealer)) return payload.byDealer;
  return [];
};

// ---------- generic sortable/searchable table ----------

function ReportTable({ data, columns }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const rowText = (row) =>
    columns
      .map((c) => (c.exportValue ? c.exportValue(row) : getVal(row, c.key)))
      .join(' ')
      .toLowerCase();

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const term = search.toLowerCase();
    return data.filter((row) => rowText(row).includes(term));
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    const list = [...filtered];
    list.sort((a, b) => {
      const av = col.exportValue ? col.exportValue(a) : getVal(a, sortKey);
      const bv = col.exportValue ? col.exportValue(b) : getVal(b, sortKey);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [filtered, sortKey, sortDir, columns]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const cellClass = (col, val) => (typeof col.className === 'function' ? col.className(val) : col.className || '');

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl mb-4">
          <FiBarChart2 className="text-3xl text-slate-400" />
        </div>
        <p className="font-medium text-slate-600 dark:text-slate-400">No data available</p>
        <p className="text-sm text-slate-400 mt-1">Apply filters and click Generate Report</p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-3 max-w-xs">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
        <input
          className="input pl-9 py-1.5 text-sm"
          placeholder="Search this report..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className="cursor-pointer select-none hover:text-primary-600"
                title="Click to sort"
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sortKey === c.key && (sortDir === 'asc' ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row._id || i}>
              {columns.map((c) => {
                const raw = c.exportValue ? c.exportValue(row) : getVal(row, c.key);
                return (
                  <td key={c.key} className={cellClass(c, raw)}>
                    {c.render ? c.render(row, i) : fmt(raw, c.format)}
                  </td>
                );
              })}
            </tr>
          ))}
          {columns.some((c) => c.sum) && (
            <tr className="bg-slate-50 dark:bg-slate-700/50 font-bold">
              {columns.map((c, i) => {
                if (!c.sum) {
                  return (
                    <td key={c.key} className="text-slate-600 dark:text-slate-300">
                      {i === 0 ? 'Totals:' : ''}
                    </td>
                  );
                }
                const total = sorted.reduce((s, r) => s + (Number(c.exportValue ? c.exportValue(r) : getVal(r, c.key)) || 0), 0);
                return (
                  <td key={c.key} className={cellClass(c, total)}>
                    {fmt(total, c.format)}
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- main page ----------

export default function Reports() {
  const [activeReport, setActiveReport] = useState('sales');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ range: 'all', startDate: '', endDate: '', year: new Date().getFullYear() });

  const config = REPORT_CONFIGS[activeReport];

  const fetchReport = async () => {
    setLoading(true);
    try {
      // Strip empty/undefined values so backend doesn't receive empty strings
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v != null)
      );
      const res = await config.fetch(cleanFilters);
      const payload = res.data?.data ?? res.data;
      const nextData = normalizeReportData(activeReport, payload);
      setData(nextData);
      if (!nextData.length) toast('No records found for selected filters', { icon: 'ℹ\uFE0F' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Stock reports require explicit Generate click — don't auto-fetch on tab switch
    if (STOCK_REPORT_IDS.has(activeReport)) return;
    fetchReport();
  }, [activeReport]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Generate and export business reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => exportExcel(data, config.columns, activeReport)} disabled={!data.length}>
            <FiDownload />Export
          </button>
          <button className="btn-secondary" onClick={() => window.print()} disabled={!data.length}>
            <FiPrinter />Print
          </button>
          <button className="btn-secondary" onClick={() => shareWhatsApp(config.label, data, config.columns)} disabled={!data.length}>
            <FiShare2 />Share
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="card p-3 space-y-1 h-fit">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-3">Report Types</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
          {REPORT_TYPES.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setActiveReport(r.id);
                setData([]);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                activeReport === r.id ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-end gap-4">
              {config.dateFilter && (
                <div className="flex flex-wrap gap-1.5">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, range: option.value }))}
                      className={`px-2.5 py-1.5 text-xs rounded-xl border transition ${filters.range === option.value ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 hover:border-slate-300'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              {config.yearFilter ? (
                <div>
                  <label className="label">Year</label>
                  <input
                    type="number"
                    className="input w-32"
                    value={filters.year}
                    onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
                    min={2020}
                    max={2099}
                  />
                </div>
              ) : config.dateFilter ? (
                <>
                  <div>
                    <label className="label">Start Date</label>
                    <input type="date" className="input" value={filters.startDate} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input type="date" className="input" value={filters.endDate} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </>
              ) : null}
              <button className="btn-primary" onClick={fetchReport} disabled={loading}>
                {loading ? <FiRefreshCw className="animate-spin" /> : <FiBarChart2 />}
                {loading ? 'Loading...' : 'Generate Report'}
              </button>
              {data.length > 0 && <span className="text-sm text-slate-500 ml-auto">{data.length} records</span>}
            </div>
          </div>

          <div className="space-y-4">
            {activeReport === 'product-wise' && data.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {['Qty Sold', 'Sales Amount', 'Top Product'].map((title, index) => {
                  const sorted = [...data].sort((a, b) => {
                    if (title === 'Sales Amount') return (b.totalAmount || 0) - (a.totalAmount || 0);
                    if (title === 'Top Product') return (b.totalQty || 0) - (a.totalQty || 0);
                    return (b.totalQty || 0) - (a.totalQty || 0);
                  });
                  const product = sorted[0] || {};
                  return (
                    <div key={title} className="card p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">{title}</p>
                      <p className="text-3xl font-bold text-slate-900 dark:text-white">
                        {title === 'Sales Amount' ? formatCurrency(product.totalAmount || 0) : product.productName || '—'}
                      </p>
                      {title !== 'Sales Amount' && (
                        <p className="text-sm text-slate-500 mt-1">{product.brand || 'Unknown brand'}</p>
                      )}
                      {title === 'Top Product' && (
                        <p className="text-sm text-slate-500 mt-2">Qty sold: {product.totalQty || 0}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="card p-0" id="report-print-area">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">{config.label}</h3>
              </div>
              <div className="p-4">
                {loading ? (
                  <PageLoader />
                ) : (
                  <>
                    {config.chart && data.length > 0 && <div className="mb-6">{config.chart(data)}</div>}
                    <div className="table-wrapper">
                      <ReportTable data={data} columns={config.columns} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles: only the report card prints, sidebar/filters/buttons hidden */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-print-area, #report-print-area * { visibility: visible; }
          #report-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
