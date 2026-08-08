import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { userService, dealerService } from '../services';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PageLoader } from '../components/common/Spinner';
import { StatusBadge } from '../components/common/index.jsx';
import {
  FiPlus, FiEdit2, FiTrash2, FiKey, FiToggleLeft, FiToggleRight,
  FiUser, FiMail, FiPhone, FiEye, FiEyeOff, FiMapPin, FiUsers, FiBriefcase,
  FiChevronDown, FiChevronRight, FiGrid, FiShare2, FiSearch, FiX, FiCheck,
  FiUserCheck, FiLink, FiTarget, FiSlash, FiDollarSign,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

/* ────────────────────────────────────────────────────────────────────────
   Constants — hierarchy, provinces, role metadata
   ──────────────────────────────────────────────────────────────────────── */

const PROVINCES = [
  'Koshi Province', 'Madhesh Province', 'Bagmati Province', 'Gandaki Province',
  'Lumbini Province', 'Karnali Province', 'Sudurpashchim Province',
];

// Role → display label
const ROLE_OPTIONS = [
  { value: 'nsm',    label: 'National Sales Manager (NSM)' },
  { value: 'rsm',    label: 'Regional Sales Manager (RSM)' },
  { value: 'asm',    label: 'Area Sales Manager (ASM)' },
  { value: 'se',     label: 'Sales Executive (SE)' },
  { value: 'so',     label: 'Sales Officer (SO)' },
  { value: 'dealer', label: 'Dealer / Distributor' },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]));

// Hierarchy: who each role reports to, and depth (used for tree ordering + validation)
const PARENT_ROLE = { rsm: 'nsm', asm: 'rsm', se: 'asm', so: 'se', dealer: 'so' };
const ROLE_LEVEL   = { nsm: 1, rsm: 2, asm: 3, se: 4, so: 5, dealer: 6 };
const CHILD_ROLE   = { nsm: 'rsm', rsm: 'asm', asm: 'se', se: 'so', so: 'dealer' };

const ROLE_COLOR = {
  nsm:    { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500', border: 'border-purple-200 dark:border-purple-700' },
  rsm:    { bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-500',   border: 'border-blue-200 dark:border-blue-700' },
  asm:    { bg: 'bg-teal-100 dark:bg-teal-900/30',     text: 'text-teal-700 dark:text-teal-300',     dot: 'bg-teal-500',   border: 'border-teal-200 dark:border-teal-700' },
  se:     { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500',  border: 'border-orange-200 dark:border-orange-700' },
  so:     { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500', border: 'border-yellow-200 dark:border-yellow-700' },
  dealer: { bg: 'bg-pink-100 dark:bg-pink-900/30',     text: 'text-pink-700 dark:text-pink-300',     dot: 'bg-pink-500',   border: 'border-pink-200 dark:border-pink-700' },
  admin:  { bg: 'bg-slate-800',                        text: 'text-white',                           dot: 'bg-slate-400',  border: 'border-slate-700' },
};

const PROVINCE_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-green-50 dark:bg-green-900/20',   text: 'text-green-700 dark:text-green-300' },
  { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-pink-50 dark:bg-pink-900/20',     text: 'text-pink-700 dark:text-pink-300' },
  { bg: 'bg-teal-50 dark:bg-teal-900/20',     text: 'text-teal-700 dark:text-teal-300' },
  { bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-700 dark:text-red-300' },
];
const provinceColor = (p) => PROVINCE_COLORS[PROVINCES.indexOf(p) % PROVINCE_COLORS.length] || PROVINCE_COLORS[0];

const toggleValue = (arr = [], val) => (arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);

/* ────────────────────────────────────────────────────────────────────────
   Small shared bits
   ──────────────────────────────────────────────────────────────────────── */

function Avatar({ name, role, size = 'w-10 h-10 text-sm' }) {
  const color = ROLE_COLOR[role] || ROLE_COLOR.se;
  return (
    <div className={`${size} ${color.dot} rounded-xl flex items-center justify-center font-bold text-white shrink-0`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function RoleBadge({ role }) {
  const color = ROLE_COLOR[role] || ROLE_COLOR.se;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
      {role === 'admin' ? 'Admin' : role.toUpperCase()}
    </span>
  );
}

function ProvinceChips({ provinces = [], max = 3 }) {
  if (!provinces.length) return <span className="text-xs text-slate-400 italic">No province</span>;
  const shown = provinces.slice(0, max);
  const rest = provinces.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(p => {
        const c = provinceColor(p);
        return (
          <span key={p} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
            {p.replace(' Province', '')}
          </span>
        );
      })}
      {rest > 0 && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">+{rest}</span>}
    </div>
  );
}

function StatCard({ icon, label, value, tint, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`card flex items-center gap-3 py-4 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150' : ''}`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg text-white ${tint}`}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Multi-province select — checkbox popover with chip summary
   ──────────────────────────────────────────────────────────────────────── */

function MultiProvinceField({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="input flex items-center justify-between text-left w-full">
        <span className="truncate">
          {value.length ? `${value.length} province${value.length > 1 ? 's' : ''} selected` : 'Select provinces'}
        </span>
        <FiChevronDown className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2"><ProvinceChips provinces={value} max={6} /></div>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 max-h-64 overflow-y-auto">
            {PROVINCES.map(p => {
              const checked = value.includes(p);
              return (
                <label key={p} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm">
                  <input type="checkbox" checked={checked} onChange={() => onChange(toggleValue(value, p))}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                  <span className="text-slate-700 dark:text-slate-200">{p}</span>
                  {checked && <FiCheck className="ml-auto text-primary-600 text-xs" />}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Reports-To select — shows ALL roles above the selected role, grouped
   ──────────────────────────────────────────────────────────────────────── */

// All roles that can be a parent, in hierarchy order
const SUPERIOR_ROLES = ['nsm', 'rsm', 'asm', 'se', 'so'];

// Which roles are valid parents for each role
const VALID_PARENTS = {
  rsm:    ['nsm'],
  asm:    ['nsm', 'rsm'],
  se:     ['nsm', 'rsm', 'asm'],
  so:     ['nsm', 'rsm', 'asm', 'se'],
  dealer: ['so', 'se', 'asm', 'rsm', 'nsm'],
};

function ReportsToField({ register, role, allUsers, excludeId, error }) {
  const validParentRoles = VALID_PARENTS[role];

  if (!validParentRoles) {
    return (
      <div>
        <label className="label">Reports To</label>
        <div className="input flex items-center gap-2 text-slate-400 bg-slate-50 dark:bg-slate-800 cursor-not-allowed">
          <FiSlash className="text-xs" /> Top of hierarchy — no parent
        </div>
      </div>
    );
  }

  // Group candidates by role, in hierarchy order
  const grouped = SUPERIOR_ROLES
    .filter(r => validParentRoles.includes(r))
    .map(r => ({
      role: r,
      label: ROLE_LABEL[r],
      users: allUsers.filter(u => u.role === r && u._id !== excludeId),
    }))
    .filter(g => g.users.length > 0);

  const totalCount = grouped.reduce((s, g) => s + g.users.length, 0);

  return (
    <div>
      <label className="label">Reports To</label>
      <select
        {...register('reportsTo', { required: 'Please select who this staff reports to' })}
        className="input"
      >
        <option value="">— Select manager —</option>
        {grouped.map(g => (
          <optgroup key={g.role} label={`── ${g.label} ──`}>
            {g.users.map(u => (
              <option key={u._id} value={u._id}>
                {u.name}{u.area ? ` · ${u.area}` : ''}{u.region ? ` · ${u.region}` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {totalCount === 0 && (
        <p className="text-xs text-amber-600 mt-1">
          No managers found yet — create an NSM, RSM, ASM, or SE first.
        </p>
      )}
      {error && <p className="text-danger text-xs mt-1">{error.message}</p>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Create Staff Modal
   ──────────────────────────────────────────────────────────────────────── */

function CreateStaffModal({ open, onClose, allUsers, allDealers, defaultProvince, defaultReportsTo, defaultRole, onSuccess }) {
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors, isSubmitting } } = useForm();
  const role = watch('role');
  const provinces = watch('provinces') || [];

  useEffect(() => {
    if (open) reset({
      role: defaultRole || 'se',
      status: 'active',
      provinces: defaultProvince ? [defaultProvince] : [],
      reportsTo: defaultReportsTo || '',
      linkedDealerId: '',
    });
  }, [open, defaultProvince, defaultReportsTo, defaultRole, reset]);

  // Auto-fill fields when a dealer is selected
  const linkedDealerId = watch('linkedDealerId');
  useEffect(() => {
    if (role !== 'dealer' || !linkedDealerId) return;
    const dealer = allDealers.find(d => d._id === linkedDealerId);
    if (!dealer) return;
    setValue('name', dealer.ownerName || '');
    setValue('phone', dealer.phone || '');
    setValue('district', dealer.district || '');
    setValue('address', dealer.address || '');
  }, [linkedDealerId, role, allDealers, setValue]);

  const onSubmit = async (data) => {
    try {
      const { linkedDealerId, ...rest } = data;
      const payload = { ...rest, reportsTo: PARENT_ROLE[data.role] ? data.reportsTo : null };
      const res = await userService.createStaff(payload);
      // If a dealer was selected, auto-link the new user to that dealer
      if (linkedDealerId && data.role === 'dealer') {
        await dealerService.linkUser(linkedDealerId, res.data.data._id);
      }
      const creds = `Email: ${data.email}\nPassword: ${data.password}`;
      navigator.clipboard?.writeText(creds).catch(() => {});
      toast.success(`Staff created! Credentials copied to clipboard.`, { duration: 5000 });
      onClose();
      onSuccess();
    } catch (err) {
      console.error('createStaff failed:', err);
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
              <input {...register('name', { required: 'Name is required' })} className="input pl-9" placeholder="Enter full name" />
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
            <label className="label">Phone</label>
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

          <div className="sm:col-span-2">
            <label className="label">Role</label>
            <select {...register('role')} className="input">
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {role === 'dealer' && (
            <div className="sm:col-span-2">
              <label className="label">Link to Dealer Account</label>
              <select {...register('linkedDealerId')} className="input">
                <option value="">— Select dealer to auto-fill —</option>
                {allDealers.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.dealerName} · {d.ownerName}{d.district ? ` · ${d.district}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Selecting a dealer auto-fills name, phone & district below.</p>
            </div>
          )}

          <div>
            <label className="label">Employee ID (optional)</label>
            <input {...register('employeeId')} className="input" placeholder="Auto-generated if blank" />
          </div>
          <div>
            <label className="label">Designation</label>
            <input {...register('designation')} className="input" placeholder="e.g. Senior SE" />
          </div>
          <div>
            <label className="label">Monthly Target (Rs)</label>
            <div className="relative">
              <FiDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input {...register('monthlyTarget', { valueAsNumber: true })} type="number" className="input pl-9" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="label">District</label>
            <input {...register('district')} className="input" placeholder="e.g. Kathmandu" />
          </div>
          <div>
            <label className="label">Address</label>
            <input {...register('address')} className="input" placeholder="e.g. New Road, Kathmandu" />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Provinces</label>
            <Controller name="provinces" control={control} defaultValue={[]}
              render={({ field }) => <MultiProvinceField value={field.value} onChange={field.onChange} />} />
          </div>

          <div className="sm:col-span-2">
            <ReportsToField register={register} role={role} allUsers={allUsers} error={errors.reportsTo} />
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

/* ────────────────────────────────────────────────────────────────────────
   Edit Staff Modal
   ──────────────────────────────────────────────────────────────────────── */

function EditStaffModal({ open, onClose, staff, allUsers, onSuccess }) {
  const { register, handleSubmit, reset, control, watch, formState: { errors, isSubmitting } } = useForm();
  const role = watch('role');
  const provinces = watch('provinces') || [];

  useEffect(() => {
    if (open && staff) reset({
      name: staff.name, email: staff.email, phone: staff.phone || '',
      provinces: staff.provinces || (staff.province ? [staff.province] : []),
      area: staff.area || '', role: staff.role || 'se',
      status: staff.status || 'active',
      reportsTo: staff.reportsTo?._id || staff.reportsTo || '',
      employeeId: staff.employeeId || '',
      designation: staff.designation || '',
      monthlyTarget: staff.monthlyTarget || '',
      district: staff.district || '',
      address: staff.address || '',
    });
  }, [open, staff, reset]);

  const onSubmit = async (data) => {
    try {
      const payload = { ...data, reportsTo: PARENT_ROLE[data.role] ? data.reportsTo : null };
      await userService.update(staff._id, payload);
      toast.success('Staff updated');
      onClose();
      onSuccess();
    } catch (err) {
      console.error('update staff failed:', err);
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
            <label className="label">Role</label>
            <select {...register('role')} className="input">
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Employee ID</label>
            <input {...register('employeeId')} className="input" />
          </div>
          <div>
            <label className="label">Designation</label>
            <input {...register('designation')} className="input" />
          </div>
          <div>
            <label className="label">Monthly Target (Rs)</label>
            <div className="relative">
              <FiDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input {...register('monthlyTarget', { valueAsNumber: true })} type="number" className="input pl-9" />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="label">District</label>
            <input {...register('district')} className="input" />
          </div>
          <div>
            <label className="label">Address</label>
            <input {...register('address')} className="input" />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Provinces</label>
            <Controller name="provinces" control={control} defaultValue={[]}
              render={({ field }) => <MultiProvinceField value={field.value} onChange={field.onChange} />} />
          </div>

          <div className="sm:col-span-2">
            <ReportsToField register={register} role={role} allUsers={allUsers} excludeId={staff?._id} error={errors.reportsTo} />
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

/* ────────────────────────────────────────────────────────────────────────
   Reset Password Modal (unchanged behaviour)
   ──────────────────────────────────────────────────────────────────────── */

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
      console.error('resetPassword failed:', err);
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

/* ────────────────────────────────────────────────────────────────────────
   Dealer / Salesperson Assignment Modal — link dealers to a staff member
   ──────────────────────────────────────────────────────────────────────── */

const getDirectDealerAssignment = (dealer) => {
  const roleFields = ['so', 'se', 'asm', 'rsm', 'nsm'];
  for (const role of roleFields) {
    const value = dealer?.[role];
    const ids = Array.isArray(value) ? value : [value];
    if (ids.some(Boolean)) return { role, ids: ids.filter(Boolean).map(toId) };
  }
  return { role: null, ids: [] };
};

const getStaffDealerField = (role) => role === 'so' ? 'so' : role;

function DealerAssignModal({ open, onClose, staff, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pool, setPool] = useState([]); // unassigned + already-assigned-to-this-staff
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || !staff) return;
    setLoading(true);
    dealerService.getAll({ limit: 2000 })
      .then(res => {
        const all = res.data.data;
        const field = getStaffDealerField(staff.role);
        const isAssignedToStaff = d => {
          const value = d[field];
          const ids = Array.isArray(value) ? value : [value];
          return ids.some(item => toId(item) === staff._id?.toString());
        };
        const isUnassigned = d => getDirectDealerAssignment(d).ids.length === 0;
        const relevant = all.filter(d =>
          isAssignedToStaff(d) ||
          isUnassigned(d) ||
          (staff.provinces?.length && staff.provinces.includes(d.province))
        );
        setPool(relevant);
        setSelected(new Set(all.filter(isAssignedToStaff).map(d => d._id)));
      })
      .catch(err => { console.error('load dealers failed:', err); toast.error('Failed to load dealers'); })
      .finally(() => setLoading(false));
  }, [open, staff]);

  const filtered = pool.filter(d =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase()) || d.code?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const field = getStaffDealerField(staff.role);
      const assignedValue = field === 'so' ? [staff._id] : staff._id;
      const clearValue = field === 'so' ? [] : null;
      const directFields = ['se', 'so', 'asm', 'rsm', 'nsm'];
      const originallyAssigned = new Set(pool.filter(d => {
        const value = d[field];
        const ids = Array.isArray(value) ? value : [value];
        return ids.some(item => toId(item) === staff._id?.toString());
      }).map(d => d._id));
      const toAssign = [...selected].filter(id => !originallyAssigned.has(id));
      const toUnassign = [...originallyAssigned].filter(id => !selected.has(id));
      await Promise.all([
        ...toAssign.map(id => dealerService.update(id, directFields.reduce((payload, roleField) => ({
          ...payload,
          [roleField]: roleField === field ? assignedValue : (roleField === 'so' ? [] : null),
          assignedRole: field,
        }), {}))),
        ...toUnassign.map(id => dealerService.update(id, { [field]: clearValue, assignedRole: null })),
      ]);
      toast.success('Dealer assignments updated');
      onClose();
      onSuccess();
    } catch (err) {
      console.error('dealer assignment failed:', err);
      toast.error(err.response?.data?.message || 'Failed to update assignments');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Assign Dealers — ${staff?.name}`}>
      <div className="space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <FiLink /> Dealers checked below will use this staff member as their salesperson.
        </div>

        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Search dealer name or ID..." />
        </div>

        <div className="max-h-72 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-400">Loading dealers...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">No dealers found</div>
          ) : filtered.map(d => (
            <label key={d._id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
              <input type="checkbox" checked={selected.has(d._id)} onChange={() => toggle(d._id)}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
              <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0">
                {d.dealerName?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{d.dealerName}</p>
                <p className="text-xs text-slate-500">{d.dealerCode} · {d.area || d.district}</p>
              </div>
              {getDirectDealerAssignment(d).ids.length > 0 && !getDirectDealerAssignment(d).ids.includes(staff._id?.toString()) && (
                <span className="text-[10px] text-warning font-medium">Reassign</span>
              )}
            </label>
          ))}
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-slate-500">{selected.size} of {pool.length} dealer{pool.length !== 1 ? 's' : ''} selected</span>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving...' : 'Save Assignments'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Subordinates Modal — shows all staff under a manager grouped by role
   ──────────────────────────────────────────────────────────────────────── */

// Normalize any value (ObjectId, populated object, or string) to a plain string
const toId = (v) => (v?._id ?? v)?.toString() ?? null;

// Returns all users that fall under `managerId` for the given manager role
// Uses stamped hierarchy fields (rsm/asm/nsm) AND reportsTo for direct links
function getSubordinates(managerId, managerRole, allUsers) {
  // Recursively collect ALL descendants via reportsTo chain
  const result = [];
  const visited = new Set();
  function collect(id) {
    if (!id || visited.has(id)) return;
    visited.add(id);
    allUsers.forEach(u => {
      if (toId(u.reportsTo) === id) {
        result.push(u);
        collect(u._id?.toString());
      }
    });
  }
  // Also include stamped-field matches for NSM/RSM/ASM (users who may not have reportsTo set)
  const stampedIds = new Set();
  allUsers.forEach(u => {
    const mid = managerId?.toString();
    if (managerRole === 'nsm' && toId(u.nsm) === mid) stampedIds.add(u._id?.toString());
    if (managerRole === 'rsm' && toId(u.rsm) === mid) stampedIds.add(u._id?.toString());
    if (managerRole === 'asm' && toId(u.asm) === mid) stampedIds.add(u._id?.toString());
  });
  collect(managerId?.toString());
  // Add any stamped users not already found
  allUsers.forEach(u => {
    if (stampedIds.has(u._id?.toString()) && !result.find(r => r._id?.toString() === u._id?.toString())) {
      result.push(u);
      collect(u._id?.toString());
    }
  });
  return result;
}

// Recursively count all dealers under a user (through any depth)
function countDealersUnder(userId, allUsers, dealers = []) {
  const id = userId?.toString();
  if (!id) return 0;
  const descendantIds = new Set([id]);
  const directChildren = allUsers.filter(u => toId(u.reportsTo) === id);
  let count = 0;
  for (const child of directChildren) {
    descendantIds.add(child._id?.toString());
    if (child.role !== 'dealer') count += countDealersUnder(child._id, allUsers, dealers);
  }
  return count + dealers.filter(d => {
    const assignment = getDirectDealerAssignment(d);
    return assignment.ids.some(assignedId => descendantIds.has(assignedId));
  }).length;
}

function SubHierarchyNode({ user, allUsers, dealers, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const directChildren = allUsers
    .filter(u => toId(u.reportsTo) === user._id?.toString())
    .sort((a, b) => (ROLE_LEVEL[a.role] || 9) - (ROLE_LEVEL[b.role] || 9));
  const directDealers = dealers.filter(d => getDirectDealerAssignment(d).ids.includes(user._id?.toString()));
  const dealerCount = user.role !== 'dealer' ? countDealersUnder(user._id, allUsers, dealers) : 0;
  const c = ROLE_COLOR[user.role] || ROLE_COLOR.se;

  return (
    <div className={depth > 0 ? 'ml-4 border-l-2 border-slate-100 dark:border-slate-700 pl-3' : ''}>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${directChildren.length ? '' : 'cursor-default'}`}
        onClick={() => directChildren.length && setExpanded(e => !e)}
      >
        {directChildren.length > 0 && (
          <span className="text-slate-400 text-xs w-3">{expanded ? '▾' : '▸'}</span>
        )}
        {directChildren.length === 0 && <span className="w-3" />}
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>{user.role.toUpperCase()}</span>
        <span className="text-sm font-medium text-slate-800 dark:text-white truncate flex-1">{user.name}</span>
        {user.district && <span className="text-xs text-slate-400 shrink-0">{user.district}</span>}
        {dealerCount > 0 && (
          <span className="text-[10px] font-semibold text-pink-600 bg-pink-50 dark:bg-pink-900/30 px-1.5 py-0.5 rounded-full shrink-0">
            {dealerCount} dealer{dealerCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {expanded && directChildren.map(child => (
        <SubHierarchyNode key={child._id} user={child} allUsers={allUsers} dealers={dealers} depth={depth + 1} />
      ))}
      {directDealers.map(dealer => (
        <div key={dealer._id} className="ml-4 border-l-2 border-pink-100 dark:border-pink-900/40 pl-3 py-1.5 flex items-center gap-2">
          <span className="w-3 shrink-0" />
          <span className="w-6 h-6 bg-pink-500 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {dealer.dealerName?.[0]?.toUpperCase() || '?'}
          </span>
          <span className="text-xs text-slate-600 dark:text-slate-300">{dealer.dealerName}</span>
          <span className="text-[10px] text-slate-400">{dealer.address || dealer.district || dealer.area || ''}</span>
        </div>
      ))}
    </div>
  );
}

function SubordinatesModal({ open, onClose, manager, allUsers, dealers }) {
  if (!manager) return null;

  // Direct children of this manager
  const directChildren = allUsers
    .filter(u => toId(u.reportsTo) === manager._id?.toString())
    .sort((a, b) => (ROLE_LEVEL[a.role] || 9) - (ROLE_LEVEL[b.role] || 9));

  // Total dealers anywhere under this manager
  const totalDealers = countDealersUnder(manager._id, allUsers, dealers);

  // Flat summary counts by role
  const allSubs = getSubordinates(manager._id, manager.role, allUsers);
  const hasDirectDealers = dealers.some(d => getDirectDealerAssignment(d).ids.includes(manager._id?.toString()));
  const roleCounts = {};
  allSubs.forEach(u => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1; });
  const roleOrder = ['rsm', 'asm', 'se', 'so', 'dealer'];

  return (
    <Modal open={open} onClose={onClose} title={`Team under ${manager.name}`}>
      <div className="space-y-4">
        {/* Summary chips */}
        <div className="flex flex-wrap gap-2">
          {roleOrder.filter(r => roleCounts[r]).map(r => {
            const c = ROLE_COLOR[r] || ROLE_COLOR.se;
            return (
              <span key={r} className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {roleCounts[r]} {r.toUpperCase()}{roleCounts[r] !== 1 ? 's' : ''}
              </span>
            );
          })}
          {totalDealers > 0 && !roleCounts['dealer'] && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
              {totalDealers} Total Dealers
            </span>
          )}
          {allSubs.length === 0 && !hasDirectDealers && <p className="text-sm text-slate-400">No team members yet.</p>}
        </div>

        {/* Hierarchy tree */}
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {directChildren.map(child => (
            <SubHierarchyNode key={child._id} user={child} allUsers={allUsers} dealers={dealers} depth={0} />
          ))}
          {dealers.filter(d => getDirectDealerAssignment(d).ids.includes(manager._id?.toString())).map(dealer => (
            <div key={dealer._id} className="flex items-center gap-2 py-1.5 px-2">
              <span className="w-3 shrink-0" />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pink-100 text-pink-700">DEALER</span>
              <span className="text-sm font-medium text-slate-800 dark:text-white">{dealer.dealerName}</span>
              <span className="text-xs text-slate-400">{dealer.address || dealer.district || dealer.area || ''}</span>
            </div>
          ))}
        </div>

        {/* Total dealers footer */}
        {totalDealers > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-sm font-semibold text-pink-600 dark:text-pink-400">
            Total Dealers = {totalDealers}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Staff Card — grid view with stats
   ──────────────────────────────────────────────────────────────────────── */

function StaffCard({ user, reportsToUser, allUsers, dealers, dealerCount, onEdit, onResetPass, onToggle, onDelete, onAssignDealers }) {
  const [showSubs, setShowSubs] = useState(false);
  const color = ROLE_COLOR[user.role] || ROLE_COLOR.se;

  // Compute subordinate counts per role for the summary chips
  const subs = getSubordinates(user._id, user.role, allUsers);
  const subsByRole = {};
  subs.forEach(u => { subsByRole[u.role] = (subsByRole[u.role] || 0) + 1; });
  const roleOrder = ['rsm', 'asm', 'se', 'so', 'dealer'];
  const subChips = roleOrder.filter(r => subsByRole[r]).map(r => ({ role: r, count: subsByRole[r] }));

  return (
    <>
      <div className={`card border-l-4 ${color.border} flex flex-col gap-3`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={user.name} role={user.role} />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
              <RoleBadge role={user.role} />
            </div>
          </div>
          <button onClick={() => onToggle(user)}
            className={`shrink-0 p-1.5 rounded-full transition-colors ${user.status === 'active' ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
            title={user.status === 'active' ? 'Active — click to deactivate' : 'Inactive — click to activate'}>
            {user.status === 'active' ? <FiToggleRight className="text-xl" /> : <FiToggleLeft className="text-xl" />}
          </button>
        </div>

        <div className="text-xs text-slate-500 space-y-1">
          {user.employeeId && (
            <p className="flex items-center gap-1.5">
              <span className="font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[11px]">{user.employeeId}</span>
              {user.designation && <span className="text-slate-400">· {user.designation}</span>}
            </p>
          )}
          <p className="flex items-center gap-1.5 truncate"><FiMail className="shrink-0" /> {user.email}</p>
          {user.phone && <p className="flex items-center gap-1.5"><FiPhone className="shrink-0" /> {user.phone}</p>}
          {(user.area || user.district) && <p className="flex items-center gap-1.5"><FiMapPin className="shrink-0" /> {[user.area, user.district].filter(Boolean).join(', ')}</p>}
          {user.monthlyTarget > 0 && (
            <p className="flex items-center gap-1.5"><FiTarget className="shrink-0 text-green-500" /> Target: Rs {user.monthlyTarget.toLocaleString()}</p>
          )}
        </div>

        <ProvinceChips provinces={user.provinces || (user.province ? [user.province] : [])} />

        {reportsToUser && (
          <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700">
            <FiUserCheck className="shrink-0" /> Reports to <span className="font-medium text-slate-700 dark:text-slate-300">{reportsToUser.name}</span>
          </div>
        )}

        {/* Subordinate summary chips — clickable */}
        {(subChips.length > 0 || dealerCount > 0) && (
          <button onClick={() => setShowSubs(true)}
            className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700 text-left hover:opacity-80 transition-opacity">
            {subChips.map(({ role, count }) => {
              const c = ROLE_COLOR[role] || ROLE_COLOR.se;
              return (
                <span key={role} className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  {count} {role.toUpperCase()}{count !== 1 ? 's' : ''}
                </span>
              );
            })}
            <span className="text-[10px] text-slate-400 self-center ml-1">tap to view ›</span>
          </button>
        )}

        {user.role !== 'dealer' && user.role !== 'admin' && (
          <div className="flex items-center pt-2 border-t border-slate-100 dark:border-slate-700">
            <button onClick={() => onAssignDealers(user)}
              className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
              <FiLink /> {dealerCount} dealer{dealerCount !== 1 ? 's' : ''}
            </button>
          </div>
        )}

        <div className="flex gap-1 justify-end pt-1">
          <button onClick={() => onEdit(user)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600 transition-colors" title="Edit"><FiEdit2 className="text-sm" /></button>
          <button onClick={() => onResetPass(user)} className="p-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg text-warning transition-colors" title="Reset password"><FiKey className="text-sm" /></button>
          <button onClick={() => onDelete(user._id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-danger transition-colors" title="Delete"><FiTrash2 className="text-sm" /></button>
        </div>
      </div>

      <SubordinatesModal open={showSubs} onClose={() => setShowSubs(false)} manager={user} allUsers={allUsers} dealers={dealers} />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Hierarchy Tree — recursive collapsible nodes
   ──────────────────────────────────────────────────────────────────────── */

function HierarchyNode({ node, depth = 0, onEdit, onAssignDealers }) {
  const [collapsed, setCollapsed] = useState(depth >= 2);
  const color = ROLE_COLOR[node.role] || ROLE_COLOR.se;
  const hasChildren = node.children?.length > 0;
  const hasDealers = node.dealers?.length > 0;

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-slate-100 dark:border-slate-700 pl-4' : ''}>
      <div className="flex items-center gap-2 py-2 group">
        {(hasChildren || hasDealers) ? (
          <button onClick={() => setCollapsed(c => !c)} className="p-0.5 text-slate-400 hover:text-slate-600 shrink-0">
            {collapsed ? <FiChevronRight /> : <FiChevronDown />}
          </button>
        ) : <span className="w-4 shrink-0" />}

        <Avatar name={node.name} role={node.role} size="w-8 h-8 text-xs" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-slate-900 dark:text-white">{node.name}</span>
            <RoleBadge role={node.role} />
            {node.status !== 'active' && <span className="text-[10px] text-red-500 font-medium">Inactive</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <ProvinceChips provinces={node.provinces || []} max={2} />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {node.role !== 'dealer' && node.role !== 'admin' && (
            <button onClick={() => onAssignDealers(node)} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              <FiLink /> {node.dealers?.length || 0}
            </button>
          )}
          <button onClick={() => onEdit(node)} className="p-1 text-slate-400 hover:text-blue-600"><FiEdit2 className="text-xs" /></button>
        </div>
      </div>

      {!collapsed && (
        <div>
          {node.children?.map(child => (
            <HierarchyNode key={child._id} node={child} depth={depth + 1} onEdit={onEdit} onAssignDealers={onAssignDealers} />
          ))}
          {node.dealers?.map(d => (
            <div key={d._id} className="ml-6 border-l-2 border-slate-100 dark:border-slate-700 pl-4 py-1.5 flex items-center gap-2">
              <span className="w-4 shrink-0" />
              <div className="w-6 h-6 bg-pink-500 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                {d.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-300">{d.name}</span>
              <span className="text-[10px] text-slate-400">{d.code}</span>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildHierarchyTree(users, dealers) {
  const byParent = (role, parentId) => users.filter(u => u.role === role && toId(u.reportsTo) === parentId?.toString());
  const dealersFor = (user) => dealers.filter(d => getDirectDealerAssignment(d).ids.includes(user._id?.toString()));

  const attach = (u) => {
    const children = (CHILD_ROLE[u.role] && CHILD_ROLE[u.role] !== 'dealer')
      ? byParent(CHILD_ROLE[u.role], u._id).map(attach)
      : [];
    const dealers = u.role !== 'dealer' && u.role !== 'admin' ? dealersFor(u) : [];
    return { ...u, children, dealers };
  };

  const roots = users.filter(u => u.role === 'nsm').map(attach);

  // Anything whose declared parent doesn't exist / isn't linked yet
  const linkedIds = new Set();
  const collectIds = (node) => { linkedIds.add(node._id); node.children.forEach(collectIds); };
  roots.forEach(collectIds);
  const orphans = users.filter(u => u.role !== 'admin' && u.role !== 'nsm' && !linkedIds.has(u._id)).map(attach);

  return { roots, orphans };
}

/* ────────────────────────────────────────────────────────────────────────
   Main Settings Page
   ──────────────────────────────────────────────────────────────────────── */

export default function Settings() {
  const [users, setUsers]           = useState([]);
  const [dealers, setDealers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState('cards'); // 'cards' | 'tree'
  const [roleFilter, setRoleFilter] = useState('all');
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]         = useState('');

  const [createModal, setCreateModal] = useState({ open: false, province: '', reportsTo: '', role: '' });
  const [editModal, setEditModal]     = useState({ open: false, staff: null });
  const [resetModal, setResetModal]   = useState({ open: false, staff: null });
  const [dealerModal, setDealerModal] = useState({ open: false, staff: null });
  const [confirm, setConfirm]         = useState({ open: false, id: null });
  const [deleting, setDeleting]       = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [uRes, dRes] = await Promise.all([
        userService.getAll(),
        dealerService.getAll({ limit: 2000 }),
      ]);
      setUsers(uRes.data.data);
      setDealers(dRes.data.data);
    } catch (err) {
      console.error('fetch settings data failed:', err);
      toast.error('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const staffUsers = users.filter(u => u.role !== 'admin');
  const adminUsers = users.filter(u => u.role === 'admin');

  const filtered = staffUsers.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (provinceFilter !== 'all' && !(u.provinces || []).includes(provinceFilter)) return false;
    if (statusFilter === 'active' && u.status !== 'active') return false;
    if (statusFilter === 'inactive' && u.status === 'active') return false;
    if (search && !`${u.name} ${u.email} ${u.employeeId || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const usersById = useMemo(() => Object.fromEntries(users.map(u => [u._id, u])), [users]);
  const reportsToId = (u) => u.reportsTo?._id || u.reportsTo || null;
  const dealersFor = (id) => dealers.filter(d => getDirectDealerAssignment(d).ids.includes(id?.toString())).length;

  const stats = useMemo(() => ({
    total: staffUsers.length,
    active: staffUsers.filter(u => u.status === 'active').length,
    nsm: staffUsers.filter(u => u.role === 'nsm').length,
    rsm: staffUsers.filter(u => u.role === 'rsm').length,
    asm: staffUsers.filter(u => u.role === 'asm').length,
    se: staffUsers.filter(u => u.role === 'se').length,
    so: staffUsers.filter(u => u.role === 'so').length,
    dealers: dealers.length,
    unassignedDealers: dealers.filter(d => getDirectDealerAssignment(d).ids.length === 0).length,
  }), [staffUsers, dealers]);

  const tree = useMemo(() => buildHierarchyTree(staffUsers, dealers), [staffUsers, dealers]);

  const handleToggle = async (u) => {
    try {
      const res = await userService.toggleStatus(u._id);
      toast.success(res.data.message);
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await userService.delete(confirm.id);
      toast.success('Staff deleted');
      setConfirm({ open: false, id: null });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
    finally { setDeleting(false); }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Staff Management</h1>
          <p className="text-sm text-slate-500 mt-1">NSM → RSM → ASM → SE → SO hierarchy · {staffUsers.length} staff</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button onClick={() => setView('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'cards' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>
              <FiGrid /> Cards
            </button>
            <button onClick={() => setView('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'tree' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>
              <FiShare2 /> Tree
            </button>
          </div>
          <button className="btn-primary" onClick={() => setCreateModal({ open: true, province: '', reportsTo: '', role: '' })}>
            <FiPlus /> Add Staff
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<FiUsers />} label="Total Staff" value={stats.total} tint="bg-slate-700"
          onClick={() => { setRoleFilter('all'); setStatusFilter('all'); setView('cards'); }} />
        <StatCard icon={<FiUserCheck />} label="Active" value={stats.active} tint="bg-green-500"
          onClick={() => { setRoleFilter('all'); setStatusFilter('active'); setView('cards'); }} />
        <StatCard icon={<FiTarget />} label="NSM" value={stats.nsm} tint={ROLE_COLOR.nsm.dot}
          onClick={() => { setRoleFilter('nsm'); setStatusFilter('all'); setView('cards'); }} />
        <StatCard icon={<FiTarget />} label="RSM" value={stats.rsm} tint={ROLE_COLOR.rsm.dot}
          onClick={() => { setRoleFilter('rsm'); setStatusFilter('all'); setView('cards'); }} />
        <StatCard icon={<FiTarget />} label="ASM / SE" value={`${stats.asm} / ${stats.se}`} tint={ROLE_COLOR.se.dot}
          onClick={() => { setRoleFilter('asm'); setStatusFilter('all'); setView('cards'); }} />
        <StatCard icon={<FiTarget />} label="SO" value={stats.so} tint={ROLE_COLOR.so.dot}
          onClick={() => { setRoleFilter('so'); setStatusFilter('all'); setView('cards'); }} />
        <StatCard icon={<FiBriefcase />} label="Dealers" value={`${stats.dealers} (${stats.unassignedDealers} unassigned)`} tint={ROLE_COLOR.dealer.dot}
          onClick={() => { setRoleFilter('dealer'); setStatusFilter('all'); setView('cards'); }} />
      </div>

      {/* Admin card */}
      {adminUsers.length > 0 && (
        <div className="card border-l-4 border-primary-600">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Admin Account</p>
          <div className="flex flex-wrap gap-4">
            {adminUsers.map(u => (
              <div key={u._id} className="flex items-center gap-3">
                <Avatar name={u.name} role="admin" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Search by name or email..." />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><FiX /></button>}
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input sm:w-56">
          <option value="all">All Roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={provinceFilter} onChange={e => setProvinceFilter(e.target.value)} className="input sm:w-56">
          <option value="all">All Provinces</option>
          {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input sm:w-40">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Cards view */}
      {view === 'cards' && (
        filtered.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl mb-4">
              <FiUser className="text-3xl text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">No staff match these filters</h3>
            <button className="btn-primary mt-3" onClick={() => setCreateModal({ open: true, province: '', reportsTo: '', role: '' })}>
              <FiPlus /> Add Staff
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(u => (
              <StaffCard key={u._id} user={u}
                reportsToUser={u.reportsTo ? (u.reportsTo._id ? u.reportsTo : usersById[u.reportsTo]) : null}
                allUsers={staffUsers}
                dealers={dealers}
                dealerCount={dealersFor(u._id)}
                onEdit={(staff) => setEditModal({ open: true, staff })}
                onResetPass={(staff) => setResetModal({ open: true, staff })}
                onToggle={handleToggle}
                onDelete={(id) => setConfirm({ open: true, id })}
                onAssignDealers={(staff) => setDealerModal({ open: true, staff })} />
            ))}
          </div>
        )
      )}

      {/* Tree view */}
      {view === 'tree' && (
        <div className="card">
          {tree.roots.length === 0 && tree.orphans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FiShare2 className="text-3xl text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Add an NSM to start building the hierarchy</p>
            </div>
          ) : (
            <>
              {tree.roots.map(node => (
                <HierarchyNode key={node._id} node={node}
                  onEdit={(staff) => setEditModal({ open: true, staff })}
                  onAssignDealers={(staff) => setDealerModal({ open: true, staff })} />
              ))}
              {tree.orphans.length > 0 && (
                <div className="mt-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-warning uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FiSlash /> Not linked to a parent yet
                  </p>
                  {tree.orphans.map(node => (
                    <HierarchyNode key={node._id} node={node}
                      onEdit={(staff) => setEditModal({ open: true, staff })}
                      onAssignDealers={(staff) => setDealerModal({ open: true, staff })} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <CreateStaffModal open={createModal.open} onClose={() => setCreateModal({ open: false, province: '', reportsTo: '', role: '' })}
        allUsers={staffUsers} allDealers={dealers} defaultProvince={createModal.province} defaultReportsTo={createModal.reportsTo} defaultRole={createModal.role}
        onSuccess={fetchAll} />
      <EditStaffModal open={editModal.open} onClose={() => setEditModal({ open: false, staff: null })}
        staff={editModal.staff} allUsers={staffUsers} onSuccess={fetchAll} />
      <ResetPasswordModal open={resetModal.open} onClose={() => setResetModal({ open: false, staff: null })}
        staff={resetModal.staff} onSuccess={fetchAll} />
      <DealerAssignModal open={dealerModal.open} onClose={() => setDealerModal({ open: false, staff: null })}
        staff={dealerModal.staff} onSuccess={fetchAll} />
      <ConfirmDialog open={confirm.open} title="Delete Staff Account"
        message="This will permanently delete the staff account."
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
    </div>
  );
}
