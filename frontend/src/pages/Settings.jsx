import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { userService } from '../services';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PageLoader } from '../components/common/Spinner';
import {
  FiPlus, FiEdit2, FiTrash2, FiKey, FiToggleLeft, FiToggleRight,
  FiUser, FiMail, FiPhone, FiEye, FiEyeOff, FiArrowLeft, FiMapPin, FiUsers
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const PROVINCES = [
  'Koshi Province', 'Madhesh Province', 'Bagmati Province', 'Gandaki Province',
  'Lumbini Province', 'Karnali Province', 'Sudurpashchim Province',
];
const DESIGNATIONS = ['Marketing Staff', 'Sales Executive', 'Supervisor'];
const PROVINCE_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/20',     border: 'border-blue-200 dark:border-blue-700',   icon: 'bg-blue-500',   text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-700', icon: 'bg-green-500',  text: 'text-green-700 dark:text-green-300' },
  { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-700', icon: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700', icon: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-pink-50 dark:bg-pink-900/20',     border: 'border-pink-200 dark:border-pink-700',   icon: 'bg-pink-500',   text: 'text-pink-700 dark:text-pink-300' },
  { bg: 'bg-teal-50 dark:bg-teal-900/20',     border: 'border-teal-200 dark:border-teal-700',   icon: 'bg-teal-500',   text: 'text-teal-700 dark:text-teal-300' },
  { bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-700',     icon: 'bg-red-500',    text: 'text-red-700 dark:text-red-300' },
];

// ── Shared staff table row actions ──────────────────────────────────────────
function StaffTable({ staff, color, onEdit, onResetPass, onToggle, onDelete }) {
  if (staff.length === 0) return null;
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Designation</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {staff.map((u, i) => (
            <tr key={u._id}>
              <td className="text-slate-400 text-xs">{i + 1}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 ${color?.icon || 'bg-slate-400'} rounded-lg flex items-center justify-center text-xs font-bold text-white`}>
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="font-medium text-slate-900 dark:text-white">{u.name}</span>
                </div>
              </td>
              <td className="text-slate-600 dark:text-slate-400">{u.email}</td>
              <td className="text-slate-600 dark:text-slate-400">{u.phone || '—'}</td>
              <td><span className="badge-info">{u.designation || 'Marketing Staff'}</span></td>
              <td>
                <button onClick={() => onToggle(u)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                    u.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200'
                  }`}>
                  {u.isActive ? <FiToggleRight className="text-base" /> : <FiToggleLeft className="text-base" />}
                  {u.isActive ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td>
                <div className="flex gap-1">
                  <button onClick={() => onEdit(u)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600 transition-colors"><FiEdit2 className="text-sm" /></button>
                  <button onClick={() => onResetPass(u)} className="p-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg text-warning transition-colors"><FiKey className="text-sm" /></button>
                  <button onClick={() => onDelete(u._id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-danger transition-colors"><FiTrash2 className="text-sm" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Create Staff Modal — own useForm ─────────────────────────────────────────
function CreateStaffModal({ open, onClose, defaultProvince, onSuccess }) {
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (open) reset({ province: defaultProvince || '', designation: 'Marketing Staff' });
  }, [open, defaultProvince, reset]);

  const onSubmit = async (data) => {
    try {
      await userService.createStaff(data);
      toast.success(`Staff created! Email: ${data.email}  Password: ${data.password}`);
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create staff');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Staff Account">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-xs text-blue-700 dark:text-blue-300">
          ℹ️ Staff will use this email and password to login. Share credentials securely.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <input {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })}
                type={showPass ? 'text' : 'password'} className="input pr-10" placeholder="Min 8 characters" />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="label">Assign Province</label>
            <select {...register('province')} className="input">
              <option value="">— No Province —</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Designation</label>
            <select {...register('designation')} className="input">
              {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Staff Account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit Staff Modal — own useForm ───────────────────────────────────────────
function EditStaffModal({ open, onClose, staff, onSuccess }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (open && staff) reset({ name: staff.name, email: staff.email, phone: staff.phone || '', province: staff.province || '', designation: staff.designation || 'Marketing Staff' });
  }, [open, staff, reset]);

  const onSubmit = async (data) => {
    try {
      await userService.update(staff._id, data);
      toast.success('Staff updated');
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Staff Account">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name</label>
            <input {...register('name', { required: 'Required' })} className="input" />
            {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Email Address</label>
            <input {...register('email', { required: 'Required' })} type="email" className="input" />
            {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input {...register('phone')} className="input" placeholder="98XXXXXXXX" />
          </div>
          <div>
            <label className="label">Assign Province</label>
            <select {...register('province')} className="input">
              <option value="">— No Province —</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Designation</label>
            <select {...register('designation')} className="input">
              {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Reset Password Modal — own useForm ───────────────────────────────────────
function ResetPasswordModal({ open, onClose, staff, onSuccess }) {
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => { if (open) reset({}); }, [open, reset]);

  const onSubmit = async (data) => {
    try {
      await userService.resetPassword(staff._id, { newPassword: data.newPassword });
      toast.success('Password reset successfully');
      onClose();
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Reset Password — ${staff?.name}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-xs text-yellow-700 dark:text-yellow-300">
          ⚠️ This will immediately change the staff member's password.
        </div>
        <div>
          <label className="label">New Password</label>
          <div className="relative">
            <input {...register('newPassword', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })}
              type={showPass ? 'text' : 'password'} className="input pr-10" placeholder="Min 8 characters" />
            <button type="button" onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPass ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          {errors.newPassword && <p className="text-danger text-xs mt-1">{errors.newPassword.message}</p>}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main Settings Page ───────────────────────────────────────────────────────
export default function Settings() {
  const [users, setUsers]                       = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [createModal, setCreateModal]           = useState({ open: false, province: '' });
  const [editModal, setEditModal]               = useState({ open: false, staff: null });
  const [resetModal, setResetModal]             = useState({ open: false, staff: null });
  const [confirm, setConfirm]                   = useState({ open: false, id: null });
  const [deleting, setDeleting]                 = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userService.getAll();
      setUsers(res.data.data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const staffUsers = users.filter(u => u.role === 'staff');
  const adminUsers = users.filter(u => u.role === 'admin');
  const unassigned = staffUsers.filter(u => !u.province);

  const provinceCounts = PROVINCES.reduce((acc, p) => {
    acc[p] = staffUsers.filter(u => u.province === p).length;
    return acc;
  }, {});

  const provinceStaff = selectedProvince
    ? staffUsers.filter(u => u.province === selectedProvince)
    : [];

  const handleToggle = async (u) => {
    try {
      const res = await userService.toggleStatus(u._id);
      toast.success(res.data.message);
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await userService.delete(confirm.id);
      toast.success('Staff deleted');
      setConfirm({ open: false, id: null });
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
    finally { setDeleting(false); }
  };

  if (loading) return <PageLoader />;

  // ── Province drill-down ──
  if (selectedProvince) {
    const color = PROVINCE_COLORS[PROVINCES.indexOf(selectedProvince)];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedProvince(null)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <FiArrowLeft className="text-slate-600 dark:text-slate-300 text-xl" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedProvince}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{provinceStaff.length} staff account{provinceStaff.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button className="btn-primary" onClick={() => setCreateModal({ open: true, province: selectedProvince })}>
            <FiPlus /> Add Staff
          </button>
        </div>

        <div className="card p-0">
          {provinceStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl mb-4">
                <FiUser className="text-3xl text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">No staff in {selectedProvince}</h3>
              <p className="text-sm text-slate-500 mb-4">Add staff to manage salespersons in this province</p>
              <button className="btn-primary" onClick={() => setCreateModal({ open: true, province: selectedProvince })}>
                <FiPlus /> Add Staff
              </button>
            </div>
          ) : (
            <StaffTable staff={provinceStaff} color={color}
              onEdit={(u) => setEditModal({ open: true, staff: u })}
              onResetPass={(u) => setResetModal({ open: true, staff: u })}
              onToggle={handleToggle}
              onDelete={(id) => setConfirm({ open: true, id })} />
          )}
        </div>

        <CreateStaffModal open={createModal.open} onClose={() => setCreateModal({ open: false, province: '' })}
          defaultProvince={createModal.province} onSuccess={fetchUsers} />
        <EditStaffModal open={editModal.open} onClose={() => setEditModal({ open: false, staff: null })}
          staff={editModal.staff} onSuccess={fetchUsers} />
        <ResetPasswordModal open={resetModal.open} onClose={() => setResetModal({ open: false, staff: null })}
          staff={resetModal.staff} onSuccess={fetchUsers} />
        <ConfirmDialog open={confirm.open} title="Delete Staff Account"
          message="This will permanently delete the staff account."
          onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
      </div>
    );
  }

  // ── Province grid ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Staff Management</h1>
          <p className="text-sm text-slate-500 mt-1">{staffUsers.length} staff · Province-wise assignment</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateModal({ open: true, province: '' })}>
          <FiPlus /> Add Staff
        </button>
      </div>

      {/* Admin Card */}
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

      {/* Province Cards */}
      <div>
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Staff by Province</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {PROVINCES.map((province, idx) => {
            const color = PROVINCE_COLORS[idx];
            const count = provinceCounts[province] || 0;
            const active = staffUsers.filter(u => u.province === province && u.isActive).length;
            return (
              <button key={province} onClick={() => setSelectedProvince(province)}
                className={`${color.bg} ${color.border} border-2 rounded-2xl p-5 text-left hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${color.icon} rounded-xl flex items-center justify-center shadow-sm`}>
                    <FiMapPin className="text-white text-xl" />
                  </div>
                  <span className={`text-3xl font-bold ${color.text}`}>{count}</span>
                </div>
                <p className={`font-semibold text-base ${color.text} leading-tight`}>{province}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{active} active · {count - active} inactive</p>
                <p className={`text-xs mt-3 font-medium ${color.text} opacity-0 group-hover:opacity-100 transition-opacity`}>Click to manage staff →</p>
              </button>
            );
          })}
          <div className="bg-slate-800 dark:bg-slate-700 rounded-2xl p-5 border-2 border-slate-700 dark:border-slate-600">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-slate-600 rounded-xl flex items-center justify-center shadow-sm">
                <FiUsers className="text-white text-xl" />
              </div>
              <span className="text-3xl font-bold text-white">{staffUsers.length}</span>
            </div>
            <p className="font-semibold text-base text-white">All Provinces</p>
            <p className="text-slate-400 text-xs mt-1">{staffUsers.filter(u => u.isActive).length} active total</p>
          </div>
        </div>
      </div>

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div className="card p-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-white">Unassigned Staff</h2>
            <p className="text-xs text-slate-500 mt-0.5">No province assigned yet</p>
          </div>
          <StaffTable staff={unassigned} color={null}
            onEdit={(u) => setEditModal({ open: true, staff: u })}
            onResetPass={(u) => setResetModal({ open: true, staff: u })}
            onToggle={handleToggle}
            onDelete={(id) => setConfirm({ open: true, id })} />
        </div>
      )}

      <CreateStaffModal open={createModal.open} onClose={() => setCreateModal({ open: false, province: '' })}
        defaultProvince={createModal.province} onSuccess={fetchUsers} />
      <EditStaffModal open={editModal.open} onClose={() => setEditModal({ open: false, staff: null })}
        staff={editModal.staff} onSuccess={fetchUsers} />
      <ResetPasswordModal open={resetModal.open} onClose={() => setResetModal({ open: false, staff: null })}
        staff={resetModal.staff} onSuccess={fetchUsers} />
      <ConfirmDialog open={confirm.open} title="Delete Staff Account"
        message="This will permanently delete the staff account."
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
    </div>
  );
}
