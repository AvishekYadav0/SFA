import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { visitService, dealerService, userService } from '../services';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Pagination } from '../components/common/Pagination';
import { SearchInput } from '../components/common/SearchInput';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge, formatDate } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { FiEdit2, FiTrash2, FiMapPin, FiCamera } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Visits() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
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
  const [staffList, setStaffList]   = useState([]);
  const [filteredDealers, setFilteredDealers] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm();

  const canViewAllStaff = ['admin', 'nsm', 'rsm', 'asm'].includes(user?.role);
  const isManager = ['admin', 'nsm', 'rsm', 'asm'].includes(user?.role);
  const currentStaffOption = user
    ? (staffList.find(s => String(s._id) === String(user._id)) || {
        _id: user._id,
        name: user.name,
        role: user.role,
        employeeId: user.employeeId || user.role?.toUpperCase(),
      })
    : null;
  const selectedStaff = watch('se');
  const selectedDealer = watch('dealer');

  const load = () => {
    setLoading(true);
    visitService.getAll({ page, limit: 15 })
      .then(r => { setVisits(r.data.data); setTotal(r.data.total); setPages(r.data.pages); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  useEffect(() => {
    // For SE/SO: only fetch their assigned dealers
    if (user?.role === 'se') {
      dealerService.getAll({ limit: 500, se: user._id }).then(r => setDealers(r.data.data || [])).catch(() => {});
    } else if (user?.role === 'so') {
      dealerService.getAll({ limit: 500, so: user._id }).then(r => setDealers(r.data.data || [])).catch(() => {});
    } else {
      dealerService.getAll({ limit: 500 }).then(r => setDealers(r.data.data || [])).catch(() => {});
    }
    if (canViewAllStaff) {
      userService.getAll({ limit: 200, status: 'active' }).then(r => setStaffList(r.data.data || [])).catch(() => {});
    }
  }, [user, canViewAllStaff]);

  // Managers: when staff selection changes, filter dealers by that staff member's role
  useEffect(() => {
    if (!isManager) return;
    if (!selectedStaff) { setFilteredDealers(dealers); return; }
    const staff = staffList.find(s => s._id === selectedStaff);
    if (!staff) { setFilteredDealers(dealers); return; }
    setStaffLoading(true);
    const roleParam = staff.role === 'so'  ? { so:  staff._id } :
                      staff.role === 'se'  ? { se:  staff._id } :
                      staff.role === 'asm' ? { asm: staff._id } :
                      staff.role === 'rsm' ? { rsm: staff._id } :
                      staff.role === 'nsm' ? { nsm: staff._id } : {};
    dealerService.getAll({ limit: 500, ...roleParam })
      .then(r => setFilteredDealers(r.data.data || []))
      .catch(() => setFilteredDealers([]))
      .finally(() => setStaffLoading(false));
  }, [selectedStaff, staffList, dealers, isManager]);

  // SE/SO: always use their own dealers
  useEffect(() => {
    if (!isManager) setFilteredDealers(dealers);
  }, [dealers, isManager]);

  // When dealer is selected, auto-fill Staff Member from dealer hierarchy only if none is already selected.
  useEffect(() => {
    if (!selectedDealer || !isManager) return;
    if (selectedStaff) return;

    const dealer = (isManager ? filteredDealers : dealers).find(d => d._id === selectedDealer)
      || dealers.find(d => d._id === selectedDealer);
    if (!dealer) return;

    // Pick the most specific assigned staff from dealer hierarchy
    const staffId = dealer.so?.[0]?._id || dealer.so?.[0]
      || dealer.se?._id || dealer.se
      || dealer.asm?._id || dealer.asm
      || dealer.rsm?._id || dealer.rsm
      || dealer.nsm?._id || dealer.nsm;

    if (staffId) setValue('se', typeof staffId === 'object' ? String(staffId) : staffId);
  }, [selectedDealer, selectedStaff, isManager, filteredDealers, dealers, setValue]);

  const getGPS = () => {
    if (!window.isSecureContext) {
      toast.error('GPS requires HTTPS in production (localhost is also supported).');
      return;
    }
    if (!navigator.geolocation) {
      toast.error('This browser does not support location access.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue('checkInLat', pos.coords.latitude);
        setValue('checkInLng', pos.coords.longitude);
        toast.success('GPS location captured');
        setGpsLoading(false);
      },
      (error) => {
        const message = error.code === 1
          ? 'Location permission was denied.'
          : error.code === 3
            ? 'Location request timed out. Try again.'
            : 'Current location could not be determined.';
        toast.error(message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const openEdit = (v) => {
    reset({ ...v, dealer: v.dealer?._id || v.dealer, se: v.se?._id || v.se });
    setModal({ open: true, data: v });
  };

  const onSubmit = async (data) => {
    if (!modal.data) {
      toast.error('Check in from an eligible assigned stop in Daily Visits.');
      return;
    }
    try {
      const payload = {
        ...data,
        checkInTime: data.checkInTime ? new Date(data.checkInTime).toISOString() : undefined,
      };

      await visitService.update(modal.data._id, payload);
      toast.success('Updated');
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
          <p className="text-sm text-slate-500 mt-1">{total} total records · Check in and GPS check out from the active assigned stop in Daily Visits.</p>
        </div>
      </div>

      <div className="card p-0">
        {loading ? <PageLoader /> : visits.length === 0 ? (
          <EmptyState icon={FiMapPin} title="No visits recorded" description="Check in from an eligible assigned stop in Daily Visits." />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {visits.map(v => (
                <div key={v._id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{v.dealer?.dealerName || '—'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{v.so?.name || v.se?.name || '—'}</p>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-slate-500">
                    <span>In: {v.checkInTime ? new Date(v.checkInTime).toLocaleString() : '—'}</span>
                    <span>Out: {v.checkOutTime ? new Date(v.checkOutTime).toLocaleString() : '—'}</span>
                  </div>
                  <VisitLocationVerification visit={v} />
                  {v.remarks && <p className="text-xs text-slate-400 truncate">{v.remarks}</p>}
                  <div className="flex gap-2 pt-1">
                    {isAdmin && <button onClick={() => openEdit(v)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600"><FiEdit2 size={14} /></button>}
                    {isAdmin && !v.checkInEmployee && !v.dailyVisit && !v.checkOutAttempts?.length && <button onClick={() => setConfirm({ open: true, id: v._id })} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"><FiTrash2 size={14} /></button>}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Dealer</th><th>Staff Member</th><th>Check In</th><th>Check Out</th><th>Status</th><th>GPS Verification</th><th>Remarks</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {visits.map(v => (
                    <tr key={v._id}>
                      <td className="font-medium">{v.dealer?.dealerName || '—'}</td>
                      <td className="text-slate-500 text-sm">{v.so?.name || v.se?.name || '—'}</td>
                      <td className="text-slate-500 text-sm">{v.checkInTime ? new Date(v.checkInTime).toLocaleString() : '—'}</td>
                      <td className="text-slate-500 text-sm">{v.checkOutTime ? new Date(v.checkOutTime).toLocaleString() : '—'}</td>
                      <td><StatusBadge status={v.status} /></td>
                      <td><VisitLocationVerification visit={v} /></td>
                      <td className="text-slate-500 text-sm max-w-32 truncate">{v.remarks || '—'}</td>
                      <td>
                        <div className="flex gap-2">
                          {isAdmin && <button onClick={() => openEdit(v)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600"><FiEdit2 /></button>}
                          {isAdmin && !v.checkInEmployee && !v.dailyVisit && !v.checkOutAttempts?.length && <button onClick={() => setConfirm({ open: true, id: v._id })} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"><FiTrash2 /></button>}
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
        title="Edit Visit" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Staff Member — admin/nsm see the full staff list, others see their own entry */}
          <div className="sm:col-span-2">
            <label className="label">Staff Member</label>
            {canViewAllStaff ? (
              <select {...register('se')} className="input">
                <option value="">— All Staff —</option>
                {currentStaffOption && (
                  <optgroup label="Current User">
                    <option value={String(currentStaffOption._id)}>
                      {currentStaffOption.name} ({currentStaffOption.employeeId || currentStaffOption.role?.toUpperCase() || 'STAFF'})
                    </option>
                  </optgroup>
                )}
                {['nsm','rsm','asm','se','so'].map(role => {
                  const group = staffList.filter(s => s.role === role)
                    .filter(s => String(s._id) !== String(currentStaffOption?._id || ''));
                  if (!group.length) return null;
                  return (
                    <optgroup key={role} label={role.toUpperCase()}>
                      {group.map(s => <option key={s._id} value={String(s._id)}>{s.name} ({s.employeeId || role.toUpperCase()})</option>)}
                    </optgroup>
                  );
                })}
              </select>
            ) : (
              <input
                value={user?.name ? `${user.name} (${user.role?.toUpperCase()})` : ''}
                readOnly
                className="input bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
              />
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Dealer *</label>
            <select {...register('dealer', { required: 'Required' })} className="input" disabled={staffLoading || Boolean(modal.data?.checkInEmployee)}>
              <option value="">{staffLoading ? 'Loading...' : 'Select dealer...'}</option>
              {filteredDealers.map(d => (
                <option key={d._id} value={d._id}>
                  {d.dealerName}{d.locationVerificationStatus === 'approved' ? '' : ' — location pending approval'}
                </option>
              ))}
            </select>
            {errors.dealer && <p className="text-danger text-xs mt-1">{errors.dealer.message}</p>}
            {selectedDealer && (filteredDealers.find(d => d._id === selectedDealer) || dealers.find(d => d._id === selectedDealer))?.locationVerificationStatus !== 'approved' && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                GPS check-in is unavailable until this dealer's location is approved.
              </p>
            )}
          </div>
          <div>
            <label className="label">Check In Time</label>
            <input {...register('checkInTime')} type="datetime-local" readOnly className="input" />
          </div>
          <div>
            <label className="label">GPS Latitude</label>
            <div className="flex gap-2">
              <input {...register('checkInLat')} type="number" step="any" className="input flex-1" placeholder="Latitude" readOnly={Boolean(modal.data?.checkInEmployee)} />
              <button type="button" onClick={getGPS}
                className="btn-secondary text-xs px-3" disabled={gpsLoading || Boolean(modal.data?.checkInEmployee)}>{gpsLoading ? '...' : <FiMapPin />}</button>
            </div>
          </div>
          <div>
            <label className="label">GPS Longitude</label>
            <input {...register('checkInLng')} type="number" step="any" className="input" placeholder="Longitude" readOnly={Boolean(modal.data?.checkInEmployee)} />
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
            <input value={modal.data?.status || ''} readOnly className="input" />
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

function VisitLocationVerification({ visit }) {
  const status = visit.locationVerificationStatus || 'not_verified';
  const label = status === 'within_geofence' ? 'Within geofence'
    : status === 'outside_geofence' ? 'Outside geofence'
      : 'Not verified';
  const className = status === 'within_geofence'
    ? 'text-green-700 dark:text-green-400'
    : status === 'outside_geofence'
      ? 'text-red-700 dark:text-red-400'
      : 'text-amber-700 dark:text-amber-300';
  const checkOutStatus = visit.checkOutLocationVerificationStatus || 'not_verified';
  const checkOutLabel = checkOutStatus === 'within_geofence' ? 'Within geofence'
    : checkOutStatus === 'outside_geofence' ? 'Outside geofence'
      : 'Not verified';
  return (
    <div className="text-xs">
      <p className={className} title={visit.locationVerificationMessage || label}>
        Check-in: {label}
        {Number.isFinite(visit.locationDistanceMeters) && ` · ${Math.round(visit.locationDistanceMeters)} m`}
        {Number.isFinite(visit.checkInAccuracyMeters) && ` · accuracy ${Math.round(visit.checkInAccuracyMeters)} m`}
      </p>
      {(visit.checkOutTime || visit.checkOutReviewStatus === 'pending') && (
        <p className={visit.checkOutReviewStatus === 'pending' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}>
          Check-out: {visit.checkOutReviewStatus === 'pending' ? 'Admin review pending' : checkOutLabel}
          {Number.isFinite(visit.checkOutDistanceMeters) && ` · ${Math.round(visit.checkOutDistanceMeters)} m`}
          {Number.isFinite(visit.checkOutAccuracyMeters) && ` · accuracy ${Math.round(visit.checkOutAccuracyMeters)} m`}
          {Number.isFinite(visit.checkOutDurationSeconds) && ` · ${Math.floor(visit.checkOutDurationSeconds / 60)} min`}
          {visit.checkOutReviewReason && ` · ${visit.checkOutReviewReason}`}
        </p>
      )}
      {visit.checkOutReviewHistory?.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Admin resolution: {visit.checkOutReviewHistory[visit.checkOutReviewHistory.length - 1].outcome} · {visit.checkOutReviewHistory[visit.checkOutReviewHistory.length - 1].reason}
        </p>
      )}
    </div>
  );
}
