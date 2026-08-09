import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { dealerService, userService } from '../services';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { StatusBadge, formatCurrency } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import {
  FiPlus, FiEdit2, FiTrash2, FiMapPin, FiArrowLeft, FiShoppingBag, FiLink, FiUserPlus
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const PROVINCES = [
  'Koshi Province',
  'Madhesh Province',
  'Bagmati Province',
  'Gandaki Province',
  'Lumbini Province',
  'Karnali Province',
  'Sudurpashchim Province',
];

const PROVINCE_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/20',     border: 'border-blue-200 dark:border-blue-700',     icon: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300'   },
  { bg: 'bg-green-50 dark:bg-green-900/20',   border: 'border-green-200 dark:border-green-700',   icon: 'bg-green-500',   text: 'text-green-700 dark:text-green-300' },
  { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-700', icon: 'bg-purple-500',  text: 'text-purple-700 dark:text-purple-300'},
  { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700', icon: 'bg-orange-500',  text: 'text-orange-700 dark:text-orange-300'},
  { bg: 'bg-pink-50 dark:bg-pink-900/20',     border: 'border-pink-200 dark:border-pink-700',     icon: 'bg-pink-500',    text: 'text-pink-700 dark:text-pink-300'   },
  { bg: 'bg-teal-50 dark:bg-teal-900/20',     border: 'border-teal-200 dark:border-teal-700',     icon: 'bg-teal-500',    text: 'text-teal-700 dark:text-teal-300'   },
  { bg: 'bg-red-50 dark:bg-red-900/20',       border: 'border-red-200 dark:border-red-700',       icon: 'bg-red-500',     text: 'text-red-700 dark:text-red-300'     },
];

const getDealerStaff = (dealer) => {
  const roles = [
    ['so', 'SO'], ['se', 'SE'], ['asm', 'ASM'], ['rsm', 'RSM'], ['nsm', 'NSM'],
  ];
  for (const [field, role] of roles) {
    const value = Array.isArray(dealer?.[field]) ? dealer[field][0] : dealer?.[field];
    if (value) return { name: value.name || value.fullName || '', role };
  }
  return null;
};

const getDealerTeam = (dealer) => {
  const roles = [
    ['so', 'SO'], ['se', 'SE'], ['asm', 'ASM'], ['rsm', 'RSM'], ['nsm', 'NSM'],
  ];
  return roles.flatMap(([field, role]) => {
    const values = Array.isArray(dealer?.[field]) ? dealer[field] : [dealer?.[field]];
    return values.filter(Boolean).map(value => ({
      name: value.name || value.fullName || '',
      role,
    }));
  });
};

import { useAuth } from '../context/AuthContext';

export default function Dealers() {
  const { user } = useAuth();
  const [allData, setAllData]                   = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [modal, setModal]                       = useState({ open: false, data: null, province: '' });
  const [confirm, setConfirm]                   = useState({ open: false, id: null });
  const [deleting, setDeleting]                 = useState(false);
  const [linkModal, setLinkModal]               = useState({ open: false, dealer: null });
  const [soModal, setSoModal]                   = useState({ open: false, dealer: null });
  const [allUsers, setAllUsers]                 = useState([]);
  const [allSOs, setAllSOs]                     = useState([]);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await dealerService.getAll({ limit: 1000 });
      setAllData(res.data.data);
    } catch { toast.error('Failed to load dealers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const showAllProvinces = ['admin', 'nsm', 'rsm'].includes(user?.role);

  const provinceCounts = PROVINCES.reduce((acc, p) => {
    acc[p] = allData.filter(d => d.province === p).length;
    return acc;
  }, {});

  const visibleProvinces = showAllProvinces
    ? PROVINCES
    : PROVINCES.filter(p => provinceCounts[p] > 0);

  const provinceData = selectedProvince
    ? allData.filter(d => d.province === selectedProvince)
    : [];

  const openLinkModal = async (dealer) => {
    try {
      const res = await userService.getAll({ role: 'dealer', limit: 1000 });
      setAllUsers(res.data.data || []);
    } catch { setAllUsers([]); }
    setLinkModal({ open: true, dealer });
  };

  const openSOModal = async (dealer) => {
    try {
      const res = await userService.getAll({ limit: 1000 });
      setAllSOs((res.data.data || []).filter(user => ['so', 'se', 'asm', 'rsm', 'nsm'].includes(user.role)));
    } catch { setAllSOs([]); }
    setSoModal({ open: true, dealer });
  };

  const handleAssignSO = async (staffIds) => {
    try {
      const assignments = allSOs.filter(staff => staffIds.includes(staff._id)).map(staff => ({ id: staff._id, role: staff.role }));
      await dealerService.assignSO(soModal.dealer._id, assignments);
      toast.success('Sales team assigned!');
      setSoModal({ open: false, dealer: null });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to assign SO'); }
  };

  const handleLinkUser = async (userId) => {
    try {
      await dealerService.linkUser(linkModal.dealer._id, userId);
      toast.success('User linked to dealer!');
      setLinkModal({ open: false, dealer: null });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to link user'); }
  };

  const openCreate = (province = '') => {
    reset({ province, status: 'active', openingBalance: 0, creditLimit: 0 });
    setModal({ open: true, data: null, province });
  };

  const openEdit = (d) => {
    reset(d);
    setModal({ open: true, data: d, province: d.province });
  };

  const onSubmit = async (data) => {
    try {
      if (modal.data) await dealerService.update(modal.data._id, data);
      else await dealerService.create(data);
      toast.success(modal.data ? 'Dealer updated!' : 'Dealer added!');
      setModal({ open: false, data: null, province: '' });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving dealer'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await dealerService.delete(confirm.id);
      toast.success('Dealer deleted');
      setConfirm({ open: false, id: null });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setDeleting(false); }
  };

  if (loading) return <PageLoader />;

  // ── Province drill-down view ──
  if (selectedProvince) {
    const colorIdx = PROVINCES.indexOf(selectedProvince);
    const color = PROVINCE_COLORS[colorIdx];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedProvince(null)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FiArrowLeft className="text-slate-600 dark:text-slate-300 text-xl" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedProvince}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {provinceData.length} dealer{provinceData.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button className="btn-primary" onClick={() => openCreate(selectedProvince)}>
            <FiPlus /> Add Dealer
          </button>
        </div>

        {/* Table */}
        <div className="card p-0">
          {provinceData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FiShoppingBag className="text-5xl mb-3 opacity-30" />
              <p className="font-medium text-slate-500">No dealers in {selectedProvince}</p>
              <p className="text-sm mt-1">Click "Add Dealer" to add one</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Dealer Name</th>
                    <th>Owner</th>
                    <th>Phone</th>
                    <th>PAN</th>
                    <th>NID</th>
                    <th>Credit Limit</th>
                    <th>Opening Bal.</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {provinceData.map(d => (
                    <tr key={d._id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full ${color.icon} flex items-center justify-center flex-shrink-0`}>
                            <FiShoppingBag className="text-white text-xs" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium block">{d.dealerName}</span>
                            {getDealerTeam(d).length > 0 && (
                              <span className="text-[10px] text-primary-600 block mt-0.5">
                                {getDealerTeam(d).map((staff, index) => (
                                  <span key={`${staff.role}-${staff.name}`}>
                                    {index > 0 ? ' · ' : '👤 '}{staff.name} ({staff.role})
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{d.ownerName}</td>
                      <td>{d.phone}</td>
                      <td className="text-slate-500">{d.panNumber || '—'}</td>
                      <td className="text-slate-500">{d.nidNumber || '—'}</td>
                      <td>{formatCurrency(d.creditLimit)}</td>
                      <td>{formatCurrency(d.openingBalance)}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td>
                        <div className="flex gap-1.5">
                          <button onClick={() => openSOModal(d)}
                            title="Assign Sales Officers"
                            className="p-1.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg text-yellow-600 transition-colors">
                            <FiUserPlus size={14} />
                          </button>
                          <button onClick={() => openLinkModal(d)}
                            title={d.linkedUser ? 'Change linked user' : 'Link user account'}
                            className={`p-1.5 rounded-lg transition-colors ${d.linkedUser ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                            <FiLink size={14} />
                          </button>
                          <button onClick={() => openEdit(d)}
                            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600 transition-colors">
                            <FiEdit2 size={14} />
                          </button>
                          <button onClick={() => setConfirm({ open: true, id: d._id })}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors">
                            <FiTrash2 size={14} />
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

        <DealerModal
          modal={modal} onClose={() => setModal({ open: false, data: null, province: '' })}
          onSubmit={handleSubmit(onSubmit)} register={register} errors={errors} isSubmitting={isSubmitting}
        />
        <AssignSOModal
          modal={soModal} sos={allSOs}
          onClose={() => setSoModal({ open: false, dealer: null })}
          onAssign={handleAssignSO}
        />
        <LinkUserModal
          modal={linkModal}
          users={allUsers}
          onClose={() => setLinkModal({ open: false, dealer: null })}
          onLink={handleLinkUser}
        />
        <ConfirmDialog open={confirm.open} title="Delete Dealer"
          message="This will permanently delete this dealer. This action cannot be undone."
          onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
      </div>
    );
  }

  // ── Province grid view ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dealers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {allData.length} total · Select a province to view dealers
          </p>
        </div>
        <button className="btn-primary" onClick={() => openCreate()}>
          <FiPlus /> Add Dealer
        </button>
      </div>

      {/* Province Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibleProvinces.map((province) => {
          const idx = PROVINCES.indexOf(province);
          const color = PROVINCE_COLORS[idx];
          const count  = provinceCounts[province] || 0;
          const active = allData.filter(d => d.province === province && d.status === 'active').length;

          return (
            <button
              key={province}
              onClick={() => setSelectedProvince(province)}
              className={`${color.bg} ${color.border} border-2 rounded-2xl p-5 text-left hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${color.icon} rounded-xl flex items-center justify-center shadow-sm`}>
                  <FiMapPin className="text-white text-xl" />
                </div>
                <span className={`text-3xl font-bold ${color.text}`}>{count}</span>
              </div>
              <p className={`font-semibold text-base ${color.text} leading-tight`}>{province}</p>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                {active} active · {count - active} inactive
              </p>
              <p className={`text-xs mt-3 font-medium ${color.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
                Click to view dealers →
              </p>
            </button>
          );
        })}

        {/* Total summary box */}
        <div className="bg-slate-800 dark:bg-slate-700 rounded-2xl p-5 text-left border-2 border-slate-700 dark:border-slate-600">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-slate-600 rounded-xl flex items-center justify-center shadow-sm">
              <FiShoppingBag className="text-white text-xl" />
            </div>
            <span className="text-3xl font-bold text-white">{allData.length}</span>
          </div>
          <p className="font-semibold text-base text-white">All Provinces</p>
          <p className="text-slate-400 text-xs mt-1">
            {allData.filter(d => d.status === 'active').length} active total
          </p>
        </div>
      </div>

      <DealerModal
        modal={modal} onClose={() => setModal({ open: false, data: null, province: '' })}
        onSubmit={handleSubmit(onSubmit)} register={register} errors={errors} isSubmitting={isSubmitting}
      />
      <ConfirmDialog open={confirm.open} title="Delete Dealer"
        message="This will permanently delete this dealer. This action cannot be undone."
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
    </div>
  );
}

function AssignSOModal({ modal, sos, onClose, onAssign }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (modal.open) {
      const existing = ['so', 'se', 'asm', 'rsm', 'nsm'].flatMap(role => {
        const value = modal.dealer?.[role];
        const values = Array.isArray(value) ? value : [value];
        return values.filter(Boolean).map(staff => staff._id || staff);
      });
      setSelected(existing);
    }
  }, [modal]);

  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onAssign(selected);
    setSaving(false);
  };

  return (
    <Modal open={modal.open} onClose={onClose} title="Assign Sales Team" size="sm">
      <p className="text-sm text-slate-500 mb-4">
        Select a salesperson for <strong>{modal.dealer?.dealerName}</strong>. The selected person will auto-fill in Orders and Sales.
      </p>
      {getDealerTeam(modal.dealer).length > 0 && (
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Current dealer team</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {getDealerTeam(modal.dealer).map(staff => (
              <span key={`${staff.role}-${staff.name}`} className="text-xs font-medium text-slate-700">
                👤 {staff.name} <span className="text-blue-600">({staff.role})</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
          {sos.length === 0 ? (
            <p className="text-xs text-amber-600 text-center py-4">No sales team members found. Create staff in Team Management first.</p>
          ) : sos.map(so => (
            <label key={so._id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(so._id)}
                onChange={() => toggle(so._id)}
                className="w-4 h-4 accent-yellow-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{so.name} <span className="text-primary-600">({so.role.toUpperCase()})</span></p>
                <p className="text-xs text-slate-400">{so.employeeId || so.email}</p>
                {so.reportsTo?.name && (
                  <p className="text-[10px] text-primary-600 mt-0.5">SE: {so.reportsTo.name}</p>
                )}
                {(so.asm?.name || so.rsm?.name || so.nsm?.name) && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {[so.asm?.name && `ASM: ${so.asm.name}`, so.rsm?.name && `RSM: ${so.rsm.name}`, so.nsm?.name && `NSM: ${so.nsm.name}`].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : `Assign (${selected.length})`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LinkUserModal({ modal, users, onClose, onLink }) {
  const [selected, setSelected] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (modal.open) setSelected(modal.dealer?.linkedUser?._id || modal.dealer?.linkedUser || '');
  }, [modal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setLinking(true);
    await onLink(selected);
    setLinking(false);
  };

  return (
    <Modal open={modal.open} onClose={onClose} title="Link User Account" size="sm">
      <p className="text-sm text-slate-500 mb-4">
        Link a dealer-role user account to <strong>{modal.dealer?.dealerName}</strong> so they can log in to the dealer portal.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Select Dealer User</label>
          <select value={selected} onChange={e => setSelected(e.target.value)} className="input" required>
            <option value="">-- Select a user --</option>
            {users.map(u => (
              <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
            ))}
          </select>
          {users.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">No dealer-role users found. Create one in Settings first.</p>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={linking || !selected}>
            {linking ? 'Linking...' : 'Link User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DealerModal({ modal, onClose, onSubmit, register, errors, isSubmitting }) {
  return (
    <Modal open={modal.open} onClose={onClose}
      title={modal.data ? 'Edit Dealer' : 'Add Dealer'} size="md">
      <form onSubmit={onSubmit} className="space-y-4">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Dealer Name *</label>
            <input {...register('dealerName', { required: 'Required' })} className="input" placeholder="e.g. ABC Traders" />
            {errors.dealerName && <p className="text-red-500 text-xs mt-1">{errors.dealerName.message}</p>}
          </div>
          <div>
            <label className="label">Owner Name *</label>
            <input {...register('ownerName', { required: 'Required' })} className="input" placeholder="e.g. Ram Bahadur" />
            {errors.ownerName && <p className="text-red-500 text-xs mt-1">{errors.ownerName.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Phone Number *</label>
            <input {...register('phone', { required: 'Required' })} className="input" placeholder="e.g. 9800000000" />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="label">PAN Number</label>
            <input {...register('panNumber')} className="input" placeholder="e.g. 123456789" />
          </div>
          <div>
            <label className="label">NID Number</label>
            <input {...register('nidNumber')} className="input" placeholder="e.g. 12345678" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Province *</label>
            <select {...register('province', { required: 'Province is required' })} className="input">
              <option value="">Select Province...</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {errors.province && <p className="text-red-500 text-xs mt-1">{errors.province.message}</p>}
          </div>
          <div>
            <label className="label">District</label>
            <input {...register('district')} className="input" placeholder="e.g. Kathmandu" />
          </div>
        </div>

        <div>
          <label className="label">Address</label>
          <input {...register('address')} className="input" placeholder="e.g. New Road, Kathmandu" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Opening Balance (NPR)</label>
            <input {...register('openingBalance', { valueAsNumber: true })} type="number" step="0.01" className="input" defaultValue={0} />
          </div>
          <div>
            <label className="label">Credit Limit (NPR)</label>
            <input {...register('creditLimit', { valueAsNumber: true })} type="number" step="0.01" className="input" defaultValue={0} />
          </div>
        </div>

        <div>
          <label className="label">Status</label>
          <select {...register('status')} className="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : modal.data ? 'Update Dealer' : 'Add Dealer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
