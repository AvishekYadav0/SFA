import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { dealerService } from '../services';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { StatusBadge, formatCurrency } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import {
  FiPlus, FiEdit2, FiTrash2, FiMapPin, FiArrowLeft, FiShoppingBag
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

export default function Dealers() {
  const [allData, setAllData]                   = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [modal, setModal]                       = useState({ open: false, data: null, province: '' });
  const [confirm, setConfirm]                   = useState({ open: false, id: null });
  const [deleting, setDeleting]                 = useState(false);

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

  const provinceCounts = PROVINCES.reduce((acc, p) => {
    acc[p] = allData.filter(d => d.province === p).length;
    return acc;
  }, {});

  const provinceData = selectedProvince
    ? allData.filter(d => d.province === selectedProvince)
    : [];

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
                    <th>Area</th>
                    <th>PAN</th>
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
                          <span className="font-medium">{d.dealerName}</span>
                        </div>
                      </td>
                      <td>{d.ownerName}</td>
                      <td>{d.phone}</td>
                      <td>{d.area}</td>
                      <td className="text-slate-500">{d.panNumber || '—'}</td>
                      <td>{formatCurrency(d.creditLimit)}</td>
                      <td>{formatCurrency(d.openingBalance)}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td>
                        <div className="flex gap-1.5">
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

      {/* 7 Province Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {PROVINCES.map((province, idx) => {
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Area *</label>
            <input {...register('area', { required: 'Required' })} className="input" placeholder="e.g. New Road" />
            {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area.message}</p>}
          </div>
          <div>
            <label className="label">Address</label>
            <input {...register('address')} className="input" placeholder="e.g. New Road, Kathmandu" />
          </div>
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
