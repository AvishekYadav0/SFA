import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { liftingService, orderService, dealerService, productService } from '../services';
import { useCrud } from '../hooks/useCrud';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Pagination } from '../components/common/Pagination';
import { EmptyState } from '../components/common/EmptyState';
import { PageLoader } from '../components/common/Spinner';
import { FiPlus, FiEdit2, FiTrash2, FiTruck } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ProgressBar = ({ percent }) => {
  const color = percent >= 100 ? '#22C55E' : percent >= 75 ? '#3B82F6' : percent >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1" style={{ color }}>
        <span>{percent}% lifted</span>
        <span>{percent >= 100 ? '✓ Complete' : 'In Progress'}</span>
      </div>
      <div className="w-full rounded-full h-2.5" style={{ background: '#e2e8f0' }}>
        <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, percent)}%`, background: color }} />
      </div>
    </div>
  );
};

const LiveCalc = ({ control }) => {
  const [w1, w2, w3, w4, ordered] = useWatch({ control, name: ['week1', 'week2', 'week3', 'week4', 'orderedQuantity'] });
  const total = (+w1 || 0) + (+w2 || 0) + (+w3 || 0) + (+w4 || 0);
  const orderedQty = +ordered || 0;
  const remaining = orderedQty - total;
  const progress = orderedQty > 0 ? Math.min(100, Math.round((total / orderedQty) * 100)) : 0;
  const over = remaining < 0;
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
      <div className="px-4 py-2 text-xs font-semibold text-white" style={{ background: '#1e3a8a' }}>
        Live Calculation Summary
      </div>
      <div className="grid grid-cols-4 divide-x divide-slate-200">
        <div className="p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Ordered Qty</p>
          <p className="text-xl font-bold text-slate-800">{orderedQty}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Total Lifted</p>
          <p className="text-xl font-bold text-blue-600">{total}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Remaining</p>
          <p className={`text-xl font-bold ${over ? 'text-red-600' : 'text-green-600'}`}>{remaining}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Progress</p>
          <p className={`text-xl font-bold ${progress >= 100 ? 'text-green-600' : 'text-orange-500'}`}>{progress}%</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        <ProgressBar percent={progress} />
        {over && <p className="text-xs text-red-600 mt-1 font-medium">⚠ Exceeds ordered quantity by {Math.abs(remaining)} units!</p>}
      </div>
    </div>
  );
};

export default function Lifting() {
  const { user } = useAuth();
  const crud = useCrud(liftingService);
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [products, setProducts] = useState([]);

  const { register, handleSubmit, reset, control, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: { week1: 0, week2: 0, week3: 0, week4: 0, orderedQuantity: 0 }
  });

  useEffect(() => {
    crud.fetchAll({ page, limit: 10 });
    orderService.getAll({ status: 'approved', limit: 200 }).then(r => setOrders(r.data.data || []));
    dealerService.getAll({ limit: 200 }).then(r => setDealers(r.data.data || []));
    productService.getAll({ limit: 200 }).then(r => setProducts(r.data.data || []));
  }, [page]);

  const handleOrderChange = (orderId) => {
    const order = orders.find(o => o._id === orderId);
    if (order) {
      setValue('dealer', order.dealer?._id || order.dealer);
      const totalQty = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
      setValue('orderedQuantity', totalQty);
    }
  };

  const openCreate = () => {
    setEditData(null);
    reset({ week1: 0, week2: 0, week3: 0, week4: 0, orderedQuantity: 0, year: new Date().getFullYear() });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditData(item);
    reset({ ...item, order: item.order?._id || item.order, dealer: item.dealer?._id || item.dealer, product: item.product?._id || item.product });
    setShowForm(true);
  };

  const onSubmit = async (data) => {
    try {
      if (editData) await crud.update(editData._id, data);
      else await crud.create(data);
      setShowForm(false);
      crud.fetchAll({ page });
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await crud.remove(confirm.id); setConfirm({ open: false, id: null }); crud.fetchAll({ page }); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setDeleting(false); }
  };

  const canManage = true;

  /* ── FORM VIEW ─────────────────────────────────────── */
  if (showForm) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {editData ? 'Edit Lifting Plan' : 'New Lifting Plan'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Track weekly product lifting against ordered quantity</p>
        </div>
        <button className="btn-secondary" onClick={() => setShowForm(false)}>← Back to List</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* order info */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
            Link to Order
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label text-xs">Order * <span className="text-slate-400">(approved only)</span></label>
              <select {...register('order', { required: 'Required' })}
                onChange={e => handleOrderChange(e.target.value)}
                className="input text-sm">
                <option value="">Select Order...</option>
                {orders.map(o => (
                  <option key={o._id} value={o._id}>
                    {o.orderNumber} — {o.dealer?.dealerName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Dealer</label>
              <select {...register('dealer')} className="input text-sm">
                <option value="">Select Dealer...</option>
                {dealers.map(d => <option key={d._id} value={d._id}>{d.dealerName}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Product</label>
              <select {...register('product')} className="input text-sm">
                <option value="">Select Product...</option>
                {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Ordered Quantity *</label>
              <input {...register('orderedQuantity', { required: true, valueAsNumber: true, min: 1 })}
                type="number" className="input text-sm font-bold" />
            </div>
            <div>
              <label className="label text-xs">Month</label>
              <input {...register('month')} className="input text-sm" placeholder="e.g. January 2025" />
            </div>
            <div>
              <label className="label text-xs">Year</label>
              <input {...register('year', { valueAsNumber: true })} type="number" className="input text-sm" defaultValue={new Date().getFullYear()} />
            </div>
          </div>
        </div>

        {/* weekly lifting sheet */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 text-white font-semibold text-sm" style={{ background: '#1e3a8a' }}>
            📦 Weekly Lifting Sheet
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: '#1e40af', color: '#fff' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Field</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-32" style={{ background: '#1d4ed8' }}>Week 1</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-32" style={{ background: '#1e40af' }}>Week 2</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-32" style={{ background: '#1d4ed8' }}>Week 3</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-32" style={{ background: '#1e40af' }}>Week 4</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-36" style={{ background: '#14532d' }}>Total Lifted</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f0f9ff' }}>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600">Quantity Lifted</td>
                  {['week1', 'week2', 'week3', 'week4'].map((w, i) => (
                    <td key={w} className="px-4 py-3 text-center" style={{ background: i % 2 === 0 ? '#eff6ff' : '#dbeafe' }}>
                      <input {...register(w, { valueAsNumber: true, min: 0 })}
                        type="number" min="0"
                        className="w-24 text-center text-sm font-bold border-2 border-blue-200 rounded-lg px-2 py-2 focus:outline-none focus:border-primary-500 bg-white" />
                    </td>
                  ))}
                  <WeekTotal control={control} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <LiveCalc control={control} />

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          <button type="submit" className="btn-primary px-8" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : editData ? 'Update Plan' : 'Save Plan'}
          </button>
        </div>
      </form>
    </div>
  );

  /* ── LIST VIEW ─────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lifting Plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">{crud.total} total records</p>
        </div>
        {canManage && <button className="btn-primary" onClick={openCreate}><FiPlus /> New Lifting Plan</button>}
      </div>

      <div className="card p-0">
        {crud.loading ? <PageLoader /> : crud.data.length === 0 ? (
          <EmptyState icon={FiTruck} title="No lifting plans" description="Create a lifting plan linked to an approved order"
            action={canManage && <button className="btn-primary" onClick={openCreate}><FiPlus />New Plan</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                    <th className="px-3 py-3 text-left text-xs font-semibold">Order #</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold">Dealer</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold">Product</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold">Ordered</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold" style={{ background: '#1d4ed8' }}>W1</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold" style={{ background: '#1e40af' }}>W2</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold" style={{ background: '#1d4ed8' }}>W3</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold" style={{ background: '#1e40af' }}>W4</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold" style={{ background: '#14532d' }}>Total Lifted</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold">Remaining</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold min-w-36">Progress</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {crud.data.map((l, i) => (
                    <tr key={l._id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-bold text-primary-600 text-xs">{l.order?.orderNumber || l.orderNumber}</td>
                      <td className="px-3 py-3 text-slate-700 text-xs">{l.dealer?.dealerName}</td>
                      <td className="px-3 py-3 font-medium text-slate-700 text-xs">{l.product?.productName || l.productName}</td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800">{l.orderedQuantity}</td>
                      <td className="px-3 py-3 text-center text-blue-700 font-medium" style={{ background: '#eff6ff' }}>{l.week1}</td>
                      <td className="px-3 py-3 text-center text-blue-700 font-medium" style={{ background: '#dbeafe' }}>{l.week2}</td>
                      <td className="px-3 py-3 text-center text-blue-700 font-medium" style={{ background: '#eff6ff' }}>{l.week3}</td>
                      <td className="px-3 py-3 text-center text-blue-700 font-medium" style={{ background: '#dbeafe' }}>{l.week4}</td>
                      <td className="px-3 py-3 text-center font-bold text-green-700" style={{ background: '#f0fdf4' }}>{l.totalLifted}</td>
                      <td className="px-3 py-3 text-center font-bold" style={{ color: l.remainingQuantity < 0 ? '#dc2626' : '#16a34a' }}>
                        {l.remainingQuantity}
                      </td>
                      <td className="px-3 py-3 min-w-36"><ProgressBar percent={l.progressPercent} /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {canManage && (
                            <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50">
                              <FiEdit2 size={13} />
                            </button>
                          )}
                          {user?.role === 'admin' && (
                            <button onClick={() => setConfirm({ open: true, id: l._id })} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                              <FiTrash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4"><Pagination page={page} pages={crud.pages} onPage={setPage} /></div>
          </>
        )}
      </div>

      <ConfirmDialog open={confirm.open} title="Delete Lifting Plan" message="This action cannot be undone."
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
    </div>
  );
}

/* inline total cell */
const WeekTotal = ({ control }) => {
  const [w1, w2, w3, w4] = useWatch({ control, name: ['week1', 'week2', 'week3', 'week4'] });
  const total = (+w1 || 0) + (+w2 || 0) + (+w3 || 0) + (+w4 || 0);
  return (
    <td className="px-4 py-3 text-center" style={{ background: '#dcfce7' }}>
      <span className="text-xl font-bold text-green-700">{total}</span>
    </td>
  );
};
