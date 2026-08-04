import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { dealerService, claimService, productService } from '../services';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/common/Spinner';
import { formatCurrency, formatDate } from '../components/common/index.jsx';
import { FiUser, FiPhone, FiMapPin, FiCreditCard, FiShoppingBag, FiDollarSign, FiFileText, FiAlertCircle, FiPlus } from 'react-icons/fi';
import { Modal } from '../components/common/Modal';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  pending:          'bg-amber-100 text-amber-700',
  approved:         'bg-green-100 text-green-700',
  rejected:         'bg-red-100 text-red-700',
  completed:        'bg-blue-100 text-blue-700',
  delivered:        'bg-teal-100 text-teal-700',
  'Paid':           'bg-purple-100 text-purple-700',
  'Approved':       'bg-green-100 text-green-700',
  'Rejected':       'bg-red-100 text-red-700',
  'Pending ASM Approval':      'bg-amber-100 text-amber-700',
  'Pending RSM Approval':      'bg-orange-100 text-orange-700',
  'Pending NSM Approval':      'bg-yellow-100 text-yellow-700',
  'Pending Accounts Approval': 'bg-blue-100 text-blue-700',
};

const Badge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
    {status}
  </span>
);

const CLAIM_TYPES = [
  'Primary Scheme', 'Secondary Scheme', 'SLSB', 'RD', 'Transportation',
  'Sampling', 'Leakage', 'Breakage', 'Display', 'Others',
];

const TABS = ['Orders', 'Collections', 'Claims'];

function CreateClaimModal({ open, onClose, onSuccess }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (open) {
      productService.getAll({ limit: 1000 }).then(r => setProducts(r.data.data));
      reset();
    }
  }, [open, reset]);

  const onSubmit = async (data) => {
    try {
      // In a real app, amount would be auto-calculated based on rules.
      // Here we simulate it by taking a manual amount.
      const amount = parseFloat(data.calculatedAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid claim amount.');
        return;
      }
      await claimService.create({ ...data, calculatedAmount: amount });
      toast.success('Claim submitted for approval!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit claim.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit New Claim">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Claim Type</label>
            <select {...register('claimType', { required: true })} className="input">
              {CLAIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Claim Amount (NPR)</label>
            <input {...register('calculatedAmount', { required: 'Amount is required', valueAsNumber: true })}
              type="number" step="0.01" className="input" placeholder="Enter claim amount" />
            {errors.calculatedAmount && <p className="text-danger text-xs mt-1">{errors.calculatedAmount.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Associated Product (Optional)</label>
            <select {...register('product')} className="input">
              <option value="">None</option>
              {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Details / Justification</label>
            <textarea {...register('details', { required: 'Details are required' })} className="input" rows="3" placeholder="Provide a clear reason for the claim..."></textarea>
            {errors.details && <p className="text-danger text-xs mt-1">{errors.details.message}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function DealerPortal() {
  const { user } = useAuth();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [tab, setTab]       = useState('Orders');
  const [claimModal, setClaimModal] = useState(false);

  useEffect(() => {
    dealerService.getMyProfile()
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load dealer profile.'))
      .finally(() => setLoading(false));
  }, []);
  
  const fetchProfile = () => {
    dealerService.getMyProfile()
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load dealer profile.'))
      .finally(() => setLoading(false));
  }
  
  if (loading) return <PageLoader />;

  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
      <FiAlertCircle className="text-4xl text-red-400" />
      <p className="text-sm text-red-500">{error}</p>
      <p className="text-xs text-slate-400">Ask your admin to link a dealer profile to your account.</p>
    </div>
  );

  const { dealer, orders = [], collections = [], claims = [] } = data;

  // Outstanding = opening balance + total orders - total collected
  const totalOrdered   = orders.reduce((s, o) => s + (o.grandTotal || 0), 0);
  const totalCollected = collections.reduce((s, c) => s + (c.totalCollection || 0), 0);
  const outstanding    = (dealer.openingBalance || 0) + totalOrdered - totalCollected;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{dealer.dealerName}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Dealer Portal · Welcome, {user?.name}</p>
      </div>

      {/* Profile card */}
      <div className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <InfoRow icon={FiUser}      label="Owner"        value={dealer.ownerName} />
        <InfoRow icon={FiPhone}     label="Phone"        value={dealer.phone} />
        <InfoRow icon={FiMapPin}    label="Address"      value={[dealer.address, dealer.area, dealer.province].filter(Boolean).join(', ')} />
        <InfoRow icon={FiFileText}  label="VAT Number"   value={dealer.vatNumber || '—'} />
        <InfoRow icon={FiFileText}  label="PAN Number"   value={dealer.panNumber || '—'} />
        <InfoRow icon={FiCreditCard} label="Credit Limit" value={formatCurrency(dealer.creditLimit)} />
        <InfoRow icon={FiDollarSign} label="Outstanding"  value={formatCurrency(outstanding)}
          valueClass={outstanding > dealer.creditLimit ? 'text-red-600 font-bold' : 'text-slate-900 dark:text-white font-semibold'} />
      </div>

      {/* Credit utilisation bar */}
      {dealer.creditLimit > 0 && (
        <div className="card">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Credit Utilisation</span>
            <span>{Math.min(100, Math.round((outstanding / dealer.creditLimit) * 100))}% of {formatCurrency(dealer.creditLimit)}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${outstanding > dealer.creditLimit ? 'bg-red-500' : outstanding > dealer.creditLimit * 0.8 ? 'bg-amber-400' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, (outstanding / dealer.creditLimit) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="card p-0">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
          <div className="flex">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                {t}
                <span className="ml-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">
                  {t === 'Orders' ? orders.length : t === 'Collections' ? collections.length : claims.length}
                </span>
              </button>
            ))}
          </div>
          <button className="btn-primary mr-4" onClick={() => setClaimModal(true)}><FiPlus /> New Claim</button>
        </div>

        {/* Orders tab */}
        {tab === 'Orders' && (
          orders.length === 0
            ? <Empty icon={FiShoppingBag} msg="No orders yet." />
            : (
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Order #</th><th>Date</th><th>Items</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o._id}>
                        <td className="font-medium text-primary-600">{o.orderNumber}</td>
                        <td>{formatDate(o.date)}</td>
                        <td className="text-slate-500 text-xs">{o.items?.map(i => i.productName || i.product?.productName).filter(Boolean).join(', ') || '—'}</td>
                        <td className="font-medium">{formatCurrency(o.grandTotal)}</td>
                        <td><Badge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}

        {/* Collections tab */}
        {tab === 'Collections' && (
          collections.length === 0
            ? <Empty icon={FiDollarSign} msg="No collection records yet." />
            : (
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Month</th><th>Opening Bal.</th><th>Order Amt.</th><th>Collected</th><th>Closing Bal.</th></tr></thead>
                  <tbody>
                    {collections.map(c => (
                      <tr key={c._id}>
                        <td className="font-medium">{c.month}</td>
                        <td>{formatCurrency(c.openingBalance)}</td>
                        <td>{formatCurrency(c.currentOrderAmount)}</td>
                        <td className="text-green-600 font-medium">{formatCurrency(c.totalCollection)}</td>
                        <td className={c.closingBalance > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>{formatCurrency(c.closingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}

        {/* Claims tab */}
        {tab === 'Claims' && (
          claims.length === 0
            ? <Empty icon={FiFileText} msg="No claims yet." />
            : (
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Claim ID</th><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {claims.map(c => (
                      <tr key={c._id}>
                        <td className="font-medium text-primary-600">{c.claimId}</td>
                        <td>{formatDate(c.createdAt)}</td>
                        <td><span className="badge-info">{c.claimType}</span></td>
                        <td className="font-medium">{formatCurrency(c.calculatedAmount)}</td>
                        <td><Badge status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}
      </div>

      <CreateClaimModal
        open={claimModal}
        onClose={() => setClaimModal(false)}
        onSuccess={fetchProfile}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, valueClass }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="text-slate-500 text-sm" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`text-sm ${valueClass || 'text-slate-900 dark:text-white font-medium'}`}>{value || '—'}</p>
      </div>
    </div>
  );
}

function Empty({ icon: Icon, msg }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <Icon className="text-3xl mb-2 opacity-40" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}
