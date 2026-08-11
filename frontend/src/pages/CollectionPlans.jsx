import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { collectionService, dealerService } from '../services';
import { useCrud } from '../hooks/useCrud';
import { EmptyState } from '../components/common/EmptyState';
import { PageLoader } from '../components/common/Spinner';
import { formatCurrency } from '../components/common/index.jsx';
import { Pagination } from '../components/common/Pagination';
import { FiPlus, FiArrowLeft, FiCalendar, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

/* ── live summary panel ──────────────────────────────── */
const LiveSummary = ({ control }) => {
  const [ob, oa, w1, w2, w3, w4] = useWatch({
    control, name: ['openingBalance', 'currentOrderAmount', 'week1', 'week2', 'week3', 'week4']
  });
  const opening = +ob || 0;
  const orderAmt = +oa || 0;
  const totalDue = opening + orderAmt;
  const w1v = +w1 || 0, w2v = +w2 || 0, w3v = +w3 || 0, w4v = +w4 || 0;
  const totalColl = w1v + w2v + w3v + w4v;
  const closing = totalDue - totalColl;
  const pct = totalDue > 0 ? Math.min(100, Math.round((totalColl / totalDue) * 100)) : 0;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
      <div className="px-4 py-2 text-xs font-semibold text-white" style={{ background: '#14532d' }}>
        Live Collection Summary — Formula: Total Due = Opening + Order | Closing = Total Due − Total Collection
      </div>
      {/* formula row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200 border-b border-slate-200">
        <div className="p-3 text-center" style={{ background: '#fef9c3' }}>
          <p className="text-xs text-slate-500 mb-0.5">Opening Balance</p>
          <p className="text-lg font-bold text-yellow-700">{formatCurrency(opening)}</p>
        </div>
        <div className="p-3 text-center" style={{ background: '#dbeafe' }}>
          <p className="text-xs text-slate-500 mb-0.5">+ Order Amount</p>
          <p className="text-lg font-bold text-blue-700">{formatCurrency(orderAmt)}</p>
        </div>
        <div className="p-3 text-center" style={{ background: '#fee2e2' }}>
          <p className="text-xs text-slate-500 mb-0.5">= Total Due</p>
          <p className="text-lg font-bold text-red-700">{formatCurrency(totalDue)}</p>
        </div>
        <div className="p-3 text-center" style={{ background: '#dcfce7' }}>
          <p className="text-xs text-slate-500 mb-0.5">Total Collected</p>
          <p className="text-lg font-bold text-green-700">{formatCurrency(totalColl)}</p>
        </div>
      </div>
      {/* weekly breakdown */}
      <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200" style={{ background: '#f0fdf4' }}>
        {[['Week 1', w1v], ['Week 2', w2v], ['Week 3', w3v], ['Week 4', w4v]].map(([label, val]) => (
          <div key={label} className="p-2 text-center">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-sm font-bold text-green-600">{formatCurrency(val)}</p>
          </div>
        ))}
      </div>
      {/* closing balance */}
      <div className="p-4 flex items-center justify-between" style={{ background: closing > 0 ? '#fef2f2' : '#f0fdf4' }}>
        <div>
          <p className="text-xs text-slate-500">Closing Balance = Total Due − Total Collection</p>
          <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(totalDue)} − {formatCurrency(totalColl)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 mb-0.5">Closing Balance</p>
          <p className={`text-2xl font-bold ${closing > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(closing)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: closing > 0 ? '#dc2626' : '#16a34a' }}>
            {closing > 0 ? `⚠ ${formatCurrency(closing)} still outstanding` : '✓ Fully collected'}
          </p>
        </div>
      </div>
      {/* progress bar */}
      <div className="px-4 pb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Collection Progress</span><span>{pct}%</span>
        </div>
        <div className="w-full rounded-full h-2.5" style={{ background: '#e2e8f0' }}>
          <div className="h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct >= 100 ? '#22C55E' : pct >= 75 ? '#3B82F6' : pct >= 50 ? '#F59E0B' : '#EF4444' }} />
        </div>
      </div>
    </div>
  );
};

/* ── auto-calc cells ─────────────────────────────────── */
const TotalDueCell = ({ control }) => {
  const [ob, oa] = useWatch({ control, name: ['openingBalance', 'currentOrderAmount'] });
  const total = (+ob || 0) + (+oa || 0);
  return (
    <td className="px-4 py-3 text-right" style={{ background: '#fee2e2' }}>
      <span className="text-sm font-bold text-red-700">{formatCurrency(total)}</span>
      <p className="text-xs text-red-400 mt-0.5">auto</p>
    </td>
  );
};

const TotalCollectedCell = ({ control }) => {
  const [w1, w2, w3, w4] = useWatch({ control, name: ['week1', 'week2', 'week3', 'week4'] });
  const total = (+w1 || 0) + (+w2 || 0) + (+w3 || 0) + (+w4 || 0);
  return (
    <td className="px-4 py-3 text-right" style={{ background: '#dcfce7' }}>
      <span className="text-sm font-bold text-green-700">{formatCurrency(total)}</span>
      <p className="text-xs text-green-400 mt-0.5">auto</p>
    </td>
  );
};

const ClosingBalanceCell = ({ control }) => {
  const [ob, oa, w1, w2, w3, w4] = useWatch({
    control, name: ['openingBalance', 'currentOrderAmount', 'week1', 'week2', 'week3', 'week4']
  });
  const due = (+ob || 0) + (+oa || 0);
  const coll = (+w1 || 0) + (+w2 || 0) + (+w3 || 0) + (+w4 || 0);
  const closing = due - coll;
  return (
    <td className="px-4 py-3 text-right" style={{ background: closing > 0 ? '#fef2f2' : '#f0fdf4' }}>
      <span className="text-sm font-bold" style={{ color: closing > 0 ? '#dc2626' : '#16a34a' }}>
        {formatCurrency(closing)}
      </span>
      <p className="text-xs mt-0.5" style={{ color: closing > 0 ? '#fca5a5' : '#86efac' }}>auto</p>
    </td>
  );
};

/* ── main page ───────────────────────────────────────── */
export default function CollectionPlans() {
  const { user } = useAuth();
  const crud = useCrud({
    getAll: (params) => collectionService.getPlans(params),
    create: (data) => collectionService.createPlan(data),
    update: (id, data) => collectionService.updatePlan(id, data),
    delete: (id) => collectionService.deletePlan(id),
  });
  const [showForm, setShowForm] = useState(false);
  const [dealers, setDealers] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [page, setPage] = useState(1);

  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm({
    defaultValues: {
      dealer: '',
      month: '',
      openingBalance: 0,
      currentOrderAmount: 0,
      week1: 0,
      week2: 0,
      week3: 0,
      week4: 0,
      remarks: '',
    },
  });

  useEffect(() => {
    crud.fetchAll({ page, limit: 20 });
  }, [page]);

  useEffect(() => {
    dealerService.getAll({ limit: 200 }).then((res) => setDealers(res.data.data || [])).catch(() => {});
  }, []);

  const openForm = (plan = null) => {
    setSelectedPlan(plan);
    setShowForm(true);
    reset(plan ? {
      dealer: plan.dealer?._id || plan.dealer,
      month: plan.month,
      openingBalance: plan.openingBalance,
      currentOrderAmount: plan.currentOrderAmount,
      week1: plan.week1,
      week2: plan.week2,
      week3: plan.week3,
      week4: plan.week4,
      remarks: plan.remarks,
    } : {
      dealer: '',
      month: '',
      openingBalance: 0,
      currentOrderAmount: 0,
      week1: 0,
      week2: 0,
      week3: 0,
      week4: 0,
      remarks: '',
    });
  };

  const onSubmit = async (data) => {
    try {
      if (selectedPlan) {
        await crud.update(selectedPlan._id, data);
        toast.success('Collection plan updated');
      } else {
        await crud.create(data);
        toast.success('Collection plan created');
      }
      setShowForm(false);
      crud.fetchAll({ page, limit: 20 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save plan');
    }
  };

  const canManage = ['admin', 'nsm', 'rsm', 'asm', 'se', 'so'].includes(user?.role);

  /* ── FORM VIEW ─────────────────────────────────────── */
  if (showForm) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {selectedPlan ? 'Edit Collection Plan' : 'New Collection Plan'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Plan expected collections for a dealer by month and week</p>
        </div>
        <button className="btn-secondary" onClick={() => setShowForm(false)}>
          <FiArrowLeft className="inline-block mr-2" /> Back to Plans
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* dealer info */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 pb-2 border-b border-slate-100 dark:border-slate-700">
            Dealer & Period
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="label text-xs">Dealer *</label>
              <select {...register('dealer', { required: 'Dealer is required' })} className="input text-sm">
                <option value="">Select Dealer...</option>
                {dealers.map((dealer) => (
                  <option key={dealer._id} value={dealer._id}>{dealer.dealerName} — {dealer.area}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Month *</label>
              <input type="month" {...register('month', { required: 'Month is required' })} className="input text-sm" />
            </div>
            <div className="col-span-2">
              <label className="label text-xs">Remarks</label>
              <input {...register('remarks')} className="input text-sm" placeholder="Optional..." />
            </div>
          </div>
        </div>

        {/* collection spreadsheet */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 text-white font-semibold text-sm" style={{ background: '#14532d' }}>
            💰 Collection Plan Sheet
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: '#166534', color: '#fff' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold min-w-40">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold w-36" style={{ background: '#854d0e' }}>Opening Balance</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold w-36" style={{ background: '#1e40af' }}>Order Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold w-36" style={{ background: '#991b1b' }}>Total Due</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-32" style={{ background: '#14532d' }}>Week 1</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-32" style={{ background: '#166534' }}>Week 2</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-32" style={{ background: '#14532d' }}>Week 3</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold w-32" style={{ background: '#166534' }}>Week 4</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold w-36" style={{ background: '#14532d' }}>Total Collected</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold w-36" style={{ background: '#7f1d1d' }}>Closing Balance</th>
                </tr>
                <tr style={{ background: '#dcfce7', fontSize: '10px', color: '#475569' }}>
                  <td className="px-4 py-1">Enter values below</td>
                  <td className="px-4 py-1 text-right text-yellow-700 font-medium">Carried balance</td>
                  <td className="px-4 py-1 text-right text-blue-700 font-medium">Current month orders</td>
                  <td className="px-4 py-1 text-right text-red-700 font-medium">= Opening + Order</td>
                  <td className="px-4 py-1 text-center text-green-700">Target</td>
                  <td className="px-4 py-1 text-center text-green-700">Target</td>
                  <td className="px-4 py-1 text-center text-green-700">Target</td>
                  <td className="px-4 py-1 text-center text-green-700">Target</td>
                  <td className="px-4 py-1 text-right text-green-700 font-medium">= W1+W2+W3+W4</td>
                  <td className="px-4 py-1 text-right text-red-700 font-medium">= Due − Collected</td>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f8fafc' }}>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-600">Amount (NPR)</td>
                  {/* opening balance */}
                  <td className="px-4 py-3" style={{ background: '#fef9c3' }}>
                    <input {...register('openingBalance', { valueAsNumber: true, min: 0 })}
                      type="number" step="0.01" min="0"
                      className="w-full text-right text-sm font-bold border-2 border-yellow-300 rounded-lg px-2 py-2 focus:outline-none focus:border-yellow-500 bg-white" />
                  </td>
                  {/* order amount */}
                  <td className="px-4 py-3" style={{ background: '#dbeafe' }}>
                    <input {...register('currentOrderAmount', { valueAsNumber: true, min: 0 })}
                      type="number" step="0.01" min="0"
                      className="w-full text-right text-sm font-bold border-2 border-blue-300 rounded-lg px-2 py-2 focus:outline-none focus:border-blue-500 bg-white" />
                  </td>
                  {/* total due — auto */}
                  <TotalDueCell control={control} />
                  {/* week inputs */}
                  {['week1', 'week2', 'week3', 'week4'].map((w, i) => (
                    <td key={w} className="px-4 py-3" style={{ background: i % 2 === 0 ? '#f0fdf4' : '#dcfce7' }}>
                      <input {...register(w, { valueAsNumber: true, min: 0 })}
                        type="number" step="0.01" min="0"
                        className="w-full text-center text-sm font-bold border-2 border-green-300 rounded-lg px-2 py-2 focus:outline-none focus:border-green-500 bg-white" />
                    </td>
                  ))}
                  {/* total collected — auto */}
                  <TotalCollectedCell control={control} />
                  {/* closing balance — auto */}
                  <ClosingBalanceCell control={control} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <LiveSummary control={control} />

        <div className="card p-4">
          <label className="label text-xs">Remarks (detailed)</label>
          <textarea {...register('remarks')} className="input text-sm h-20" placeholder="Optional notes about this plan..." />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          <button type="submit" className="btn-primary px-8" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : selectedPlan ? 'Update Plan' : 'Create Plan'}
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Collection Plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">{crud.total} total records</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => openForm(null)}>
            <FiPlus /> New Plan
          </button>
        )}
      </div>

      <div className="card p-0">
        {crud.loading ? (
          <PageLoader />
        ) : crud.data.length === 0 ? (
          <EmptyState icon={FiCalendar} title="No collection plans yet" description="Add a collection plan for a dealer to begin forecasting."
            action={canManage && <button className="btn-primary" onClick={() => openForm(null)}><FiPlus />New Plan</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: '#14532d', color: '#fff' }}>
                    <th className="px-3 py-3 text-left text-xs font-semibold">Dealer</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold">Month</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold" style={{ background: '#854d0e' }}>Opening Bal.</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold" style={{ background: '#1e40af' }}>Order Amt.</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold" style={{ background: '#991b1b' }}>Total Due</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold" style={{ background: '#166534' }}>W1</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold" style={{ background: '#14532d' }}>W2</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold" style={{ background: '#166534' }}>W3</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold" style={{ background: '#14532d' }}>W4</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold" style={{ background: '#166534' }}>Total Coll.</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold" style={{ background: '#7f1d1d' }}>Closing Bal.</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {crud.data.map((plan, i) => (
                    <tr key={plan._id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-bold text-slate-800 text-xs">{plan.dealer?.dealerName || 'Unknown'}</td>
                      <td className="px-3 py-3 text-slate-500 text-xs">{plan.month || '—'}</td>
                      <td className="px-3 py-3 text-right text-xs font-medium text-yellow-700" style={{ background: '#fefce8' }}>{formatCurrency(plan.openingBalance)}</td>
                      <td className="px-3 py-3 text-right text-xs font-medium text-blue-700" style={{ background: '#eff6ff' }}>{formatCurrency(plan.currentOrderAmount)}</td>
                      <td className="px-3 py-3 text-right text-xs font-bold text-red-700" style={{ background: '#fef2f2' }}>{formatCurrency(plan.totalDue)}</td>
                      <td className="px-3 py-3 text-center text-xs text-green-700 font-medium" style={{ background: '#f0fdf4' }}>{formatCurrency(plan.week1)}</td>
                      <td className="px-3 py-3 text-center text-xs text-green-700 font-medium" style={{ background: '#dcfce7' }}>{formatCurrency(plan.week2)}</td>
                      <td className="px-3 py-3 text-center text-xs text-green-700 font-medium" style={{ background: '#f0fdf4' }}>{formatCurrency(plan.week3)}</td>
                      <td className="px-3 py-3 text-center text-xs text-green-700 font-medium" style={{ background: '#dcfce7' }}>{formatCurrency(plan.week4)}</td>
                      <td className="px-3 py-3 text-right text-xs font-bold text-green-700" style={{ background: '#f0fdf4' }}>{formatCurrency(plan.totalCollection)}</td>
                      <td className="px-3 py-3 text-right text-xs font-bold"
                        style={{ background: plan.closingBalance > 0 ? '#fef2f2' : '#f0fdf4', color: plan.closingBalance > 0 ? '#dc2626' : '#16a34a' }}>
                        {formatCurrency(plan.closingBalance)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {canManage && (
                            <button onClick={() => openForm(plan)} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50">
                              <FiEdit2 size={13} />
                            </button>
                          )}
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => crud.remove(plan._id).then(() => crud.fetchAll({ page: 1, limit: 20 }))}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
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
    </div>
  );
}
