import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { targetService, userService } from '../services';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Pagination } from '../components/common/Pagination';
import { EmptyState } from '../components/common/EmptyState';
import { PageLoader } from '../components/common/Spinner';
import { FiPlus, FiEdit2, FiTrash2, FiTarget } from 'react-icons/fi';
import toast from 'react-hot-toast';

const fmt = (n) => new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(n || 0);
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Targets() {
  const [targets, setTargets] = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [users, setUsers]     = useState([]);
  const [modal, setModal]     = useState({ open: false, data: null });
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [page, setPage]       = useState(1);
  const now = new Date();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const load = () => {
    setLoading(true);
    targetService.getAll({ page, limit: 15 })
      .then(r => { setTargets(r.data.data || []); setTotal(r.data.total || 0); setPages(r.data.pages || 1); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => {
    userService.getAll({ limit: 500 }).then(r => setUsers(r.data.data || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    reset({ month: now.getMonth() + 1, year: now.getFullYear(), salesTarget: 0, collectionTarget: 0, visitTarget: 0 });
    setModal({ open: true, data: null });
  };
  const openEdit = (t) => { reset({ ...t, user: t.user?._id || t.user }); setModal({ open: true, data: t }); };

  const onSubmit = async (data) => {
    try {
      if (modal.data) await targetService.update(modal.data._id, data);
      else await targetService.create(data);
      toast.success(modal.data ? 'Updated' : 'Target set');
      setModal({ open: false, data: null });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await targetService.delete(confirm.id); toast.success('Deleted'); setConfirm({ open: false, id: null }); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Targets</h1>
          <p className="text-sm text-slate-500 mt-1">{total} total targets</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><FiPlus />Set Target</button>
      </div>

      <div className="card p-0">
        {loading ? <PageLoader /> : targets.length === 0 ? (
          <EmptyState icon={FiTarget} title="No targets set" description="Set monthly targets for your team"
            action={<button className="btn-primary" onClick={openCreate}><FiPlus />Set Target</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Member</th><th>Role</th><th>Month/Year</th><th>Sales Target</th><th>Collection Target</th><th>Visit Target</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {targets.map(t => (
                    <tr key={t._id}>
                      <td className="font-medium">{t.user?.name || '—'}</td>
                      <td><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{t.role?.toUpperCase() || '—'}</span></td>
                      <td className="text-slate-500 text-sm">{MONTHS[(t.month || 1) - 1]} {t.year}</td>
                      <td className="font-bold text-green-600">{fmt(t.salesTarget)}</td>
                      <td className="font-bold text-blue-600">{fmt(t.collectionTarget)}</td>
                      <td className="font-bold text-orange-600">{t.visitTarget || 0}</td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600"><FiEdit2 /></button>
                          <button onClick={() => setConfirm({ open: true, id: t._id })} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4"><Pagination page={page} pages={pages} onPage={setPage} /></div>
          </>
        )}
      </div>

      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })}
        title={modal.data ? 'Edit Target' : 'Set Target'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Team Member *</label>
            <select {...register('user', { required: 'Required' })} className="input">
              <option value="">Select member...</option>
              {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role?.toUpperCase()})</option>)}
            </select>
            {errors.user && <p className="text-danger text-xs mt-1">{errors.user.message}</p>}
          </div>
          <div>
            <label className="label">Month *</label>
            <select {...register('month', { required: true, valueAsNumber: true })} className="input">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year *</label>
            <input {...register('year', { required: true, valueAsNumber: true })} type="number" className="input" defaultValue={now.getFullYear()} />
          </div>
          <div>
            <label className="label">Sales Target (NPR)</label>
            <input {...register('salesTarget', { valueAsNumber: true })} type="number" className="input" defaultValue={0} />
          </div>
          <div>
            <label className="label">Collection Target (NPR)</label>
            <input {...register('collectionTarget', { valueAsNumber: true })} type="number" className="input" defaultValue={0} />
          </div>
          <div>
            <label className="label">Visit Target</label>
            <input {...register('visitTarget', { valueAsNumber: true })} type="number" className="input" defaultValue={0} />
          </div>
          <div>
            <label className="label">Dealer Target</label>
            <input {...register('dealerTarget', { valueAsNumber: true })} type="number" className="input" defaultValue={0} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : modal.data ? 'Update' : 'Set Target'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={confirm.open} title="Delete Target" message="This action cannot be undone."
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
    </div>
  );
}
