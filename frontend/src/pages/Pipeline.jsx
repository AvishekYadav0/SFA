import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  FiRefreshCw, FiCheck, FiX, FiArrowRight, FiPackage,
  FiTruck, FiCheckCircle, FiClock, FiDollarSign,
} from 'react-icons/fi';

const PAYMENT_METHODS = [
  { value: 'cash',    label: 'Cash' },
  { value: 'online',  label: 'Online' },
  { value: 'credit',  label: 'Credit' },
  { value: 'bank',    label: 'Bank Transfer' },
  { value: 'esewa',   label: 'eSewa' },
  { value: 'fonepay', label: 'FonePay' },
  { value: 'cheque',  label: 'Cheque' },
];

const STAGES = [
  { key: 'pending',          label: 'Pending',       icon: FiClock,        color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A',  next: 'approved',         nextLabel: 'Approve'  },
  { key: 'approved',         label: 'Approved',      icon: FiCheck,        color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE',  next: 'warehouse',        nextLabel: 'Send to Warehouse' },
  { key: 'warehouse',        label: 'Warehouse',     icon: FiPackage,      color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE',  next: 'out_for_delivery', nextLabel: 'Dispatch' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: FiTruck,     color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC',  next: 'delivered',        nextLabel: 'Mark Delivered' },
  { key: 'delivered',        label: 'Delivered',     icon: FiCheckCircle,  color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0',  next: 'completed',        nextLabel: 'Complete' },
  { key: 'completed',        label: 'Completed',     icon: FiCheckCircle,  color: '#15803D', bg: '#DCFCE7', border: '#86EFAC',  next: null,               nextLabel: null },
];

const STATUS_MAP = Object.fromEntries(STAGES.map(s => [s.key, s]));

export default function Pipeline() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(null);
  const [activeStage, setActiveStage] = useState('pending');
  const [payModal, setPayModal] = useState(null); // { orderId, grandTotal }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders', { params: { limit: 500 } });
      const all = res.data.data || [];
      // exclude rejected/cancelled from pipeline view
      setOrders(all.filter(o => !['rejected', 'cancelled'].includes(o.status)));
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const move = async (orderId, status, extra = {}) => {
    setMoving(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status, ...extra });
      toast.success(`Order moved to ${STATUS_MAP[status]?.label}`);
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status, ...extra } : o));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error updating status');
    } finally { setMoving(null); }
  };

  const openPayModal = (order) => setPayModal({ orderId: order._id, grandTotal: order.grandTotal });

  const completeWithPayment = async ({ collectedAmount, paymentMethod }) => {
    const { orderId } = payModal;
    setPayModal(null);
    await move(orderId, 'completed', { collectedAmount: +collectedAmount, paymentMethod });
  };

  const reject = async (orderId) => {
    setMoving(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'rejected' });
      toast.success('Order rejected');
      setOrders(prev => prev.filter(o => o._id !== orderId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally { setMoving(null); }
  };

  const grouped = STAGES.reduce((acc, s) => {
    acc[s.key] = orders.filter(o => o.status === s.key);
    return acc;
  }, {});

  const pendingCount = grouped['pending']?.length || 0;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sales Pipeline</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pendingCount > 0
              ? <span className="text-amber-600 font-medium">{pendingCount} order{pendingCount > 1 ? 's' : ''} awaiting approval</span>
              : 'All orders up to date'}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 btn-secondary text-xs px-3 py-2">
          <FiRefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stage summary pills */}
      <div className="flex gap-2 flex-wrap">
        {STAGES.map(s => {
          const count = grouped[s.key]?.length || 0;
          return (
            <button key={s.key}
              onClick={() => setActiveStage(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                activeStage === s.key ? 'shadow-md scale-105' : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                background: activeStage === s.key ? s.color : s.bg,
                borderColor: s.border,
                color: activeStage === s.key ? '#fff' : s.color,
              }}>
              <s.icon size={11} />
              {s.label}
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: activeStage === s.key ? 'rgba(255,255,255,0.25)' : s.border }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Payment modal */}
      {payModal && (
        <PaymentModal
          grandTotal={payModal.grandTotal}
          onConfirm={completeWithPayment}
          onClose={() => setPayModal(null)}
        />
      )}

      {/* Kanban columns — desktop: all visible, mobile: active stage only */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAGES.map(stage => {
          const stageOrders = grouped[stage.key] || [];
          const isVisible = activeStage === stage.key;

          return (
            <div key={stage.key}
              className={`rounded-2xl border-2 overflow-hidden flex flex-col ${!isVisible ? 'hidden lg:flex' : 'flex'}`}
              style={{ borderColor: stage.border, background: stage.bg }}>

              {/* Column header */}
              <div className="px-3 py-2.5 flex items-center gap-2 border-b-2" style={{ borderColor: stage.border, background: stage.color }}>
                <stage.icon className="text-white flex-shrink-0" size={13} />
                <span className="text-white font-bold text-xs truncate">{stage.label}</span>
                <span className="ml-auto text-[10px] bg-white/25 text-white px-2 py-0.5 rounded-full font-bold">
                  {stageOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[60vh]">
                {stageOrders.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6 italic">No orders</p>
                ) : (
                  stageOrders.map(order => (
                    <OrderCard
                      key={order._id}
                      order={order}
                      stage={stage}
                      moving={moving === order._id}
                      onMove={move}
                      onReject={reject}
                      onComplete={openPayModal}
                      canApprove={user?.role === 'admin'}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Order Card ──────────────────────────────────────── */
function OrderCard({ order, stage, moving, onMove, onReject, onComplete, canApprove }) {
  const isDelivered = stage.key === 'delivered';
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 space-y-2">
      <div className="flex items-start justify-between gap-1">
        <span className="font-bold text-primary-600 text-xs">{order.orderNumber}</span>
        <span className="text-[10px] text-slate-400">{formatDate(order.date)}</span>
      </div>

      <div className="space-y-0.5">
        <p className="text-xs font-medium text-slate-700 truncate">{order.dealer?.dealerName || '—'}</p>
        <p className="text-[10px] text-slate-400 truncate">{order.salesperson?.fullName || '—'}</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">{formatCurrency(order.grandTotal)}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize"
          style={{ background: stage.bg, color: stage.color, border: `1px solid ${stage.border}` }}>
          {order.paymentType || order.paymentMethod || 'cash'}
        </span>
      </div>

      {/* Action buttons */}
      {canApprove && stage.next && (
        <div className="flex gap-1 pt-1">
          <button
            onClick={() => isDelivered ? onComplete(order) : onMove(order._id, stage.next)}
            disabled={moving}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold py-1.5 rounded-lg text-white transition-opacity disabled:opacity-50"
            style={{ background: stage.color }}>
            {moving
              ? <FiRefreshCw size={10} className="animate-spin" />
              : isDelivered ? <FiDollarSign size={10} /> : <FiArrowRight size={10} />}
            {stage.nextLabel}
          </button>
          {stage.key === 'pending' && (
            <button
              onClick={() => onReject(order._id)}
              disabled={moving}
              className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50">
              <FiX size={12} />
            </button>
          )}
        </div>
      )}

      {stage.key === 'completed' && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center gap-1">
            <FiCheckCircle size={11} className="text-green-500" />
            <span className="text-[10px] text-green-600 font-medium">Payment Complete</span>
          </div>
          {order.collectedAmount > 0 && (
            <p className="text-[10px] text-slate-500">
              Collected: <span className="font-bold text-green-700">{formatCurrency(order.collectedAmount)}</span>
              {order.paymentMethod && <span className="ml-1 capitalize">· {order.paymentMethod}</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Payment Modal ───────────────────────────────────── */
function PaymentModal({ grandTotal, onConfirm, onClose }) {
  const [collectedAmount, setCollectedAmount] = useState(grandTotal || '');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!collectedAmount || +collectedAmount < 0) return toast.error('Enter a valid amount');
    onConfirm({ collectedAmount, paymentMethod });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Complete Payment</h2>
            <p className="text-xs text-slate-500 mt-0.5">Order total: <span className="font-bold text-slate-700">{formatCurrency(grandTotal)}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <FiX size={16} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Collected Amount (NPR)</label>
            <input
              type="number" min="0" step="0.01" required
              value={collectedAmount}
              onChange={e => setCollectedAmount(e.target.value)}
              className="input text-sm w-full"
              placeholder="Enter amount collected"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="input text-sm w-full">
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {+collectedAmount < +grandTotal && +collectedAmount > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              ⚠ Outstanding: {formatCurrency(grandTotal - collectedAmount)}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 btn-secondary text-sm py-2">Cancel</button>
            <button type="submit"
              className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-1.5">
              <FiCheckCircle size={14} /> Confirm Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
