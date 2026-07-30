import { useEffect, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { orderService, salespersonService, dealerService, productService } from '../services';
import { useCrud } from '../hooks/useCrud';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Pagination } from '../components/common/Pagination';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge, formatCurrency, formatDate } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { FiPlus, FiEdit2, FiTrash2, FiMinus, FiCheck, FiX, FiEye, FiChevronDown, FiChevronUp, FiMapPin, FiArrowLeft, FiClipboard } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const PROVINCES = ['Koshi Province', 'Madhesh Province', 'Bagmati Province', 'Gandaki Province', 'Lumbini Province', 'Karnali Province', 'Sudurpashchim Province'];
const PROVINCE_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/20',     border: 'border-blue-200 dark:border-blue-700',     icon: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300'   },
  { bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-700',   icon: 'bg-green-500',   text: 'text-green-700 dark:text-green-300' },
  { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-700', icon: 'bg-purple-500',  text: 'text-purple-700 dark:text-purple-300'},
  { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700', icon: 'bg-orange-500',  text: 'text-orange-700 dark:text-orange-300'},
  { bg: 'bg-pink-50 dark:bg-pink-900/20',     border: 'border-pink-200 dark:border-pink-700',     icon: 'bg-pink-500',    text: 'text-pink-700 dark:text-pink-300'   },
  { bg: 'bg-teal-50 dark:bg-teal-900/20',     border: 'border-teal-200 dark:border-teal-700',     icon: 'bg-teal-500',    text: 'text-teal-700 dark:text-teal-300'   },
  { bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-700',       icon: 'bg-red-500',     text: 'text-red-700 dark:text-red-300'     },
];
const PAGE_SIZE = 10;

/* ── helpers ─────────────────────────────────────────── */
const calc = (qty, rate, excP, vatP) => {
  const q = +qty || 0, r = +rate || 0, e = +excP || 0, v = +vatP || 0;
  const basic = q * r;
  const excise = basic * (e / 100);
  const vat = (basic + excise) * (v / 100);
  return { basic, excise, vat, total: basic + excise + vat };
};

/* ── live row ────────────────────────────────────────── */
const ItemRow = ({ index, control, register, remove, products, onProductChange }) => {
  const item = useWatch({ control, name: `items.${index}` }) || {};
  const c = calc(item.quantity, item.rate, item.excisePercent, item.vatPercent);
  return (
    <tr style={{ background: index % 2 === 0 ? '#fff' : '#f8fafc' }}>
      <td className="px-2 py-1.5 text-center text-xs text-slate-400 font-medium">{index + 1}</td>
      <td className="px-2 py-1.5">
        <select
          {...register(`items.${index}.product`, { required: true })}
          onChange={e => onProductChange(index, e.target.value)}
          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
        >
          <option value="">-- Select --</option>
          {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input {...register(`items.${index}.quantity`, { valueAsNumber: true, min: 0 })}
          type="number" min="0"
          className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 text-center" />
      </td>
      <td className="px-2 py-1.5">
        <input {...register(`items.${index}.rate`, { valueAsNumber: true, min: 0 })}
          type="number" step="0.01" min="0"
          className="w-24 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 text-right" />
      </td>
      <td className="px-2 py-1.5 text-right text-xs font-medium text-slate-700">{c.basic.toFixed(2)}</td>
      <td className="px-2 py-1.5">
        <input {...register(`items.${index}.excisePercent`, { valueAsNumber: true, min: 0 })}
          type="number" step="0.01" min="0"
          className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 text-center" />
      </td>
      <td className="px-2 py-1.5 text-right text-xs text-orange-600 font-medium">{c.excise.toFixed(2)}</td>
      <td className="px-2 py-1.5">
        <input {...register(`items.${index}.vatPercent`, { valueAsNumber: true, min: 0 })}
          type="number" step="0.01" min="0"
          className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 text-center" />
      </td>
      <td className="px-2 py-1.5 text-right text-xs text-blue-600 font-medium">{c.vat.toFixed(2)}</td>
      <td className="px-2 py-1.5 text-right text-sm font-bold text-primary-600">{c.total.toFixed(2)}</td>
      <td className="px-2 py-1.5 text-center">
        <button type="button" onClick={() => remove(index)}
          className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50">
          <FiMinus size={14} />
        </button>
      </td>
    </tr>
  );
};

/* ── totals footer ───────────────────────────────────── */
const TotalsRow = ({ control }) => {
  const items = useWatch({ control, name: 'items' }) || [];
  const t = items.reduce((a, i) => {
    const c = calc(i?.quantity, i?.rate, i?.excisePercent, i?.vatPercent);
    return { basic: a.basic + c.basic, excise: a.excise + c.excise, vat: a.vat + c.vat, total: a.total + c.total };
  }, { basic: 0, excise: 0, vat: 0, total: 0 });
  return (
    <tr style={{ background: '#eff6ff', borderTop: '2px solid #2563EB' }}>
      <td colSpan={4} className="px-3 py-2 text-xs font-bold text-slate-600 text-right">TOTALS →</td>
      <td className="px-2 py-2 text-right text-xs font-bold text-slate-800">{t.basic.toFixed(2)}</td>
      <td className="px-2 py-2"></td>
      <td className="px-2 py-2 text-right text-xs font-bold text-orange-600">{t.excise.toFixed(2)}</td>
      <td className="px-2 py-2"></td>
      <td className="px-2 py-2 text-right text-xs font-bold text-blue-600">{t.vat.toFixed(2)}</td>
      <td className="px-2 py-2 text-right text-sm font-bold text-primary-600">{formatCurrency(t.total)}</td>
      <td></td>
    </tr>
  );
};

/* ── order detail expand row ─────────────────────────── */
const OrderDetail = ({ order }) => (
  <tr>
    <td colSpan={8} className="px-0 py-0">
      <div className="mx-4 mb-3 rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead style={{ background: '#f1f5f9' }}>
            <tr>
              <th className="px-3 py-2 text-left text-slate-500">#</th>
              <th className="px-3 py-2 text-left text-slate-500">Product</th>
              <th className="px-3 py-2 text-right text-slate-500">Qty</th>
              <th className="px-3 py-2 text-right text-slate-500">Rate</th>
              <th className="px-3 py-2 text-right text-slate-500">Basic Amt</th>
              <th className="px-3 py-2 text-right text-slate-500">Excise%</th>
              <th className="px-3 py-2 text-right text-orange-500">Excise Amt</th>
              <th className="px-3 py-2 text-right text-slate-500">VAT%</th>
              <th className="px-3 py-2 text-right text-blue-500">VAT Amt</th>
              <th className="px-3 py-2 text-right text-primary-600">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                <td className="px-3 py-1.5 font-medium text-slate-700">{item.productName || item.product?.productName}</td>
                <td className="px-3 py-1.5 text-right">{item.quantity}</td>
                <td className="px-3 py-1.5 text-right">{item.rate?.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right font-medium">{item.basicAmount?.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">{item.excisePercent}%</td>
                <td className="px-3 py-1.5 text-right text-orange-600">{item.exciseAmount?.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right">{item.vatPercent}%</td>
                <td className="px-3 py-1.5 text-right text-blue-600">{item.vatAmount?.toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right font-bold text-primary-600">{item.grandTotal?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot style={{ background: '#eff6ff', borderTop: '2px solid #2563EB' }}>
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-slate-600">TOTALS →</td>
              <td className="px-3 py-2 text-right text-xs font-bold">{order.totalBasicAmount?.toFixed(2)}</td>
              <td></td>
              <td className="px-3 py-2 text-right text-xs font-bold text-orange-600">{order.totalExciseAmount?.toFixed(2)}</td>
              <td></td>
              <td className="px-3 py-2 text-right text-xs font-bold text-blue-600">{order.totalVatAmount?.toFixed(2)}</td>
              <td className="px-3 py-2 text-right text-sm font-bold text-primary-600">{formatCurrency(order.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </td>
  </tr>
);



/* ── main page ───────────────────────────────────────── */
export default function Orders() {
  const { user } = useAuth();
  const crud = useCrud(orderService);
  const [searchParams] = useSearchParams();
  const [view, setView] = useState('provinces'); // 'provinces' | 'list' | 'form'
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [editData, setEditData] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});
  const [salespersons, setSalespersons] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [products, setProducts] = useState([]);

  const { register, handleSubmit, reset, control, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: { date: new Date().toISOString().split('T')[0], paymentType: 'cash', items: [{ product: '', quantity: 1, rate: 0, excisePercent: 0, vatPercent: 13 }] }
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // load full order set once (used for province grouping + client-side drill-down pagination)
  const loadOrders = () => crud.fetchAll({ limit: 1000 });

  useEffect(() => {
    loadOrders();
    salespersonService.getAll({ limit: 200 }).then(r => setSalespersons(r.data.data || []));
    dealerService.getAll({ limit: 200 }).then(r => setDealers(r.data.data || []));
    productService.getAll({ limit: 200 }).then(r => setProducts(r.data.data || []));
  }, []);

  // auto-open new order form if coming from Visit Dealer flow
  useEffect(() => {
    if (searchParams.get('newOrder') === '1' && dealers.length) {
      const dealerId  = searchParams.get('dealer')   || '';
      const province  = searchParams.get('province') || '';
      const area      = searchParams.get('area')     || '';
      setEditData(null);
      reset({
        date: new Date().toISOString().split('T')[0],
        dealer: dealerId,
        province,
        area,
        paymentType: 'cash',
        items: [{ product: '', quantity: 1, rate: 0, excisePercent: 0, vatPercent: 13 }],
      });
      setView('form');
    }
  }, [searchParams, dealers]);

  const allOrders = crud.data || [];

  const provinceStats = PROVINCES.map(name => {
    const list = allOrders.filter(o => o.province === name);
    return {
      name,
      count: list.length,
      total: list.reduce((s, o) => s + (o.grandTotal || 0), 0),
      pending: list.filter(o => o.status === 'pending').length,
    };
  });
  const unassigned = allOrders.filter(o => !PROVINCES.includes(o.province));

  const ordersInProvince = selectedProvince
    ? (selectedProvince === '__unassigned__' ? unassigned : allOrders.filter(o => o.province === selectedProvince))
    : [];
  const pageCount = Math.max(1, Math.ceil(ordersInProvince.length / PAGE_SIZE));
  const pagedOrders = ordersInProvince.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleProductChange = (index, productId) => {
    const p = products.find(x => x._id === productId);
    if (p) {
      setValue(`items.${index}.rate`, p.rate);
      setValue(`items.${index}.excisePercent`, p.excisePercent);
      setValue(`items.${index}.vatPercent`, p.vatPercent);
    }
  };

  const handleDealerChange = (dealerId) => {
    const d = dealers.find(x => x._id === dealerId);
    if (d) {
      setValue('province', d.province);
      setValue('area', d.area);
    }
  };

  const openProvince = (name) => {
    setSelectedProvince(name);
    setPage(1);
    setExpanded({});
    setView('list');
  };

  const backToProvinces = () => {
    setSelectedProvince(null);
    setView('provinces');
  };

  const openCreate = (prefillProvince) => {
    setEditData(null);
    reset({
      date: new Date().toISOString().split('T')[0],
      province: prefillProvince && prefillProvince !== '__unassigned__' ? prefillProvince : '',
      paymentType: 'cash',
      items: [{ product: '', quantity: 1, rate: 0, excisePercent: 0, vatPercent: 13 }],
    });
    setView('form');
  };

  const openEdit = (order) => {
    setEditData(order);
    reset({
      ...order,
      date: order.date ? new Date(order.date).toISOString().split('T')[0] : '',
      salesperson: order.salesperson?._id || order.salesperson,
      dealer: order.dealer?._id || order.dealer,
      province: order.province || order.dealer?.province || '',
      area: order.area || order.dealer?.area || '',
      paymentType: order.paymentType || 'cash',
      items: order.items?.map(i => ({ ...i, product: i.product?._id || i.product })) || [],
    });
    setView('form');
  };

  const closeForm = () => setView(selectedProvince ? 'list' : 'provinces');

  const onSubmit = async (data) => {
    try {
      if (editData) await crud.update(editData._id, data);
      else await crud.create(data);
      setView(selectedProvince ? 'list' : 'provinces');
      loadOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving order'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await crud.remove(confirm.id); setConfirm({ open: false, id: null }); loadOrders(); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setDeleting(false); }
  };

  const handleStatus = async (id, status) => {
    try { await orderService.updateStatus(id, { status }); toast.success(`Order ${status}`); loadOrders(); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const canManage = true;
  const canApprove = user?.role === 'admin';

  /* ── FORM VIEW ─────────────────────────────────────── */
  if (view === 'form') return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {editData ? `Edit Order — ${editData.orderNumber}` : 'New Order Plan'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">All amounts auto-calculated • Formula: Basic = Qty × Rate | Excise = Basic × Excise% | VAT = (Basic+Excise) × VAT%</p>
        </div>
        <button className="btn-secondary" onClick={closeForm}>← Back to List</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* order header info */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">Order Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="label text-xs">Date *</label>
              <input {...register('date', { required: true })} type="date" className="input text-sm" />
            </div>
            {editData ? (
              <div className="sm:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                <div className="text-xs font-semibold text-slate-600">Order Summary</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
                  <div><span className="font-medium">Order:</span> {editData.orderNumber || '—'}</div>
                  <div><span className="font-medium">Date:</span> {formatDate(editData.date)}</div>
                  <div><span className="font-medium">Dealer:</span> {editData.dealer?.dealerName || editData.dealer || '—'}</div>
                  <div><span className="font-medium">Salesperson:</span> {editData.salesperson?.fullName || editData.salesperson || '—'}</div>
                  <div><span className="font-medium">Amount:</span> {formatCurrency(editData.grandTotal || 0)}</div>
                  <div><span className="font-medium">Payment:</span> {editData.paymentType || 'cash'}</div>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="label text-xs">Sales Person *</label>
                  <select {...register('salesperson', { required: true })} className="input text-sm">
                    <option value="">Select...</option>
                    {salespersons.map(s => <option key={s._id} value={s._id}>{s.fullName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Dealer *</label>
                  <select {...register('dealer', { required: true })} className="input text-sm"
                    onChange={e => handleDealerChange(e.target.value)}>
                    <option value="">Select...</option>
                    {dealers.map(d => <option key={d._id} value={d._id}>{d.dealerName} — {d.area}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="label text-xs">Province *</label>
              <select {...register('province', { required: true })} className="input text-sm">
                <option value="">Select Province...</option>
                {PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Area</label>
              <input {...register('area')} className="input text-sm" placeholder="Area" />
            </div>
            <div>
              <label className="label text-xs">Payment Type *</label>
              <select {...register('paymentType', { required: true })} className="input text-sm">
                <option value="cash">Cash</option>
                <option value="online">Online</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div className="col-span-1 sm:col-span-4">
              <label className="label text-xs">Remarks</label>
              <input {...register('remarks')} className="input text-sm" placeholder="Optional remarks..." />
            </div>
            {editData && (
              <>
                <input type="hidden" {...register('salesperson')} />
                <input type="hidden" {...register('dealer')} />
              </>
            )}
          </div>
        </div>

        {/* spreadsheet */}
        <div className="card p-0 overflow-hidden">
          {/* sheet header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700" style={{ background: '#1e3a8a' }}>
            <span className="text-white font-semibold text-sm">📋 Order Items Sheet</span>
            <button type="button"
              onClick={() => append({ product: '', quantity: 1, rate: 0, excisePercent: 0, vatPercent: 13 })}
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
                  <th className="px-2 py-2.5 text-center text-xs font-semibold w-20">Quantity</th>
                  <th className="px-2 py-2.5 text-right text-xs font-semibold w-24">Rate (NPR)</th>
                  <th className="px-2 py-2.5 text-right text-xs font-semibold w-28" style={{ background: '#1e3a8a' }}>Basic Amount</th>
                  <th className="px-2 py-2.5 text-center text-xs font-semibold w-16" style={{ background: '#92400e' }}>Excise %</th>
                  <th className="px-2 py-2.5 text-right text-xs font-semibold w-28" style={{ background: '#92400e' }}>Excise Amt</th>
                  <th className="px-2 py-2.5 text-center text-xs font-semibold w-16" style={{ background: '#1e3a8a' }}>VAT %</th>
                  <th className="px-2 py-2.5 text-right text-xs font-semibold w-28" style={{ background: '#1e3a8a' }}>VAT Amt</th>
                  <th className="px-2 py-2.5 text-right text-xs font-semibold w-32" style={{ background: '#14532d' }}>Grand Total</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
                <tr style={{ background: '#dbeafe', fontSize: '10px', color: '#475569' }}>
                  <td></td>
                  <td className="px-2 py-1">Select from list</td>
                  <td className="px-2 py-1 text-center">Enter qty</td>
                  <td className="px-2 py-1 text-right">Auto-filled</td>
                  <td className="px-2 py-1 text-right font-medium text-blue-700">= Qty × Rate</td>
                  <td className="px-2 py-1 text-center">%</td>
                  <td className="px-2 py-1 text-right text-orange-600">= Basic × Exc%</td>
                  <td className="px-2 py-1 text-center">%</td>
                  <td className="px-2 py-1 text-right text-blue-600">= (Basic+Exc) × VAT%</td>
                  <td className="px-2 py-1 text-right font-bold text-green-700">= Basic+Exc+VAT</td>
                  <td></td>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <ItemRow key={field.id} index={index} control={control} register={register}
                    remove={remove} products={products} onProductChange={handleProductChange} />
                ))}
                {fields.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-8 text-slate-400 text-sm">No items. Click "Add Row" to start.</td></tr>
                )}
              </tbody>
              <tfoot>
                <TotalsRow control={control} />
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
          <button type="submit" className="btn-primary px-8" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : editData ? 'Update Order' : 'Save Order'}
          </button>
        </div>
      </form>
    </div>
  );

  /* ── PROVINCE OVERVIEW (default view) ─────────────────── */
  if (view === 'provinces') return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Order Plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">{allOrders.length} total orders across {PROVINCES.length} provinces</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => openCreate()}><FiPlus /> New Order</button>
        )}
      </div>

      {crud.loading ? <PageLoader /> : allOrders.length === 0 ? (
        <EmptyState icon={FiPlus} title="No orders yet" description="Create your first order plan"
          action={canManage && <button className="btn-primary" onClick={() => openCreate()}><FiPlus />New Order</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {provinceStats.map((p, idx) => {
            const color = PROVINCE_COLORS[idx];
            return (
              <button
                key={p.name}
                onClick={() => openProvince(p.name)}
                className={`${color.bg} ${color.border} border-2 rounded-2xl p-5 text-left hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${color.icon} rounded-xl flex items-center justify-center shadow-sm`}>
                    <FiMapPin className="text-white text-xl" />
                  </div>
                  <span className={`text-3xl font-bold ${color.text}`}>{p.count}</span>
                </div>
                <p className={`font-semibold text-base ${color.text} leading-tight`}>{p.name}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  {p.pending} pending · {formatCurrency(p.total)}
                </p>
                <p className={`text-xs mt-3 font-medium ${color.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  Click to view orders →
                </p>
              </button>
            );
          })}
          {/* Total summary box */}
          <div className="bg-slate-800 dark:bg-slate-700 rounded-2xl p-5 text-left border-2 border-slate-700 dark:border-slate-600">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-slate-600 rounded-xl flex items-center justify-center shadow-sm">
                <FiClipboard className="text-white text-xl" />
              </div>
              <span className="text-3xl font-bold text-white">{allOrders.length}</span>
            </div>
            <p className="font-semibold text-base text-white">All Provinces</p>
            <p className="text-slate-400 text-xs mt-1">
              {formatCurrency(allOrders.reduce((s, o) => s + (o.grandTotal || 0), 0))} total
            </p>
          </div>
        </div>
      )}
    </div>
  );

  /* ── PROVINCE DRILL-DOWN LIST VIEW ─────────────────────── */
  const provinceLabel = selectedProvince === '__unassigned__' ? 'Unspecified' : selectedProvince;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button onClick={backToProvinces}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary-600 mb-1">
            <FiArrowLeft size={12} /> All Provinces
          </button>
          <div className="flex items-center gap-2">
            <FiMapPin className="text-primary-600" size={18} />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{provinceLabel}</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{ordersInProvince.length} order{ordersInProvince.length === 1 ? '' : 's'}</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => openCreate(selectedProvince)}><FiPlus /> New Order</button>
        )}
      </div>

      <div className="card p-0">
        {crud.loading ? <PageLoader /> : ordersInProvince.length === 0 ? (
          <EmptyState icon={FiClipboard} title="No orders in this province" description="Create an order plan for this province"
            action={canManage && <button className="btn-primary" onClick={() => openCreate(selectedProvince)}><FiPlus />New Order</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: '#1e3a8a', color: '#fff' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Sales Person</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Dealer</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold">Grand Total</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedOrders.map((o, i) => (
                    <>
                      <tr key={o._id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}
                        className="border-b border-slate-100">
                        <td className="px-4 py-3 font-bold text-primary-600">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{formatDate(o.date)}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{o.salesperson?.fullName}</td>
                        <td className="px-4 py-3 text-slate-600">{o.dealer?.dealerName}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(o.grandTotal)}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={o.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => toggleExpand(o._id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="View items">
                              {expanded[o._id] ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                            </button>
                            {canManage && o.status === 'pending' && (
                              <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit">
                                <FiEdit2 size={14} />
                              </button>
                            )}
                            {canApprove && o.status === 'pending' && (
                              <>
                                <button onClick={() => handleStatus(o._id, 'approved')}
                                  className="p-1.5 rounded-lg text-green-600 hover:bg-green-50" title="Approve">
                                  <FiCheck size={14} />
                                </button>
                                <button onClick={() => handleStatus(o._id, 'rejected')}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Reject">
                                  <FiX size={14} />
                                </button>
                              </>
                            )}
                            {user?.role === 'admin' && (
                              <button onClick={() => setConfirm({ open: true, id: o._id })}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Delete">
                                <FiTrash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded[o._id] && <OrderDetail key={`detail-${o._id}`} order={o} />}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4"><Pagination page={page} pages={pageCount} onPage={setPage} /></div>
          </>
        )}
      </div>

      <ConfirmDialog open={confirm.open} title="Delete Order" message="This action cannot be undone."
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
    </div>
  );
}