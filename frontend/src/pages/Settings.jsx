import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { userService } from '../services';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PageLoader } from '../components/common/Spinner';
import { FiPlus, FiEdit2, FiTrash2, FiKey, FiToggleLeft, FiToggleRight, FiUser, FiMail, FiPhone, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, type: null, data: null });
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userService.getAll();
      setUsers(res.data.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    reset({});
    setShowPass(false);
    setModal({ open: true, type: 'create', data: null });
  };

  const openEdit = (u) => {
    reset({ name: u.name, email: u.email, phone: u.phone || '' });
    setModal({ open: true, type: 'edit', data: u });
  };

  const openResetPass = (u) => {
    reset({});
    setShowNewPass(false);
    setModal({ open: true, type: 'reset', data: u });
  };

  const onCreateStaff = async (data) => {
    try {
      await userService.createStaff(data);
      toast.success(`Staff account created! Email: ${data.email} | Pass: ${data.password}`);
      setModal({ open: false, type: null, data: null });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create staff');
    }
  };

  const onEditStaff = async (data) => {
    try {
      await userService.update(modal.data._id, data);
      toast.success('Staff updated successfully');
      setModal({ open: false, type: null, data: null });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const onResetPassword = async (data) => {
    try {
      await userService.resetPassword(modal.data._id, { newPassword: data.newPassword });
      toast.success('Password reset successfully');
      setModal({ open: false, type: null, data: null });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleToggleStatus = async (u) => {
    try {
      const res = await userService.toggleStatus(u._id);
      toast.success(res.data.message);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await userService.delete(confirm.id);
      toast.success('Staff deleted');
      setConfirm({ open: false, id: null });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const staffUsers = users.filter(u => u.role === 'staff');
  const adminUsers = users.filter(u => u.role === 'admin');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {staffUsers.length} staff account{staffUsers.length !== 1 ? 's' : ''} created
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <FiPlus /> Create Staff Account
        </button>
      </div>

      {/* Admin Account Card */}
      <div className="card border-l-4 border-primary-600">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Admin Account</p>
        <div className="flex flex-wrap gap-4">
          {adminUsers.map(u => (
            <div key={u._id} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold">
                {u.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              <span className="badge-info ml-2">Admin</span>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Accounts Table */}
      <div className="card p-0">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Staff Accounts</h2>
          <p className="text-xs text-slate-500 mt-0.5">Staff can create orders, lifting plans, collections and view dashboard</p>
        </div>

        {loading ? <PageLoader /> : staffUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl mb-4">
              <FiUser className="text-3xl text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">No staff accounts yet</h3>
            <p className="text-sm text-slate-500 mb-4">Create staff accounts so they can login and manage records</p>
            <button className="btn-primary" onClick={openCreate}><FiPlus />Create First Staff</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffUsers.map((u, i) => (
                  <tr key={u._id}>
                    <td className="text-slate-400 text-xs">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-600 rounded-lg flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">{u.name}</span>
                      </div>
                    </td>
                    <td className="text-slate-600 dark:text-slate-400">{u.email}</td>
                    <td className="text-slate-600 dark:text-slate-400">{u.phone || '—'}</td>
                    <td>
                      <button onClick={() => handleToggleStatus(u)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                          u.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200'
                        }`}>
                        {u.isActive ? <FiToggleRight className="text-base" /> : <FiToggleLeft className="text-base" />}
                        {u.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="text-xs text-slate-400">
                      {new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(u)} title="Edit"
                          className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600 transition-colors">
                          <FiEdit2 className="text-sm" />
                        </button>
                        <button onClick={() => openResetPass(u)} title="Reset Password"
                          className="p-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg text-warning transition-colors">
                          <FiKey className="text-sm" />
                        </button>
                        <button onClick={() => setConfirm({ open: true, id: u._id })} title="Delete"
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-danger transition-colors">
                          <FiTrash2 className="text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      <Modal open={modal.open && modal.type === 'create'} onClose={() => setModal({ open: false, type: null, data: null })} title="Create Staff Account">
        <form onSubmit={handleSubmit(onCreateStaff)} className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-xs text-blue-700 dark:text-blue-300">
            ℹ️ Staff will use this email and password to login. Share credentials securely.
          </div>
          <div>
            <label className="label">Full Name</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input {...register('name', { required: 'Name is required' })} className="input pl-9" placeholder="John Doe" />
            </div>
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Email Address</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                type="email" className="input pl-9" placeholder="staff@company.com" />
            </div>
            {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <div className="relative">
              <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input {...register('phone')} className="input pl-9" placeholder="98XXXXXXXX" />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
                type={showPass ? 'text' : 'password'} className="input pr-10" placeholder="Min 6 characters" />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal({ open: false, type: null, data: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Staff Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal open={modal.open && modal.type === 'edit'} onClose={() => setModal({ open: false, type: null, data: null })} title="Edit Staff Account">
        <form onSubmit={handleSubmit(onEditStaff)} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input {...register('name', { required: 'Name is required' })} className="input" />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Email Address</label>
            <input {...register('email', { required: 'Email is required' })} type="email" className="input" />
            {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input {...register('phone')} className="input" placeholder="98XXXXXXXX" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal({ open: false, type: null, data: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={modal.open && modal.type === 'reset'} onClose={() => setModal({ open: false, type: null, data: null })} title={`Reset Password — ${modal.data?.name}`}>
        <form onSubmit={handleSubmit(onResetPassword)} className="space-y-4">
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-xs text-yellow-700 dark:text-yellow-300">
            ⚠️ This will immediately change the staff member's password. Share the new password with them securely.
          </div>
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input {...register('newPassword', { required: 'Required', minLength: { value: 6, message: 'Min 6 characters' } })}
                type={showNewPass ? 'text' : 'password'} className="input pr-10" placeholder="Enter new password" />
              <button type="button" onClick={() => setShowNewPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNewPass ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {errors.newPassword && <p className="text-danger text-xs mt-1">{errors.newPassword.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal({ open: false, type: null, data: null })}>Cancel</button>
            <button type="submit" className="btn-warning bg-warning text-white hover:bg-yellow-600 btn" disabled={isSubmitting}>
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog open={confirm.open} title="Delete Staff Account"
        message="This will permanently delete the staff account. All their records will remain but they won't be able to login."
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
    </div>
  );
}
