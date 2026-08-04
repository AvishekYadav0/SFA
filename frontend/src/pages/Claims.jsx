import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { claimService, dealerService, productService } from '../services';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/common/Spinner';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../components/common/index.jsx';
import {
  FiPlus, FiCheck, FiX, FiEye, FiPaperclip,
  FiAlertTriangle, FiRefreshCw, FiClock, FiDollarSign,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const CLAIM_TYPES = [
  'Primary Scheme', 'Secondary Scheme', 'SLSB', 'RD', 'Transportation',
  'Sampling', 'Leakage', 'Breakage', 'Display', 'Others',
];

const STATUS_STYLES = {
  'Draft':                     'bg-slate-100 text-slate-600',
  'Pending ASM Approval':      'bg-amber-100 text-amber-700',
  'Pending RSM Approval':      'bg-orange-100 text-orange-700',
  'Pending NSM Approval':      'bg-yellow-100 text-yellow-700',
  'Pending Accounts Approval': 'bg-blue-100 text-blue-700',
  'Approved':                  'bg-green-100 text-green-700',
  'Paid':                      'bg-purple-100 text-purple-700',
  'Rejected':                  'bg-red-100 text-red-700',
};

// ── Per-type calc fields ──────────────────────────────────────────────────────
function CalcFields({ claimType, register, setValue, products, selectedProductId }) {
  // Auto-fill rate when product changes, for types that use rate
  useEffect(() => {
    const usesProductRate = ['Primary Scheme','Secondary Scheme','SLSB','RD','Sampling','Leakage','Breakage'].includes(claimType);
    if (!usesProductRate || !selectedProductId) return;
    const p = products.find(p => p._id === selectedProductId);
    if (p?.rate) setValue('rate', p.rate);
  }, [selectedProductId, claimType, products, setValue]);

  switch (claimType) {
    case 'Primary Scheme':
    case 'Secondary Scheme':
    case 'SLSB':
    case 'Sampling':
    case 'Leakage':
    case 'Breakage':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Quantity</label>
            <input {...register('quantity', { required: true })} type="number" className="input" placeholder="Units" /></div>
          <div><label className="label">Rate (NPR)</label>
            <input {...register('rate', { required: true })} type="number" step="0.01" className="input" placeholder="Auto-filled from product" /></div>
        </div>
      );
    case 'RD':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Quantity</label>
            <input {...register('quantity', { required: true })} type="number" className="input" /></div>
          <div><label className="label">Invoice Value (NPR)</label>
            <input {...register('rate', { required: true })} type="number" step="0.01" className="input" placeholder="Auto-filled from product" /></div>
          <p className="col-span-2 text-xs text-slate-400">RD = 2% of invoice value × qty</p>
        </div>
      );
    case 'Transportation':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Distance (km)</label>
            <input {...register('km', { required: true })} type="number" className="input" /></div>
          <div><label className="label">Rate/km (NPR, default 15)</label>
            <input {...register('ratePerKm')} type="number" step="0.01" className="input" placeholder="15" /></div>
        </div>
      );
    case 'Display':
      return (
        <div><label className="label">Display Amount (NPR)</label>
          <input {...register('displayAmount', { required: true })} type="number" step="0.01" className="input" /></div>
      );
    case 'Others':
      return (
        <div><label className="label">Amount (NPR)</label>
          <input {...register('otherAmount', { required: true })} type="number" step="0.01" className="input" /></div>
      );
    default: return null;
  }
}

// ── Create Claim Modal ────────────────────────────────────────────────────────
function CreateClaimModal({ open, onClose, onSuccess }) {
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({ defaultValues: { claimType: 'Primary Scheme' } });
  const [dealers, setDealers]   = useState([]);
  const [products, setProducts] = useState([]);
  const claimType = watch('claimType');

  useEffect(() => {
    if (!open) return;
    dealerService.getAll({ limit: 1000 }).then(r => setDealers(r.data.data || [])).catch(() => {});
    productService.getAll({ limit: 1000 }).then(r => setProducts(r.data.data || [])).catch(() => {});
    reset({ claimType: 'Primary Scheme' });
  }, [open, reset]);

  const onSubmit = async (data) => {
    try {
      await claimService.create(data);
      toast.success('Claim submitted for ASM approval!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit claim.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Submit New Claim">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-xs text-blue-700 dark:text-blue-300">
          ℹ️ Claim amount is auto-calculated from the inputs below based on scheme rules.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Claim Type</label>
            <select {...register('claimType', { required: true })} className="input">
              {CLAIM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <CalcFields claimType={claimType} register={register} />
          </div>

          <div>
            <label className="label">Associated Dealer (Optional)</label>
            <select {...register('dealer')} className="input">
              <option value="">None</option>
              {dealers.map(d => <option key={d._id} value={d._id}>{d.dealerName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Associated Product (Optional)</label>
            <select {...register('product')} className="input">
              <option value="">None</option>
              {products.map(p => <option key={p._id} value={p._id}>{p.productName}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="label">Details / Justification</label>
            <textarea {...register('details', { required: 'Details are required' })}
              className="input" rows="3" placeholder="Provide a clear reason for the claim..." />
            {errors.details && <p className="text-danger text-xs mt-1">{errors.details.message}</p>}
          </div>

          {/* Required uploads — use dot notation for nested arrays in react-hook-form */}
          <div className="sm:col-span-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <FiPaperclip className="inline mr-1" /> Attachments (file URLs or paths)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input {...register('attachments.vatBill')}       className="input" placeholder="VAT Bill URL" />
              <input {...register('attachments.photos.0')}      className="input" placeholder="Photo URL" />
              <input {...register('attachments.invoice')}       className="input" placeholder="Invoice URL" />
              <input {...register('attachments.transportBill')} className="input" placeholder="Transport Bill URL" />
            </div>
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

// ── Resubmit Modal ────────────────────────────────────────────────────────────
function ResubmitModal({ open, onClose, claim, onSuccess }) {
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handle = async () => {
    setSubmitting(true);
    try {
      await claimService.resubmit(claim._id, { remarks });
      toast.success('Claim resubmitted for approval!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resubmit.');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Resubmit Claim: ${claim?.claimId}`}>
      <div className="space-y-4">
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-xs text-red-700 dark:text-red-300">
          <strong>Rejection reason:</strong> {claim?.rejectionReason || 'No reason provided.'}
        </div>
        <div>
          <label className="label">Resubmission Note</label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
            className="input" rows="3" placeholder="Explain what was corrected..." />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handle} disabled={submitting}>
            {submitting ? 'Resubmitting...' : 'Resubmit Claim'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Approval Action Modal ─────────────────────────────────────────────────────
function ActionModal({ open, onClose, claim, onSuccess, user }) {
  const [remarks, setRemarks]       = useState('');
  const [action, setAction]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) { setRemarks(''); setAction(''); } }, [open]);

  if (!open || !claim) return null;

  // canAct: only true when this user's role matches the CURRENT pending step
  const stepRoleMap = {
    'Pending ASM Approval':      'asm',
    'Pending RSM Approval':      'rsm',
    'Pending NSM Approval':      'nsm',
    'Pending Accounts Approval': 'admin',
  };
  const canAct = stepRoleMap[claim.status] === user?.role;
  const canMarkPaid = user?.role === 'admin' && claim.status === 'Approved';

  const handleAction = async () => {
    if (!action) return toast.error('Please select an action.');
    if (action === 'reject' && !remarks) return toast.error('Rejection remarks are required.');
    setSubmitting(true);
    try {
      await claimService.process(claim._id, { action, remarks });
      toast.success(action === 'approve' ? 'Claim approved ✓' : action === 'paid' ? 'Marked as Paid ✓' : 'Claim rejected');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process claim.');
    } finally { setSubmitting(false); }
  };

  // Render calc inputs for approver verification
  const calcInputs = claim.calcInputs || {};
  const calcLines  = Object.entries(calcInputs).filter(([, v]) => v !== undefined && v !== null && v !== '');

  return (
    <Modal open={open} onClose={onClose} title={`Review Claim: ${claim.claimId}`}>
      <div className="space-y-4">
        {/* Claim summary */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1.5 text-xs">
          <p className="text-slate-500">Type: <span className="font-semibold text-slate-800 dark:text-white">{claim.claimType}</span></p>
          <p className="text-slate-500">Calculated Amount: <span className="font-semibold text-slate-800 dark:text-white">{formatCurrency(claim.calculatedAmount)}</span></p>
          {calcLines.length > 0 && (
            <p className="text-slate-500">Calc Inputs: <span className="text-slate-700 dark:text-slate-300">
              {calcLines.map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </span></p>
          )}
          <p className="text-slate-500">Submitted by: <span className="font-semibold text-slate-800 dark:text-white">{claim.submittedBy?.name}</span></p>
          <p className="text-slate-500">Status: <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[claim.status]}`}>{claim.status}</span></p>
          {claim.details && <p className="text-slate-500">Details: <span className="text-slate-700 dark:text-slate-300">{claim.details}</span></p>}
        </div>

        {/* Attachments */}
        {(claim.attachments?.vatBill || claim.attachments?.invoice || claim.attachments?.transportBill || claim.attachments?.photos?.length > 0) && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1"><FiPaperclip className="inline mr-1" />Attachments</p>
            {claim.attachments.vatBill       && <p>VAT Bill: <a href={claim.attachments.vatBill}       target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a></p>}
            {claim.attachments.invoice       && <p>Invoice: <a href={claim.attachments.invoice}        target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a></p>}
            {claim.attachments.transportBill && <p>Transport Bill: <a href={claim.attachments.transportBill} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a></p>}
            {claim.attachments.photos?.map((p, i) => p && <p key={i}>Photo {i + 1}: <a href={p} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a></p>)}
          </div>
        )}

        {/* Approval history */}
        {claim.approvalHistory?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Approval History</p>
            <div className="space-y-2">
              {claim.approvalHistory.map((h, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] ${
                    h.action === 'Approved' || h.action === 'Paid' ? 'bg-green-500' : h.action === 'Rejected' ? 'bg-red-500' : 'bg-blue-500'
                  }`}>
                    {h.action === 'Approved' || h.action === 'Paid' ? '✓' : h.action === 'Rejected' ? '✗' : '→'}
                  </div>
                  <div>
                    <span className="font-medium text-slate-800 dark:text-white">{h.approver?.name || 'System'}</span>
                    <span className="text-slate-400 mx-1">·</span>
                    <span className="text-slate-500">{h.action}</span>
                    {h.remarks && <span className="text-slate-400"> — {h.remarks}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejection reason visible to SE */}
        {claim.status === 'Rejected' && claim.rejectionReason && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-xs text-red-700 dark:text-red-300">
            <strong>Rejected:</strong> {claim.rejectionReason}
          </div>
        )}

        {/* Action buttons — only for the current step's approver */}
        {canAct && (
          <>
            <div>
              <label className="label">Action</label>
              <div className="flex gap-3">
                <button onClick={() => setAction('approve')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${action === 'approve' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-green-300'}`}>
                  <FiCheck /> Approve
                </button>
                <button onClick={() => setAction('reject')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${action === 'reject' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600 hover:border-red-300'}`}>
                  <FiX /> Reject
                </button>
              </div>
            </div>
            <div>
              <label className="label">Remarks {action === 'reject' && <span className="text-danger">*</span>}</label>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
                className="input" rows="2" placeholder="Add notes..." />
            </div>
          </>
        )}

        {/* Mark as Paid — admin only, after Approved */}
        {canMarkPaid && (
          <button onClick={() => setAction('paid')}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${action === 'paid' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-600 hover:border-purple-300'}`}>
            <FiDollarSign /> Mark as Paid
          </button>
        )}

        {(canAct || canMarkPaid) && (
          <div className="flex justify-end">
            <button onClick={handleAction} className="btn-primary" disabled={submitting || !action}>
              {submitting ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Main Claims Page ──────────────────────────────────────────────────────────
export default function Claims() {
  const { user } = useAuth();
  const [claims, setClaims]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [createModal, setCreateModal]     = useState(false);
  const [actionModal, setActionModal]     = useState({ open: false, claim: null });
  const [resubmitModal, setResubmitModal] = useState({ open: false, claim: null });

  const isSE       = user?.role === 'se';
  const canApprove = ['asm', 'rsm', 'nsm', 'admin'].includes(user?.role);
  const canSubmit  = ['se', 'asm', 'rsm', 'nsm', 'admin'].includes(user?.role);

  const myPendingStatus = {
    asm:   'Pending ASM Approval',
    rsm:   'Pending RSM Approval',
    nsm:   'Pending NSM Approval',
    admin: 'Pending Accounts Approval',
  }[user?.role];

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await claimService.getAll();
      setClaims(res.data.data || []);
    } catch {
      toast.error('Failed to load claims.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchClaims(); }, []);

  const pendingClaims = claims.filter(c => myPendingStatus && c.status === myPendingStatus);
  const otherClaims   = claims.filter(c => !myPendingStatus || c.status !== myPendingStatus);

  const ClaimRow = ({ c }) => {
    // Submitter can view history on their own claims that have progressed
    const isOwner = c.submittedBy?._id === user?._id || c.submittedBy?._id?.toString() === user?._id?.toString();
    const seCanViewHistory = isOwner && !['Draft', 'Pending ASM Approval'].includes(c.status);
    // Approver can view history on any claim in their scope that isn't their active pending step
    const approverCanViewHistory = canApprove && c.status !== myPendingStatus;

    return (
      <tr key={c._id}>
        <td className="font-medium text-primary-600">{c.claimId}</td>
        <td>{formatDate(c.createdAt)}</td>
        <td>{c.submittedBy?.name}</td>
        <td><span className="badge-info">{c.claimType}</span></td>
        <td className="font-medium">{formatCurrency(c.calculatedAmount)}</td>
        <td>
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[c.status] || 'bg-slate-100'}`}>
            {c.status}
          </span>
        </td>
        <td>
          <div className="flex items-center gap-1">
            {/* Approver: action button for their pending step */}
            {canApprove && c.status === myPendingStatus && (
              <button onClick={() => setActionModal({ open: true, claim: c })}
                className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600 transition-colors" title="Review">
                <FiEye className="text-sm" />
              </button>
            )}
            {/* Admin: view approved claims to mark paid */}
            {user?.role === 'admin' && c.status === 'Approved' && (
              <button onClick={() => setActionModal({ open: true, claim: c })}
                className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg text-purple-600 transition-colors" title="Mark Paid">
                <FiDollarSign className="text-sm" />
              </button>
            )}
            {/* View history */}
            {(seCanViewHistory || approverCanViewHistory) && (
              <button onClick={() => setActionModal({ open: true, claim: c })}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors" title="View History">
                <FiClock className="text-sm" />
              </button>
            )}
            {/* Any submitter: rejection reason + resubmit on their own rejected claims */}
            {isOwner && c.status === 'Rejected' && (
              <div className="flex items-center gap-1">
                <div className="group relative">
                  <FiAlertTriangle className="text-danger cursor-help" />
                  <div className="absolute bottom-full left-0 mb-2 w-52 bg-slate-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-normal">
                    <strong>Rejected:</strong> {c.rejectionReason || 'No reason provided.'}
                  </div>
                </div>
                <button onClick={() => setResubmitModal({ open: true, claim: c })}
                  className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg text-amber-600 transition-colors" title="Resubmit">
                  <FiRefreshCw className="text-sm" />
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const ClaimsTable = ({ rows, emptyMsg }) => (
    rows.length === 0
      ? <p className="text-sm text-slate-400 text-center py-8">{emptyMsg}</p>
      : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Claim ID</th><th>Date</th><th>Submitted By</th><th>Type</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>{rows.map(c => <ClaimRow key={c._id} c={c} />)}</tbody>
          </table>
        </div>
      )
  );

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Claims</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSE ? 'Submit and track your claims' : canApprove ? `Review and process claims · ${pendingClaims.length} pending your action` : 'My Claims'}
          </p>
        </div>
        {canSubmit && (
          <button className="btn-primary" onClick={() => setCreateModal(true)}>
            <FiPlus /> New Claim
          </button>
        )}
      </div>

      {/* Pending action section for approvers */}
      {canApprove && pendingClaims.length > 0 && (
        <div className="card p-0">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Pending Your Approval ({pendingClaims.length})</h2>
          </div>
          <ClaimsTable rows={pendingClaims} emptyMsg="No claims pending your approval." />
        </div>
      )}

      {/* All claims */}
      <div className="card p-0">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">
            {canApprove ? 'All Claims History' : 'My Claims'}
          </h2>
        </div>
        {claims.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FiPaperclip className="mx-auto text-4xl mb-2" />
            <p>No claims found.</p>
            {canSubmit && <button className="btn-primary mt-4" onClick={() => setCreateModal(true)}><FiPlus /> Submit First Claim</button>}
          </div>
        ) : (
          <ClaimsTable rows={canApprove ? otherClaims : claims} emptyMsg="No claims in history." />
        )}
      </div>

      {canSubmit && (
        <CreateClaimModal open={createModal} onClose={() => setCreateModal(false)} onSuccess={fetchClaims} />
      )}

      <ActionModal
        open={actionModal.open}
        onClose={() => setActionModal({ open: false, claim: null })}
        claim={actionModal.claim}
        onSuccess={fetchClaims}
        user={user}
      />

      <ResubmitModal
        open={resubmitModal.open}
        onClose={() => setResubmitModal({ open: false, claim: null })}
        claim={resubmitModal.claim}
        onSuccess={fetchClaims}
      />
    </div>
  );
}
