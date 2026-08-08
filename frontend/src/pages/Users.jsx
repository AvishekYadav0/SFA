import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { userService } from '../services';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Pagination } from '../components/common/Pagination';
import { SearchInput } from '../components/common/SearchInput';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiPhone, FiMail } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ROLES = ['nsm', 'rsm', 'asm', 'se', 'so', 'dealer'];
const PROVINCES = ['Koshi','Madhesh','Bagmati','Gandaki','Lumbini','Karnali','Sudurpashchim'];

const ROLE_COLORS = {
  nsm:    'bg-purple-100 text-purple-700',
  rsm:    'bg-blue-100 text-blue-700',
  asm:    'bg-green-100 text-green-700',
  se:     'bg-orange-100 text-orange-700',
  so:     'bg-yellow-100 text-yellow-700',
  dealer: 'bg-pink-100 text-pink-700',
  admin:  'bg-red-100 text-red-700',
};

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState({ open: false, data: null });
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [managers, setManagers] = useState([]);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm();
  const selectedRole = watch('role');

  const load = () => {
    setLoading(true);
    userService.getAll({ page, search, role: roleFilter, limit: 15 })
      .then(r => { setUsers(r.data.data); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, search, roleFilter]);

  useEffect(() => {
    if (modal.open && selectedRole) {
      const parentRole = selectedRole === 'so' ? 'se' : selectedRole === 'se' ? 'asm' : selectedRole === 'asm' ? 'rsm' : selectedRole === 'rsm' ? 'nsm' : null;
      if (parentRole) {
        userService.getAll({ role: parentRole, limit: 200 })
          .then(r => setManagers(r.data.data || []))
          .catch(() => {});
      } else setManagers([]);
    }
  }, [selectedRole, modal.open]);

  const openCreate = () => { reset({ status: 'active' }); setModal({ open: true, data: null }); };
  const openEdit   = (u) => { reset(u); setModal({ open: true, data: u }); };

  const onSubmit = async (data) => {
    try {
      if (modal.data) await userService.update(modal.data._id, data);
      else await userService.create(data);
      toast.success(modal.data ? 'Updated' : 'Created');
      setModal({ open: false, data: null });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await userService.delete(confirm.id); toast.success('Deleted'); setConfirm({ open: false, id: null }); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setDeleting(false); }
  };

  const parentLabel = selectedRole === 'so' ? 'SE' : selectedRole === 'se' ? 'ASM' : selectedRole === 'asm' ? 'RSM' : selectedRole === 'rsm' ? 'NSM' : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Team Management</h1>
          <p className="text-sm text-slate-500 mt-1">{total} total members</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search..." />
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} className="input w-32 text-sm">
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
          </select>
          <button className="btn-primary" onClick={openCreate}><FiPlus />Add Member</button>
        </div>
      </div>

      <div className="card p-0">
        {loading ? <PageLoader /> : users.length === 0 ? (
          <EmptyState icon={FiUsers} title="No team members" description="Add your first team member"
            action={<button className="btn-primary" onClick={openCreate}><FiPlus />Add Member</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th><th>Role</th><th>Employee ID</th><th>Phone</th>
                    <th>Province</th><th>Reports To</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${ROLE_COLORS[u.role]?.replace('text-', 'bg-').split(' ')[0] || 'bg-slate-400'}`}>
                            {u.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>{u.role?.toUpperCase()}</span></td>
                      <td className="text-slate-500 text-sm">{u.employeeId || '—'}</td>
                      <td className="text-slate-500 text-sm">{u.phone || '—'}</td>
                      <td className="text-slate-500 text-sm">{u.province || '—'}</td>
                      <td className="text-slate-500 text-sm">{u.reportsTo?.name || '—'}</td>
                      <td><StatusBadge status={u.status} /></td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600"><FiEdit2 /></button>
                          <button onClick={() => setConfirm({ open: true, id: u._id })} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"><FiTrash2 /></button>
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
        title={modal.data ? 'Edit Member' : 'Add Team Member'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name *</label>
            <input {...register('name', { required: 'Required' })} className="input" placeholder="Full name" />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Email *</label>
            <input {...register('email', { required: 'Required' })} type="email" className="input" placeholder="email@example.com" />
            {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
          </div>
          {!modal.data && (
            <div>
              <label className="label">Password *</label>
              <input {...register('password', { required: 'Required', minLength: { value: 6, message: 'Min 6 chars' } })} type="password" className="input" placeholder="Password" />
              {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
            </div>
          )}
          <div>
            <label className="label">Role *</label>
            <select {...register('role', { required: 'Required' })} className="input">
              <option value="">Select role...</option>
              {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </select>
            {errors.role && <p className="text-danger text-xs mt-1">{errors.role.message}</p>}
          </div>
          {parentLabel && managers.length > 0 && (
            <div>
              <label className="label">Reports To ({parentLabel})</label>
              <select {...register('reportsTo')} className="input">
                <option value="">Select {parentLabel}...</option>
                {managers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Employee ID</label>
            <input {...register('employeeId')} className="input" placeholder="EMP-001" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input {...register('phone')} className="input" placeholder="98XXXXXXXX" />
          </div>
          <div>
            <label className="label">Province</label>
            <select {...register('province')} className="input">
              <option value="">Select...</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">District</label>
            <input {...register('district')} className="input" placeholder="District" />
          </div>
          <div>
            <label className="label">Area</label>
            <input {...register('area')} className="input" placeholder="Area" />
          </div>
          <div>
            <label className="label">Region</label>
            <input {...register('region')} className="input" placeholder="Region" />
          </div>
          <div>
            <label className="label">Target (NPR)</label>
            <input {...register('target', { valueAsNumber: true })} type="number" className="input" defaultValue={0} />
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : modal.data ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={confirm.open} title="Delete Member" message="This action cannot be undone."
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
    </div>
  );
}
