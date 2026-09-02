import { useState, useEffect, useCallback } from 'react';
import { FiPackage, FiTruck, FiLayers, FiShoppingCart, FiRefreshCw, FiArchive, FiPlus, FiPrinter, FiDownload, FiX } from 'react-icons/fi';
import { dealerService, productService, stockStatusService } from '../services';
import { PageLoader } from '../components/common/Spinner';
import toast from 'react-hot-toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const fmtN = (n) => new Intl.NumberFormat('en-NP').format(n || 0);

// ── KPI Card (same design as Dashboard) ──────────────────────────────────────
function KPI({ icon: Icon, label, value, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green:  'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    red:    'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    teal:   'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  };
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon className="text-lg" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-tight">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white truncate leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <FiX className="text-slate-500" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Record Dealer Sales Modal ─────────────────────────────────────────────────
function RecordSalesModal({ dealers, products, rows, defaultDealerId, onClose, onSaved }) {
  const [form, setForm] = useState({ dealer: defaultDealerId || '', product: '', quantity: '', date: new Date().toISOString().slice(0, 10), remarks: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Derive available stock from already-loaded table rows (no extra API call)
  const available = form.dealer && form.product
    ? (rows.find(r => String(r.dealerId) === form.dealer && String(r.productId) === form.product)?.closingStock ?? null)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await stockStatusService.recordSales({
        dealerId: form.dealer,
        productId: form.product,
        quantity: Number(form.quantity),
        transactionDate: form.date,
        remarks: form.remarks,
      });
      toast.success('Dealer sales recorded successfully!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record sales');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Record Dealer Sales" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Dealer</label>
          <select required value={form.dealer} onChange={e => set('dealer', e.target.value)} className="input w-full">
            <option value="">Select Dealer</option>
            {dealers.map(d => <option key={d._id} value={d._id}>{d.dealerName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Product</label>
          <select required value={form.product} onChange={e => set('product', e.target.value)} className="input w-full">
            <option value="">Select Product</option>
            {/* Show only products this dealer has stock for */}
            {(form.dealer
              ? rows.filter(r => String(r.dealerId) === form.dealer && r.closingStock > 0).map(r => ({ _id: String(r.productId), productName: r.productName }))
              : products
            ).map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Quantity</label>
          <input required type="number" min="1" max={available ?? undefined} value={form.quantity} onChange={e => set('quantity', e.target.value)} className="input w-full" placeholder="Enter quantity" />
          {available !== null && (
            <p className={`text-xs mt-1 font-medium ${available === 0 ? 'text-red-500' : 'text-green-600'}`}>
              Available stock: {available} units
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
          <input required type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Remarks</label>
          <input value={form.remarks} onChange={e => set('remarks', e.target.value)} className="input w-full" placeholder="Optional remarks" />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Record Sales'}</button>
        </div>
      </form>
    </Modal>
  );
}

const ADJUSTMENT_TYPES = [
  { value: 'ADJUSTMENT_IN',      label: 'Adjustment In'       },
  { value: 'ADJUSTMENT_OUT',     label: 'Adjustment Out'      },
  { value: 'DAMAGE',             label: 'Damage'              },
  { value: 'EXPIRED',            label: 'Expired'             },
  { value: 'SAMPLE',             label: 'Sample'              },
  { value: 'PROMOTIONAL',        label: 'Promotional'         },
  { value: 'RETURN_TO_COMPANY',  label: 'Return to Company'   },
];

// ── Stock Adjustment Modal ────────────────────────────────────────────────────
function StockAdjustmentModal({ dealers, products, onClose, onSaved }) {
  const [form, setForm] = useState({
    dealer: '', product: '', transactionType: 'ADJUSTMENT_IN',
    quantity: '', date: new Date().toISOString().slice(0, 10), reason: '', remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await stockStatusService.createAdjust({
        dealerId:        form.dealer,
        productId:       form.product,
        transactionType: form.transactionType,
        quantity:        Number(form.quantity),
        transactionDate: form.date,
        reason:          form.reason,
        remarks:         form.remarks,
      });
      toast.success('Stock adjustment saved!');
      onSaved();
      onClose();
    } catch (err) {
      const msg   = err.response?.data?.message || 'Failed to save adjustment';
      const avail = err.response?.data?.available;
      if (avail !== undefined) setAvailable(avail);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Stock Adjustment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Dealer</label>
          <select required value={form.dealer} onChange={e => { set('dealer', e.target.value); setAvailable(null); }} className="input w-full">
            <option value="">Select Dealer</option>
            {dealers.map(d => <option key={d._id} value={d._id}>{d.dealerName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Product</label>
          <select required value={form.product} onChange={e => { set('product', e.target.value); setAvailable(null); }} className="input w-full">
            <option value="">Select Product</option>
            {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Adjustment Type</label>
          <select value={form.transactionType} onChange={e => set('transactionType', e.target.value)} className="input w-full">
            {ADJUSTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Quantity</label>
          <input required type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} className="input w-full" placeholder="Enter quantity" />
          {available !== null && <p className="text-xs text-orange-500 mt-1">Available stock: {available} units</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
          <input required type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Reason <span className="text-red-400">*</span></label>
          <input required value={form.reason} onChange={e => set('reason', e.target.value)} className="input w-full" placeholder="Reason for adjustment" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Remarks</label>
          <input value={form.remarks} onChange={e => set('remarks', e.target.value)} className="input w-full" placeholder="Optional remarks" />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Adjustment'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Stock Transfer Modal ──────────────────────────────────────────────────────
function StockTransferModal({ dealers, products, onClose, onSaved }) {
  const [form, setForm] = useState({
    sourceDealerId: '', destinationDealerId: '', productId: '',
    quantity: '', date: new Date().toISOString().slice(0, 10), remarks: '',
  });
  const [saving,    setSaving]    = useState(false);
  const [available, setAvailable] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.sourceDealerId === form.destinationDealerId)
      return toast.error('Source and destination dealer cannot be the same');
    setSaving(true);
    try {
      await stockStatusService.createTransfer({
        sourceDealerId:      form.sourceDealerId,
        destinationDealerId: form.destinationDealerId,
        productId:           form.productId,
        quantity:            Number(form.quantity),
        transactionDate:     form.date,
        remarks:             form.remarks,
      });
      toast.success('Stock transferred successfully!');
      onSaved();
      onClose();
    } catch (err) {
      const msg   = err.response?.data?.message || 'Transfer failed';
      const avail = err.response?.data?.available;
      if (avail !== undefined) setAvailable(avail);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Stock Transfer" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Source Dealer</label>
          <select required value={form.sourceDealerId} onChange={e => { set('sourceDealerId', e.target.value); setAvailable(null); }} className="input w-full">
            <option value="">Select Source Dealer</option>
            {dealers.map(d => <option key={d._id} value={d._id}>{d.dealerName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Destination Dealer</label>
          <select required value={form.destinationDealerId} onChange={e => set('destinationDealerId', e.target.value)} className="input w-full">
            <option value="">Select Destination Dealer</option>
            {dealers.map(d => <option key={d._id} value={d._id}>{d.dealerName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Product</label>
          <select required value={form.productId} onChange={e => { set('productId', e.target.value); setAvailable(null); }} className="input w-full">
            <option value="">Select Product</option>
            {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Quantity</label>
          <input required type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} className="input w-full" placeholder="Enter quantity" />
          {available !== null && <p className="text-xs text-orange-500 mt-1">Source dealer available: {available} units</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
          <input required type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Remarks</label>
          <input value={form.remarks} onChange={e => set('remarks', e.target.value)} className="input w-full" placeholder="Optional remarks" />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Transferring...' : 'Transfer Stock'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StockStatus() {
  const now = new Date();
  const [filters, setFilters] = useState({
    area: '', region: '', dealer: '', 
    month: MONTHS[now.getMonth()], year: String(now.getFullYear()),
  });
  const [dealers,  setDealers]  = useState([]);
  const [products, setProducts] = useState([]);
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [modal,    setModal]    = useState(null); // 'sales' | 'adjust' | 'transfer'

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  // derive unique areas and regions from dealers
  const areas   = [...new Set(dealers.map(d => d.area).filter(Boolean))].sort();
  const regions = [...new Set(dealers.map(d => d.province).filter(Boolean))].sort();

  // load dealers and products once
  useEffect(() => {
    Promise.all([
      dealerService.getAll({ limit: 500 }),
      productService.getAll({ limit: 500 }),
    ]).then(([dr, pr]) => {
      setDealers(dr.data?.data?.dealers || dr.data?.data || []);
      setProducts(pr.data?.data?.products || pr.data?.data || []);
    }).catch(() => {});
  }, []);

  // load stock data
  const loadStock = useCallback(() => {
    setLoading(true);
    setError(null);
    stockStatusService.getAll({
        area:     filters.area     || undefined,
        region:   filters.region   || undefined,
        dealerId: filters.dealer   || undefined,
        month:    filters.month    || undefined,
        year:     filters.year     || undefined,
      })
      .then(r => {
        const data = r.data?.data;
        setRows(Array.isArray(data) ? data : (data?.products || []));
      })
      .catch(() => {
        setRows([]);
        setError('Failed to load stock data.');
      })
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { loadStock(); }, [loadStock]);

  const handleReset = () => {
    setFilters({ area: '', region: '', dealer: '', month: MONTHS[now.getMonth()], year: String(now.getFullYear()) });
  };

  // compute summary totals
  const totals = rows.reduce((acc, r) => ({
    openingStock:    acc.openingStock    + (r.openingStock    || 0),
    companyDispatch: acc.companyDispatch + (r.companyDispatch || 0),
    totalStock:      acc.totalStock      + (r.totalStock      || 0),
    dealerSales:     acc.dealerSales     + (r.dealerSales     || 0),
    transfers:       acc.transfers       + (r.stockTransfers  || r.transfers || 0),
    closingStock:    acc.closingStock    + (r.closingStock    || 0),
  }), { openingStock: 0, companyDispatch: 0, totalStock: 0, dealerSales: 0, transfers: 0, closingStock: 0 });

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Stock Status</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track dealer-wise inventory movement and closing stock.</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Area</label>
            <select value={filters.area} onChange={e => setF('area', e.target.value)} className="input w-full">
              <option value="">All Areas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Region</label>
            <select value={filters.region} onChange={e => setF('region', e.target.value)} className="input w-full">
              <option value="">All Regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Dealer</label>
            <select value={filters.dealer} onChange={e => setF('dealer', e.target.value)} className="input w-full">
              <option value="">All Dealers</option>
              {dealers
                .filter(d => (!filters.area || d.area === filters.area) && (!filters.region || d.province === filters.region))
                .map(d => <option key={d._id} value={d._id}>{d.dealerName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
            <select value={filters.month} onChange={e => setF('month', e.target.value)} className="input w-full">
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
            <select value={filters.year} onChange={e => setF('year', e.target.value)} className="input w-full">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={handleReset} className="btn-secondary text-sm flex items-center gap-1.5">
            <FiRefreshCw className="text-xs" /> Reset
          </button>
          <button onClick={() => window.print()} className="btn-secondary text-sm flex items-center gap-1.5">
            <FiPrinter className="text-xs" /> Print
          </button>
          <button onClick={() => toast('Export coming soon!')} className="btn-secondary text-sm flex items-center gap-1.5">
            <FiDownload className="text-xs" /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <KPI icon={FiArchive}      label="Opening Stock"             value={`${fmtN(totals.openingStock)} Units`}    color="blue"   />
        <KPI icon={FiTruck}        label="Company Dispatch"          value={`${fmtN(totals.companyDispatch)} Units`} color="purple" />
        <KPI icon={FiLayers}       label="Total Stock"               value={`${fmtN(totals.totalStock)} Units`}      color="teal"   />
        <KPI icon={FiShoppingCart} label="Dealer Sales"              value={`${fmtN(totals.dealerSales)} Units`}     color="green"  />
        <KPI icon={FiRefreshCw}    label="Stock Transfers / Issues"  value={`${fmtN(totals.transfers)} Units`}       color="orange" />
        <KPI icon={FiPackage}      label="Closing Stock"             value={`${fmtN(totals.closingStock)} Units`}    color="red"    />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Stock Details</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal('sales')} className="btn-primary text-xs flex items-center gap-1.5">
            <FiPlus className="text-xs" /> Record Sales
          </button>
          <button onClick={() => setModal('adjust')} className="btn-secondary text-xs flex items-center gap-1.5">
            <FiPlus className="text-xs" /> Adjustment
          </button>
          <button onClick={() => setModal('transfer')} className="btn-secondary text-xs flex items-center gap-1.5">
            <FiPlus className="text-xs" /> Transfer
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-white text-xs">
                <th className="px-3 py-3 text-left w-8">#</th>
                <th className="px-3 py-3 text-left min-w-36">Dealer</th>
                <th className="px-3 py-3 text-left min-w-36">Product</th>
                <th className="px-3 py-3 text-right min-w-28">Opening Stock</th>
                <th className="px-3 py-3 text-right min-w-32">Company Dispatch</th>
                <th className="px-3 py-3 text-right min-w-24">Total Stock</th>
                <th className="px-3 py-3 text-right min-w-24">Dealer Sales</th>
                <th className="px-3 py-3 text-right min-w-36">Transfers / Issues</th>
                <th className="px-3 py-3 text-right min-w-28">Closing Stock</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-16 text-center"><PageLoader /></td></tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FiPackage className="text-3xl" />
                      <p className="text-sm">{error}</p>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <FiPackage className="text-3xl" />
                      <p className="text-sm">No stock data found for selected filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={`${row.dealerId}-${row.productId}` || i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{row.dealerName || '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{row.productName || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700 dark:text-slate-300">{fmtN(row.openingStock)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700 dark:text-slate-300">{fmtN(row.companyDispatch)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-900 dark:text-white">{fmtN(row.totalStock)}</td>
                    <td className="px-3 py-2.5 text-right text-green-600 font-medium">{fmtN(row.dealerSales)}</td>
                    <td className="px-3 py-2.5 text-right text-orange-500">{fmtN(row.transfers)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-blue-600">{fmtN(row.closingStock)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && !error && rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-sm">
                  <td className="px-3 py-3" colSpan={3}>TOTAL</td>
                  <td className="px-3 py-3 text-right">{fmtN(totals.openingStock)}</td>
                  <td className="px-3 py-3 text-right">{fmtN(totals.companyDispatch)}</td>
                  <td className="px-3 py-3 text-right">{fmtN(totals.totalStock)}</td>
                  <td className="px-3 py-3 text-right text-green-600">{fmtN(totals.dealerSales)}</td>
                  <td className="px-3 py-3 text-right text-orange-500">{fmtN(totals.transfers)}</td>
                  <td className="px-3 py-3 text-right text-blue-600">{fmtN(totals.closingStock)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modals */}
      {modal === 'sales'    && <RecordSalesModal    dealers={dealers} products={products} rows={rows} defaultDealerId={filters.dealer || ''} onClose={() => setModal(null)} onSaved={loadStock} />}
      {modal === 'adjust'   && <StockAdjustmentModal dealers={dealers} products={products} onClose={() => setModal(null)} onSaved={loadStock} />}
      {modal === 'transfer' && <StockTransferModal  dealers={dealers} products={products} onClose={() => setModal(null)} onSaved={loadStock} />}
    </div>
  );
}
