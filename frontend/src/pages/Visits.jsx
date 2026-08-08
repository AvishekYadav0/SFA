import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { visitService, dealerService } from '../services';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Pagination } from '../components/common/Pagination';
import { SearchInput } from '../components/common/SearchInput';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge, formatDate } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { FiPlus, FiEdit2, FiTrash2, FiMapPin, FiClock, FiCamera } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Visits() {
  const { user } = useAuth();
  const [visits, setVisits]   = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [dealers, setDealers] = useState([]);
  const [modal, setModal]     = useState({ open: false, data: null });
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm();

  const load = () => {
    setLoading(true);
    visitService.getAll({ page, limit: 15 })
      .then(r => { setVisits(r.data.data); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => {
    dealerService.getAll({ limit: 500 }).then(r => setDealers(r.data.data || [])).catch(() => {});
  }, []);

  const getGPS = () => {
    setGpsLoading(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setValue('checkInLat', pos.coords.latitude);
        setValue('checkInLng', pos.coords.longitude);
        toast.success('GPS location captured');
        setGpsLoading(false);
      },
      () => { toast.error('GPS not available'); setGpsLoading(false); }
    );
  };

  const openCreate = () => {
    reset({ checkInTime: new Date().toISOString().slice(0, 16), status: 'checked-in' });
    setModal({ open: true, data: null });
  };
  const openEdit = (v) => { reset({ ...v, dealer: v.dealer?._id || v.dealer }); setModal({ open: true, data: v }); };

  const onSubmit = async (data) => {
    try {
      if (modal.data) await visitService.update(modal.data._id, data);
      else await visitService.create(data);
      toast.success(modal.data ? 'Updated' : 'Visit recorded');
      setModal({ open: false, data: null });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await visitService.delete(confirm.id); toast.success('Deleted'); setConfirm({ open: false, id: null }); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Visits</h1>
          <p className="text-sm text-slate-500 mt-1">{total} total records</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={openCreate}><FiPlus />Check In</button>
        </div>
      </div>

      <div className="card p-0">
        {loading ? <PageLoader /> : visits.length === 0 ? (
          <EmptyState icon={FiMapPin} title="No visits recorded" description="Record your first dealer visit"
            action={<button className="btn-primary" onClick={openCreate}><FiPlus />Check In</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Dealer</th><th>SE</th><th>Check In</th><th>Check Out</th><th>Area</th><th>Status</th><th>Remarks</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {visits.map(v => (
                    <tr key={v._id}>
                      <td className="font-medium">{v.dealer?.dealerName || '—'}</td>
                      <td className="text-slate-500 text-sm">{v.se?.name || '—'}</td>
                      <td className="text-slate-500 text-sm">{v.checkInTime ? new Date(v.checkInTime).toLocaleString() : '—'}</td>
                      <td className="text-slate-500 text-sm">{v.checkOutTime ? new Date(v.checkOutTime).toLocaleString() : '—'}</td>
                      <td className="text-slate-500 text-sm">{v.area || '—'}</td>
                      <td><StatusBadge status={v.status} /></td>
                      <td className="text-slate-500 text-sm max-w-32 truncate">{v.remarks || '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(v)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600"><FiEdit2 /></button>
                          <button onClick={() => setConfirm({ open: true, id: v._id })} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"><FiTrash2 /></button>
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
        title={modal.data ? 'Edit Visit' : 'Record Visit'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Dealer *</label>
            <select {...register('dealer', { required: 'Required' })} className="input">
              <option value="">Select dealer...</option>
              {dealers.map(d => <option key={d._id} value={d._id}>{d.dealerName} — {d.area}</option>)}
            </select>
            {errors.dealer && <p className="text-danger text-xs mt-1">{errors.dealer.message}</p>}
          </div>
          <div>
            <label className="label">Check In Time</label>
            <input {...register('checkInTime')} type="datetime-local" className="input" />
          </div>
          <div>
            <label className="label">Check Out Time</label>
            <input {...register('checkOutTime')} type="datetime-local" className="input" />
          </div>
          <div>
            <label className="label">GPS Latitude</label>
            <div className="flex gap-2">
              <input {...register('checkInLat')} type="number" step="any" className="input flex-1" placeholder="Latitude" />
              <button type="button" onClick={getGPS} disabled={gpsLoading}
                className="btn-secondary text-xs px-3">{gpsLoading ? '...' : <FiMapPin />}</button>
            </div>
          </div>
          <div>
            <label className="label">GPS Longitude</label>
            <input {...register('checkInLng')} type="number" step="any" className="input" placeholder="Longitude" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Remarks</label>
            <textarea {...register('remarks')} className="input" rows={2} placeholder="Visit remarks..." />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Complaint</label>
            <textarea {...register('complaint')} className="input" rows={2} placeholder="Any complaint..." />
          </div>
          <div>
            <label className="label">Market Survey</label>
            <textarea {...register('marketSurvey')} className="input" rows={2} placeholder="Market survey notes..." />
          </div>
          <div>
            <label className="label">Competitor Info</label>
            <textarea {...register('competitorInfo')} className="input" rows={2} placeholder="Competitor information..." />
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="checked-in">Checked In</option>
              <option value="checked-out">Checked Out</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : modal.data ? 'Update' : 'Record Visit'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={confirm.open} title="Delete Visit" message="This action cannot be undone."
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
    </div>
  );
}
