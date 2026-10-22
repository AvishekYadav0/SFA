import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { dailyVisitService, userService, dealerService, visitService } from '../services';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/common/Spinner';
import { FiMapPin, FiPlus, FiTrash2, FiCheck, FiX, FiCalendar, FiUser, FiArrowLeft, FiPhone, FiLock, FiCrosshair } from 'react-icons/fi';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  verified: 'bg-emerald-100 text-emerald-700',
  suspicious: 'bg-orange-100 text-orange-700',
  invalid: 'bg-red-100 text-red-700',
  missed: 'bg-slate-200 text-slate-700',
};

const today = () => new Date().toISOString().split('T')[0];
const FIELD_ROLES = ['so', 'se', 'asm', 'rsm', 'nsm'];
const statusOf = visit => visit.workflowStatus || visit.status || (
  visit.visitStatus === 'visited' ? 'completed' :
    visit.visitStatus === 'skipped' ? 'missed' : 'pending'
);
const verificationOf = visit => visit.verificationStatus
  || visit.visit?.verificationStatus
  || (['verified', 'suspicious', 'invalid'].includes(visit.status) ? visit.status : 'pending');
const statusLabel = status => ({
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  verified: 'Verified',
  suspicious: 'Suspicious',
  invalid: 'Invalid',
  missed: 'Missed',
}[status] || 'Pending');
const isCompleteStatus = (status, visit) => ['completed', 'verified', 'suspicious', 'invalid'].includes(status)
  && visit?.requiresReview !== true;
const refId = value => String(value?._id || value || '');
const MAX_GPS_ACCURACY_METERS = 50;
const DEFAULT_GEOFENCE_RADIUS_METERS = 75;
const distanceInMeters = (latitude1, longitude1, latitude2, longitude2) => {
  const radians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};
const approvedDealerCoordinates = dealer => {
  if (
    dealer?.latitude === null || dealer?.latitude === undefined || dealer?.latitude === ''
    || dealer?.longitude === null || dealer?.longitude === undefined || dealer?.longitude === ''
  ) return null;
  const latitude = Number(dealer?.latitude);
  const longitude = Number(dealer?.longitude);
  if (
    dealer?.locationVerificationStatus !== 'approved'
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) return null;
  return { latitude, longitude };
};
const formatElapsed = seconds => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':');
};

function DealerMap({ dealer, coordinates }) {
  const mapElement = useRef(null);
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;

  useEffect(() => {
    if (!mapElement.current || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

    const center = [latitude, longitude];
    const map = L.map(mapElement.current, { zoomControl: true }).setView(center, 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const popup = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = dealer?.dealerName || 'Dealer';
    const address = document.createElement('div');
    address.textContent = dealer?.address || dealer?.area || 'Address not provided';
    popup.append(name, address);

    L.marker(center).addTo(map).bindPopup(popup).openPopup();
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
    };
  }, [latitude, longitude, dealer?.address, dealer?.area, dealer?.dealerName]);

  return (
    <div
      ref={mapElement}
      className="h-72 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
      aria-label={`Map showing ${dealer?.dealerName || 'dealer'} location`}
    />
  );
}

function isDealerAssignedToStaff(dealer, staff) {
  if (!dealer || !staff) return false;
  if (staff.role === 'so') {
    return (Array.isArray(dealer.so) ? dealer.so : [dealer.so]).some(id => refId(id) === String(staff._id));
  }
  return refId(dealer[staff.role]) === String(staff._id);
}

/* ── Admin: Assign Modal ─────────────────────────────── */
function AssignModal({ open, onClose, onSaved, staffList, dealerList }) {
  const [date, setDate]             = useState(today());
  const [staffId, setStaffId]       = useState('');
  const [selected, setSelected]     = useState([]);
  const [search, setSearch]         = useState('');
  const [saving, setSaving]         = useState(false);

  if (!open) return null;

  const selectedStaff = staffList.find(staff => staff._id === staffId);
  const filtered = dealerList.filter(d =>
    isDealerAssignedToStaff(d, selectedStaff) && (
      d.dealerName?.toLowerCase().includes(search.toLowerCase()) ||
      d.area?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const toggle = (id) =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleSave = async () => {
    if (!staffId) return toast.error('Select a staff member');
    if (!selected.length) return toast.error('Select at least one dealer');
    setSaving(true);
    try {
      await dailyVisitService.assign({ date, staff: staffId, dealers: selected });
      toast.success('Dealers assigned!');
      setSelected([]); setSearch(''); setStaffId('');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error assigning');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-bold text-slate-800 dark:text-white text-lg">Assign Shops</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <FiX className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-sm" />
            </div>
            <div>
              <label className="label text-xs">Staff Member *</label>
              <select value={staffId} onChange={e => { setStaffId(e.target.value); setSelected([]); }} className="input text-sm">
                <option value="">Select staff...</option>
                {staffList.map(s => <option key={s._id} value={s._id}>{s.name} ({s.role?.toUpperCase()})</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label text-xs">Select Dealers in visit order ({selected.length} selected)</label>
            <input
              type="text" placeholder="Search dealer or area..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="input text-sm mb-2"
            />
            <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-y-auto max-h-52">
              {!staffId ? (
                <p className="text-center text-slate-400 text-sm py-6">Select an employee first</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-6">No dealers found</p>
              ) : filtered.map(d => (
                <label key={d._id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <input type="checkbox" checked={selected.includes(d._id)}
                    onChange={() => toggle(d._id)} className="rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{d.dealerName}</p>
                    <p className="text-xs text-slate-500">{d.area} · {d.province}</p>
                  </div>
                  {selected.includes(d._id) && <span className="text-xs font-semibold text-blue-600">Stop {selected.indexOf(d._id) + 1}</span>}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-700">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Assigning...' : `Assign ${selected.length || ''} Dealers`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Visit Detail Screen ─────────────────────────────── */
function VisitDetail({ visit, onBack, onDone, onStart, isCurrent, activeVisitStatus, activeVisitRecord, activeCheckoutLoading, onCheckOutActiveVisit }) {
  const [notes, setNotes] = useState(visit.notes || '');
  const [saving, setSaving] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [proximity, setProximity] = useState({ status: 'idle', distanceMeters: null, accuracyMeters: null });
  const [gpsWatchAttempt, setGpsWatchAttempt] = useState(0);
  const [showDealerMap, setShowDealerMap] = useState(visit.showDealerMap === true);
  const [now, setNow] = useState(Date.now());
  const d = visit.dealer;
  const status = statusOf(visit);
  const locationApproved = d?.locationVerificationStatus === 'approved';
  const dealerActive = d?.status === 'active';
  const mapCoordinates = approvedDealerCoordinates(d);
  const geofenceRadius = Number(d?.geofenceRadius) > 0
    ? Number(d.geofenceRadius)
    : DEFAULT_GEOFENCE_RADIUS_METERS;
  const hasActiveCheckIn = visit.visit?.status === 'checked-in';
  const activeRecordMatchesStop = activeVisitRecord && (
    refId(activeVisitRecord.dailyVisit) === refId(visit._id)
    || refId(activeVisitRecord.dealer) === refId(d?._id)
  );
  const hasOtherActiveVisit = activeVisitStatus === 'active' && !hasActiveCheckIn && !activeRecordMatchesStop;

  useEffect(() => {
    if (status !== 'in_progress' || hasActiveCheckIn || visit.requiresReview
      || !locationApproved || !dealerActive || activeVisitStatus !== 'clear'
      || !mapCoordinates) {
      setProximity({ status: 'idle', distanceMeters: null, accuracyMeters: null });
      return undefined;
    }
    if (!window.isSecureContext || !navigator.geolocation) {
      setProximity({ status: 'error', message: 'Location access requires a supported browser and a secure connection.' });
      return undefined;
    }

    setProximity({ status: 'locating', distanceMeters: null, accuracyMeters: null });
    const watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        if (
          !Number.isFinite(latitude) || latitude < -90 || latitude > 90
          || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
          || !Number.isFinite(accuracy) || accuracy < 0
        ) {
          setProximity({ status: 'error', message: 'The device returned an invalid GPS fix. Retry GPS detection.' });
          return;
        }
        const distanceMeters = distanceInMeters(
          latitude,
          longitude,
          mapCoordinates.latitude,
          mapCoordinates.longitude,
        );
        setProximity({
          status: accuracy <= MAX_GPS_ACCURACY_METERS ? 'measured' : 'inaccurate',
          distanceMeters,
          accuracyMeters: accuracy,
        });
      },
      error => {
        const message = error.code === 1
          ? 'Location permission was denied. Allow GPS access to detect when you reach the shop.'
          : error.code === 3
            ? 'GPS is taking too long. Keep this page open and retry your location permission.'
            : 'Your current location is unavailable. Check device location services.';
        setProximity({ status: 'error', message });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [
    status,
    hasActiveCheckIn,
    visit.requiresReview,
    locationApproved,
    dealerActive,
    activeVisitStatus,
    mapCoordinates?.latitude,
    mapCoordinates?.longitude,
    gpsWatchAttempt,
  ]);

  useEffect(() => {
    if (!hasActiveCheckIn) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveCheckIn]);

  const openDirections = () => {
    if (!mapCoordinates) {
      toast.error('This dealer does not have an approved map location.');
      return;
    }
    if (!window.isSecureContext || !navigator.geolocation) {
      toast.error('Current location is required for directions. Use a supported browser over HTTPS.');
      return;
    }

    const mapWindow = window.open('about:blank', '_blank');
    if (!mapWindow) {
      toast.error('Allow pop-ups for SFA to open Google Maps directions.');
      return;
    }
    mapWindow.opener = null;
    mapWindow.document.title = 'Loading Google Maps directions';

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        if (
          !Number.isFinite(latitude) || latitude < -90 || latitude > 90
          || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
        ) {
          mapWindow.close();
          toast.error('Your device returned invalid GPS coordinates. Unable to open directions.');
          return;
        }
        const params = new URLSearchParams({
          api: '1',
          origin: `${latitude},${longitude}`,
          destination: `${mapCoordinates.latitude},${mapCoordinates.longitude}`,
          travelmode: 'driving',
        });
        mapWindow.location.replace(`https://www.google.com/maps/dir/?${params.toString()}`);
      },
      error => {
        mapWindow.close();
        const message = error.code === 1
          ? 'Location permission was denied. Allow GPS access to get directions from your current location.'
          : error.code === 3
            ? 'GPS request timed out. Retry directions from an area with better GPS reception.'
            : 'Your current location is unavailable. Check device location services and retry.';
        toast.error(message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  };

  const checkIn = async () => {
    if (status !== 'in_progress') return toast.error('Start this visit before checking in.');
    setCheckInLoading(true);
    const reportGpsFailure = async reason => {
      const messages = {
        permission_denied: 'Location permission was denied. Allow GPS access before check-in.',
        position_unavailable: 'Current location is unavailable. Check device location services and retry.',
        timeout: 'GPS request timed out. Move to an open area and retry.',
        unsupported: 'GPS requires a supported browser and HTTPS in production.',
      };
      toast.error(messages[reason] || 'GPS could not be captured.');
      try {
        await dailyVisitService.recordGpsFailure(visit._id, { reason });
      } catch (error) {
        toast.error(error.response?.data?.message || 'GPS failed and the attempt could not be recorded.');
        onDone();
        return;
      }
      onDone();
    };
    try {
      if (!window.isSecureContext || !navigator.geolocation) {
        await reportGpsFailure('unsupported');
        return;
      }
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        });
      }).catch(async error => {
        const failureReason = error.code === 1
          ? 'permission_denied'
          : error.code === 2
            ? 'position_unavailable'
            : error.code === 3
              ? 'timeout'
              : 'unsupported';
        await reportGpsFailure(failureReason);
        return null;
      });
      if (!position) return;
      const response = await visitService.create({
        dealer: d?._id,
        dailyVisitId: visit._id,
        remarks: notes,
        checkInLat: position.coords.latitude,
        checkInLng: position.coords.longitude,
        checkInAccuracyMeters: position.coords.accuracy,
        deviceCapturedAt: new Date(position.timestamp).toISOString(),
      });
      const verification = response.data.data;
      toast.success(`Checked in ${verification?.locationDistanceMeters ?? ''} m from the approved location.`);
      onDone();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to check in.');
    } finally {
      setCheckInLoading(false);
    }
  };

  const checkOut = async () => {
    setSaving(true);
    try {
      let payload;
      if (!window.isSecureContext) {
        payload = { failureReason: 'unsupported' };
      } else if (!navigator.geolocation) {
        payload = { failureReason: 'unsupported' };
      } else {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 20000,
              maximumAge: 0,
            });
          });
          payload = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          };
        } catch (gpsError) {
          const failureReason = gpsError.code === 1
            ? 'permission_denied'
            : gpsError.code === 2
              ? 'position_unavailable'
              : gpsError.code === 3
                ? 'timeout'
                : 'unsupported';
          payload = { failureReason };
        }
      }
      const response = await visitService.checkOut(visit.visit._id, payload);
      toast.success(response.data.message || 'GPS check-out saved.');
      onDone();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to check out.');
      if (error.response?.data?.reviewRequired) onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* Back */}
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary-600">
        <FiArrowLeft size={14} /> Back to Shops
      </button>

      {/* Dealer Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
            <FiMapPin className="text-blue-600" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{d?.dealerName}</h2>
            <p className="text-sm text-slate-500">{d?.area} · {d?.province}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-0.5">Phone</p>
            <p className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <FiPhone size={12} /> {d?.phone || '—'}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-0.5">Address</p>
            <p className="font-medium text-slate-700 dark:text-slate-200">{d?.address || d?.area || '—'}</p>
          </div>
        </div>
        {mapCoordinates ? (
          <button
            type="button"
            onClick={() => setShowDealerMap(isOpen => !isOpen)}
            className="btn-secondary mt-4 w-full justify-center"
            aria-expanded={showDealerMap}
          >
            <FiMapPin size={15} /> {showDealerMap ? 'Hide Dealer Map' : 'Open Dealer Map'}
          </button>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            {locationApproved
              ? 'The approved dealer pin is unavailable. Ask an Admin to verify the location.'
              : 'The dealer map is available after an Admin approves its GPS location.'}
          </p>
        )}
        {showDealerMap && mapCoordinates && (
          <div className="mt-4 space-y-3">
            <DealerMap dealer={d} coordinates={mapCoordinates} />
            <button type="button" onClick={openDirections} className="btn-primary w-full justify-center">
              <FiMapPin size={15} /> Get Directions in Google Maps
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Google Maps will route from your device’s current location to this approved dealer pin. Return to SFA to check in and check out.
            </p>
          </div>
        )}
      </div>

      {activeVisitRecord && !hasActiveCheckIn && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Active visit: {activeVisitRecord.dealer?.dealerName || 'Dealer visit'}
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            Checked in {activeVisitRecord.checkInTime ? new Date(activeVisitRecord.checkInTime).toLocaleString() : 'at an unknown time'}.
            {' '}Check it out before starting another dealer.
          </p>
          {activeVisitRecord.checkOutReviewStatus === 'pending' ? (
            <p className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-200">
              Checkout is awaiting authorized Admin/ASM review. You cannot start another visit.
              {activeVisitRecord.checkOutReviewReason && <span className="block text-xs mt-1">{activeVisitRecord.checkOutReviewReason}</span>}
            </p>
          ) : (
            <button
              type="button"
              className="btn-primary mt-3 w-full justify-center"
              disabled={saving || activeCheckoutLoading}
              onClick={onCheckOutActiveVisit}
            >
              {saving || activeCheckoutLoading ? 'Capturing GPS and checking out...' : `Check Out ${activeVisitRecord.dealer?.dealerName || 'Active Visit'}`}
            </button>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <p className="text-sm text-slate-500 mb-3">Visit {visit.sequence} · {statusLabel(status)}</p>
        {status === 'pending' && (
          <div>
            {hasOtherActiveVisit ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">Check out of your active visit before starting another dealer.</p>
            ) : activeRecordMatchesStop && activeVisitStatus === 'active' ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">This stop has an active check-in. Use the GPS Check Out button above to finalize it.</p>
            ) : activeVisitStatus === 'error' ? (
              <p className="text-sm text-red-700 dark:text-red-300">Unable to verify whether you have an active visit. Reload before continuing.</p>
            ) : !dealerActive ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">This dealer is inactive and cannot be checked in.</p>
            ) : !locationApproved ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Check-in is unavailable until an Admin approves this dealer's GPS location.
              </p>
            ) : visit.requiresReview ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                GPS check-in evidence is awaiting an authorized review. Do not retry or skip this stop; the next dealer remains locked.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                  {isCurrent
                    ? `Open the approved dealer map and travel to the shop. Start the visit when you arrive; GPS Check In will then verify that you are within ${geofenceRadius.toLocaleString()} metres.`
                    : 'This stop is locked until the previous dealer visit is completed.'}
                </p>
                <button type="button" className="btn-primary w-full justify-center" disabled={!isCurrent || saving || activeVisitStatus !== 'clear'} onClick={() => onStart(visit)}>
                  {isCurrent ? 'Start Visit & Enable GPS Check In' : <><FiLock /> Complete Previous Visit First</>}
                </button>
              </>
            )}
          </div>
        )}
        {status === 'in_progress' && (
          <>
            {hasActiveCheckIn ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-300">
                  <p className="font-semibold">Active dealer: {d?.dealerName}</p>
                  <p className="mt-1">Checked in: {new Date(visit.visit.checkInTime).toLocaleString()}</p>
                  <p>Elapsed: {formatElapsed((now - new Date(visit.visit.checkInTime).getTime()) / 1000)}</p>
                  <p className="text-xs mt-1">
                    Check-in GPS verified · Accuracy {Math.round(visit.visit.checkInAccuracyMeters)} m · Distance {Math.round(visit.visit.locationDistanceMeters)} m
                  </p>
                </div>
                {visit.visit.checkOutReviewStatus === 'pending' || visit.requiresReview ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Check-out evidence requires authorized Admin/ASM review. This visit remains active and the next dealer is locked.
                    {visit.visit.checkOutReviewReason && <span className="block text-xs mt-1">{visit.visit.checkOutReviewReason}</span>}
                  </p>
                ) : (
                  <button type="button" disabled={saving} onClick={checkOut} className="btn-primary w-full justify-center">
                    <FiCheck /> {saving ? 'Capturing GPS and Checking Out...' : 'Check Out'}
                  </button>
                )}
              </div>
            ) : visit.requiresReview ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                A GPS check-in attempt requires Admin/ASM review. Do not retry or skip this stop; the next dealer remains locked.
                {visit.verificationReason && <span className="block text-xs mt-1">{visit.verificationReason}</span>}
              </p>
            ) : (
              <>
                {hasOtherActiveVisit ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">Check out of your active visit before checking in to another dealer.</p>
                ) : activeRecordMatchesStop && activeVisitStatus === 'active' ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">This stop has an active check-in. Use the GPS Check Out button above to finalize it.</p>
                ) : activeVisitStatus === 'error' ? (
                  <p className="text-sm text-red-700 dark:text-red-300">Unable to verify whether you have an active visit. Reload before checking in.</p>
                ) : activeVisitStatus === 'loading' ? (
                  <p className="text-sm text-slate-500">Checking your active visit status...</p>
                ) : !dealerActive ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">This dealer is inactive and cannot be checked in.</p>
                ) : !locationApproved ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Check-in is unavailable until an Admin approves this dealer's GPS location.
                  </p>
                ) : (
                  <>
                    <label className="label text-xs">Visit Notes (optional)</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input text-sm mb-3" rows={2} placeholder="Add notes from the dealer visit..." />
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-700 p-3 mb-3 text-sm">
                      {proximity.status === 'locating' || proximity.status === 'idle' ? (
                        <p className="text-slate-600 dark:text-slate-300">Checking your GPS distance to the shop… Keep Daily Visits open and allow location access.</p>
                      ) : proximity.status === 'error' ? (
                        <div role="status" className="text-red-700 dark:text-red-300">
                          <p>{proximity.message}</p>
                          <button
                            type="button"
                            className="mt-2 font-semibold underline"
                            onClick={() => setGpsWatchAttempt(attempt => attempt + 1)}
                          >
                            Retry GPS detection
                          </button>
                        </div>
                      ) : proximity.status === 'inaccurate' ? (
                        <p role="status" className="text-amber-700 dark:text-amber-300">
                          GPS accuracy is {Math.round(proximity.accuracyMeters)} m; move to an open area until accuracy is 50 m or better.
                        </p>
                      ) : proximity.distanceMeters > geofenceRadius ? (
                        <p role="status" className="text-amber-700 dark:text-amber-300">
                          You are about {Math.round(proximity.distanceMeters)} m from this shop. Check In appears when you are within {geofenceRadius} m.
                        </p>
                      ) : (
                        <p role="status" className="text-green-700 dark:text-green-300">
                          You are about {Math.round(proximity.distanceMeters)} m from the shop with {Math.round(proximity.accuracyMeters)} m GPS accuracy. Check In is available; the server will verify your GPS again.
                        </p>
                      )}
                    </div>
                    {proximity.status === 'measured' && proximity.distanceMeters <= geofenceRadius && (
                      <button type="button" disabled={checkInLoading || activeVisitStatus !== 'clear'} onClick={checkIn} className="btn-primary w-full justify-center">
                        <FiCrosshair size={15} /> {checkInLoading ? 'Getting GPS and checking in...' : 'Check In'}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        {status === 'suspicious' && visit.requiresReview && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            This visit is Suspicious and requires authorized Admin/ASM review. The next dealer remains locked until the review is resolved.
            {visit.visit?.checkOutReviewReason && <span className="block text-xs mt-1">{visit.visit.checkOutReviewReason}</span>}
          </p>
        )}
        {isCompleteStatus(status, visit) && (
          <p className="text-sm text-green-700 dark:text-green-400">
            <FiCheck className="inline mr-1" /> A visit was recorded for this dealer.
            {visit.visit?.locationVerificationMessage && <span className="block text-xs mt-1">{visit.visit.locationVerificationMessage}</span>}
          </p>
        )}
        {['invalid', 'missed'].includes(status) && (
          <p className="text-sm text-slate-500">This planned stop cannot be completed.</p>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────── */
export default function DailyVisits() {
  const { user } = useAuth();
  const canManage = ['admin', 'asm'].includes(user?.role);
  const isEmployee = FIELD_ROLES.includes(user?.role);

  const [visits, setVisits]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [date, setDate]           = useState(today());
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate]     = useState(today());
  const [staffFilter, setStaffFilter] = useState('');
  const [reportFilters, setReportFilters] = useState({
    rsm: '', asm: '', so: '', se: '', dealer: '', distributor: '', province: '', district: '', visitStatus: '',
  });
  const [reportSummary, setReportSummary] = useState(null);
  const [reportSettings, setReportSettings] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [dealerList, setDealerList] = useState([]);
  const [modal, setModal]         = useState(false);
  const [deleting, setDeleting]   = useState(null);
  const [activeVisit, setActiveVisit] = useState(null);
  const [activeVisitRecord, setActiveVisitRecord] = useState(null);
  const [activeVisitStatus, setActiveVisitStatus] = useState(isEmployee ? 'loading' : 'clear');
  const [reviewOutcomes, setReviewOutcomes] = useState({});
  const [reviewReasons, setReviewReasons] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [resolvingReview, setResolvingReview] = useState(null);
  const canResolveReviews = ['admin', 'asm'].includes(user?.role);

  const load = async () => {
    setLoading(true);
    try {
      if (canManage) {
        const statusFilter = reportFilters.visitStatus;
        const params = {
          startDate,
          endDate,
          staff: staffFilter || undefined,
          rsm: reportFilters.rsm || undefined,
          asm: reportFilters.asm || undefined,
          so: reportFilters.so || undefined,
          se: reportFilters.se || undefined,
          dealer: reportFilters.dealer || undefined,
          distributor: reportFilters.distributor || undefined,
          province: reportFilters.province || undefined,
          district: reportFilters.district || undefined,
          workflowStatus: ['pending', 'in_progress', 'completed', 'missed'].includes(statusFilter) ? statusFilter : undefined,
          verificationStatus: ['verified', 'suspicious', 'invalid'].includes(statusFilter) ? statusFilter : undefined,
        };
        const res = await dailyVisitService.getReport(params);
        setVisits(res.data.data || []);
        setReportSummary(res.data.summary || null);
        setReportSettings(res.data.settings || null);
      } else {
        const res = await dailyVisitService.getMine(date);
        setVisits(res.data.data || []);
      }
      if (isEmployee) {
        setActiveVisitStatus('loading');
        try {
          const response = await visitService.getActive();
          const currentActiveVisit = response.data.data || null;
          setActiveVisitRecord(currentActiveVisit);
          setActiveVisitStatus(currentActiveVisit ? 'active' : 'clear');
        } catch (error) {
          setActiveVisitRecord(null);
          setActiveVisitStatus('error');
          toast.error(error.response?.data?.message || 'Unable to verify active visit status.');
        }
      }
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to load visits'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (canManage) {
      userService.getAll({ limit: 1000, status: 'active' })
        .then(r => {
          const employees = (r.data.data || []).filter(employee => FIELD_ROLES.includes(employee.role));
          if (FIELD_ROLES.includes(user?.role) && !employees.some(employee => refId(employee) === String(user._id))) {
            employees.unshift(user);
          }
          setStaffList(employees);
        })
        .catch(error => toast.error(error.response?.data?.message || 'Failed to load employees'));
      dealerService.getAll({ limit: 1000 })
        .then(r => setDealerList(r.data.data || []))
        .catch(error => toast.error(error.response?.data?.message || 'Failed to load dealers'));
    }
  }, [date, startDate, endDate, staffFilter, reportFilters, canManage, user?._id, user?.role]);

  const checkOutUnlinkedActiveVisit = async (activeRecord = activeVisitRecord) => {
    if (!activeRecord?._id) return;
    setResolvingReview(activeRecord._id);
    try {
      let payload;
      if (!window.isSecureContext || !navigator.geolocation) {
        payload = { failureReason: 'unsupported' };
      } else {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 20000,
              maximumAge: 0,
            });
          });
          payload = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          };
        } catch (gpsError) {
          payload = {
            failureReason: gpsError.code === 1 ? 'permission_denied'
              : gpsError.code === 2 ? 'position_unavailable'
                : gpsError.code === 3 ? 'timeout' : 'unsupported',
          };
        }
      }
      const response = await visitService.checkOut(activeRecord._id, payload);
      toast.success(response.data.message || 'Active visit checked out.');
      setActiveVisit(null);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || (
        !window.isSecureContext || !navigator.geolocation
          ? 'GPS check-out requires a supported browser and HTTPS in production.'
          : 'Unable to check out the active visit.'
      ));
      if (error.response?.data?.reviewRequired) await load();
    } finally {
      setResolvingReview(null);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await dailyVisitService.remove(id);
      toast.success('Pending assignment removed.');
      load();
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to remove assignment.'); }
    finally { setDeleting(null); }
  };

  const handleStart = async (visit) => {
    try {
      const response = await dailyVisitService.start(visit._id);
      setActiveVisit(response.data.data);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to start this visit.');
      await load();
    }
  };

  const handleResolveReview = async (assignment) => {
    const outcome = reviewOutcomes[assignment._id] || 'suspicious';
    const notes = (reviewNotes[assignment._id] || '').trim();
    const overrideReason = (reviewReasons[assignment._id] || '').trim();
    if (notes.length < 3) return toast.error('Enter review notes (at least 3 characters).');
    if (overrideReason.length < 10) return toast.error('Enter an override reason of at least 10 characters.');
    setResolvingReview(assignment._id);
    try {
      const payload = { outcome, notes, overrideReason };
      const response = assignment.visit?._id
        ? await visitService.resolveCheckOut(assignment.visit._id, payload)
        : await dailyVisitService.resolveReview(assignment._id, payload);
      toast.success(response.data.message || 'Visit review resolved.');
      setReviewReasons(previous => ({ ...previous, [assignment._id]: '' }));
      setReviewNotes(previous => ({ ...previous, [assignment._id]: '' }));
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to resolve the visit review.');
    } finally {
      setResolvingReview(null);
    }
  };

  const orderedVisits = [...visits].sort((a, b) => {
    const staffOrder = refId(a.staff).localeCompare(refId(b.staff));
    return staffOrder || (Number(a.sequence) || 0) - (Number(b.sequence) || 0);
  });
  const currentPlanByStaff = new Map();
  for (const visit of orderedVisits) {
    const staffId = refId(visit.staff);
    const status = statusOf(visit);
    if (!currentPlanByStaff.has(staffId) && (['in_progress', 'pending'].includes(status) || visit.requiresReview)) {
      currentPlanByStaff.set(staffId, visit._id);
    }
  }
  const completedCount = visits.filter(visit => isCompleteStatus(statusOf(visit), visit)).length;
  const progressText = `${completedCount} of ${visits.length} dealers completed`;

  if (activeVisit) {
    const status = statusOf(activeVisit);
    const isCurrent = currentPlanByStaff.get(refId(activeVisit.staff)) === activeVisit._id
      && activeVisit.date === today()
      && status === 'pending';
    return (
      <VisitDetail
        visit={activeVisit}
        onBack={() => setActiveVisit(null)}
        onDone={() => { setActiveVisit(null); load(); }}
        onStart={handleStart}
        isCurrent={isEmployee && isCurrent}
        activeVisitStatus={activeVisitStatus}
        activeVisitRecord={activeVisitRecord}
        activeCheckoutLoading={resolvingReview === activeVisitRecord?._id}
        onCheckOutActiveVisit={() => checkOutUnlinkedActiveVisit(activeVisitRecord)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {canManage ? 'Daily Visit Plans' : 'My Assigned Shops'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {canManage ? 'Assign authorized dealers to employees in sequence' : 'Complete each dealer visit to unlock the next stop'}
          </p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={() => setModal(true)}>
            <FiPlus /> Assign Shops
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card space-y-3">
        {canManage ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="text-xs text-slate-500">From date
                  <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="input mt-1 text-sm" />
                </label>
                <label className="text-xs text-slate-500">To date
                  <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="input mt-1 text-sm" />
                </label>
                <label className="text-xs text-slate-500">Visit status
                  <select value={reportFilters.visitStatus} onChange={event => setReportFilters(current => ({ ...current, visitStatus: event.target.value }))} className="input mt-1 text-sm">
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="verified">Verified</option>
                    <option value="suspicious">Suspicious</option>
                    <option value="invalid">Invalid</option>
                    <option value="missed">Missed</option>
                  </select>
                </label>
                <label className="text-xs text-slate-500">Dealer
                  <select value={reportFilters.dealer} onChange={event => setReportFilters(current => ({ ...current, dealer: event.target.value }))} className="input mt-1 text-sm">
                    <option value="">All dealers</option>
                    {dealerList.map(dealer => <option key={dealer._id} value={dealer._id}>{dealer.dealerName}</option>)}
                  </select>
                </label>
                {['rsm', 'asm', 'so', 'se'].map(role => (
                  <label key={role} className="text-xs text-slate-500">{role.toUpperCase()}
                    <select value={reportFilters[role]} onChange={event => setReportFilters(current => ({ ...current, [role]: event.target.value }))} className="input mt-1 text-sm">
                      <option value="">All {role.toUpperCase()}s</option>
                      {staffList.filter(employee => employee.role === role).map(employee => (
                        <option key={employee._id} value={employee._id}>{employee.name} ({employee.employeeId || role.toUpperCase()})</option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className="text-xs text-slate-500">Distributor
                  <select value={reportFilters.distributor} onChange={event => setReportFilters(current => ({ ...current, distributor: event.target.value }))} className="input mt-1 text-sm">
                    <option value="">All distributors</option>
                    {[...new Set(dealerList.map(dealer => dealer.distributor).filter(Boolean))].sort().map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-500">Province
                  <select value={reportFilters.province} onChange={event => setReportFilters(current => ({ ...current, province: event.target.value, district: '' }))} className="input mt-1 text-sm">
                    <option value="">All provinces</option>
                    {[...new Set(dealerList.map(dealer => dealer.province).filter(Boolean))].sort().map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-xs text-slate-500">District
                  <select value={reportFilters.district} onChange={event => setReportFilters(current => ({ ...current, district: event.target.value }))} className="input mt-1 text-sm">
                    <option value="">All districts</option>
                    {[...new Set(dealerList.filter(dealer => !reportFilters.province || dealer.province === reportFilters.province).map(dealer => dealer.district).filter(Boolean))].sort().map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
              {staffList.length > 0 && (
                <label className="block max-w-sm text-xs text-slate-500">Employee
                  <select value={staffFilter} onChange={event => setStaffFilter(event.target.value)} className="input mt-1 text-sm">
                    <option value="">All employees</option>
                    {staffList.map(employee => <option key={employee._id} value={employee._id}>{employee.name} ({employee.role?.toUpperCase()})</option>)}
                  </select>
                </label>
              )}
            </>
        ) : (
            <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <FiCalendar className="text-slate-400" size={14} />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="text-sm bg-transparent outline-none text-slate-700 dark:text-slate-200" />
            </div>
            </div>
        )}
      </div>

      {canManage && reportSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              ['Assigned', reportSummary.totalAssigned],
              ['Completed', reportSummary.completed],
              ['Verified', reportSummary.verified],
              ['Pending', reportSummary.pending],
              ['In Progress', reportSummary.inProgress],
              ['Suspicious', reportSummary.suspicious],
              ['Invalid', reportSummary.invalid],
              ['Missed', reportSummary.missed],
              ['GPS Failures', reportSummary.gpsValidationFailures],
              ['Awaiting Review', reportSummary.awaitingReview],
              ['Active Too Long', reportSummary.activeTooLong],
              ['Dealers Without GPS Approval', reportSummary.dealersWithoutApprovedGps],
            ].map(([label, value]) => (
              <div key={label} className="card p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold text-slate-800 dark:text-white">{value}</p>
              </div>
            ))}
            <p className="col-span-full text-xs text-slate-500">
              Visits record GPS only at check-in and check-out; no continuous live tracking is performed.
              {reportSettings && ` Plan deadline: ${reportSettings.visitPlanDeadlineHourUtc}:00 UTC · Long-active alert: ${reportSettings.maximumActiveVisitHours} hours.`}
            </p>
        </div>
      )}

      {isEmployee && activeVisitRecord && (() => {
        const activeAssignment = visits.find(item => (
          refId(item._id) === refId(activeVisitRecord.dailyVisit)
          && refId(item.visit) === refId(activeVisitRecord)
          && item.visit?.status === 'checked-in'
        ));
        return (
          <div className="card border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              You already have an active visit{activeVisitRecord.dealer?.dealerName ? ` for ${activeVisitRecord.dealer.dealerName}` : ''}.
            </p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              Checked in {activeVisitRecord.checkInTime ? new Date(activeVisitRecord.checkInTime).toLocaleString() : 'at an unknown time'}.
              {activeVisitRecord.dailyVisit?.date && ` Planned for ${activeVisitRecord.dailyVisit.date}.`}
              {' '}Check out or resolve its review before starting another dealer.
            </p>
            {activeVisitRecord.checkOutReviewStatus === 'pending' ? (
              <p className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                Check-out evidence is waiting for an authorized Admin/ASM review. The visit cannot be checked out again.
                {activeVisitRecord.checkOutReviewReason && <span className="block text-xs mt-1">{activeVisitRecord.checkOutReviewReason}</span>}
              </p>
            ) : activeAssignment ? (
              <button type="button" className="btn-secondary mt-3" onClick={() => setActiveVisit(activeAssignment)}>
                Continue Active Visit
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary mt-3"
                disabled={resolvingReview === activeVisitRecord._id}
                onClick={checkOutUnlinkedActiveVisit}
              >
                {resolvingReview === activeVisitRecord._id ? 'Capturing GPS and checking out...' : 'Check Out Active Visit'}
              </button>
            )}
          </div>
        );
      })()}

      {!canManage && <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-800 dark:text-white">{progressText}</p>
          <p className="text-xs text-slate-500 mt-1">Check in and check out to complete a stop.</p>
        </div>
        <div className="h-2.5 w-full sm:w-56 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${visits.length ? completedCount / visits.length * 100 : 0}%` }} />
        </div>
      </div>}

      {/* Visit Cards */}
      {loading ? <PageLoader /> : visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FiMapPin className="text-5xl mb-3 opacity-30" />
          <p className="font-medium text-slate-500">No shops assigned for this date</p>
          {canManage && <p className="text-sm mt-1">Click "Assign Shops" to get started</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orderedVisits.map(v => {
            const status = statusOf(v);
            const verificationStatus = verificationOf(v);
            const isCurrent = currentPlanByStaff.get(refId(v.staff)) === v._id;
                const isOwnAssignment = refId(v.staff) === String(user?._id);
                const staffVisits = orderedVisits.filter(item => refId(item.staff) === refId(v.staff));
            const staffCompleted = staffVisits.filter(item => isCompleteStatus(statusOf(item), item)).length;
            const reviewPending = v.requiresReview || v.visit?.checkOutReviewStatus === 'pending';
            return (
            <div key={v._id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow">

              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FiMapPin className="text-blue-600" size={18} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Stop {v.sequence || '—'}</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
                    {statusLabel(status)}
                  </span>
                </div>
              </div>
              {verificationStatus !== 'pending' && verificationStatus !== 'in_progress' && (
                <div className="mb-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[verificationStatus] || STATUS_STYLES.pending}`}>
                    Verification: {statusLabel(verificationStatus)}
                  </span>
                </div>
              )}

              {/* Dealer Info */}
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-0.5">
                {v.dealer?.dealerName}
              </h3>
              <p className="text-xs text-slate-500 mb-1">{v.dealer?.area} · {v.dealer?.province}</p>
              <p className="text-xs text-slate-400">{v.dealer?.phone}</p>
              {approvedDealerCoordinates(v.dealer) ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900"
                  onClick={() => setActiveVisit({ ...v, showDealerMap: true })}
                >
                  <FiMapPin size={13} /> Open approved shop map
                </button>
              ) : (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Map unavailable: dealer GPS is missing or not approved.
                </p>
              )}

              {/* Staff (admin view) */}
              {canManage && v.staff && (
                <p className="text-xs text-blue-600 mt-2 font-medium">{v.staff.name} ({v.staff.role?.toUpperCase()})</p>
              )}
              <p className="text-xs text-slate-500 mt-1">Planned: {v.date}</p>
              <p className="text-xs text-slate-500 mt-2">{staffCompleted} of {staffVisits.length} dealers completed</p>
              {canManage && v.visit && (
                <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <p>Check-in: {v.visit.checkInTime ? new Date(v.visit.checkInTime).toLocaleString() : '—'} · GPS {Number.isFinite(v.visit.checkInLat) && Number.isFinite(v.visit.checkInLng) ? `${v.visit.checkInLat.toFixed(6)}, ${v.visit.checkInLng.toFixed(6)}` : '—'} · accuracy {Number.isFinite(v.visit.checkInAccuracyMeters) ? `${Math.round(v.visit.checkInAccuracyMeters)} m` : '—'} · distance {Number.isFinite(v.visit.locationDistanceMeters) ? `${Math.round(v.visit.locationDistanceMeters)} m` : '—'}</p>
                  <p>Check-out: {v.visit.checkOutTime ? new Date(v.visit.checkOutTime).toLocaleString() : 'Not checked out'} · GPS {Number.isFinite(v.visit.checkOutLat) && Number.isFinite(v.visit.checkOutLng) ? `${v.visit.checkOutLat.toFixed(6)}, ${v.visit.checkOutLng.toFixed(6)}` : '—'} · accuracy {Number.isFinite(v.visit.checkOutAccuracyMeters) ? `${Math.round(v.visit.checkOutAccuracyMeters)} m` : '—'} · distance {Number.isFinite(v.visit.checkOutDistanceMeters) ? `${Math.round(v.visit.checkOutDistanceMeters)} m` : '—'}</p>
                  <p>Duration: {Number.isFinite(v.visit.checkOutDurationSeconds) ? `${Math.floor(v.visit.checkOutDurationSeconds / 60)} min` : 'In progress'} · GPS validation failures: {v.gpsValidationFailures || 0}</p>
                  <p>Verification: {statusLabel(verificationStatus)}</p>
                  {v.failureReason && <p className="font-medium text-amber-700 dark:text-amber-300">Reason: {v.failureReason}</p>}
                </div>
              )}

              {/* Notes */}
              {v.notes && (
                <p className="text-xs text-slate-500 mt-2 italic bg-slate-50 dark:bg-slate-700 rounded-lg px-2 py-1">
                  "{v.notes}"
                </p>
              )}

              {reviewPending && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Checkout review required — next stop locked</p>
                  {v.visit?.checkOutReviewReason && (
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">{v.visit.checkOutReviewReason}</p>
                  )}
                  {v.visit?.checkOutAttempts?.length > 0 && (() => {
                    const attempt = v.visit.checkOutAttempts[v.visit.checkOutAttempts.length - 1];
                    return (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        Latest attempt: {new Date(attempt.attemptedAt).toLocaleString()} · GPS {attempt.latitude ?? 'unavailable'}, {attempt.longitude ?? 'unavailable'} · accuracy {attempt.accuracyMeters ?? 'unavailable'} m · distance {attempt.distanceMeters == null ? 'unavailable' : `${Math.round(attempt.distanceMeters)} m`}
                      </p>
                    );
                  })()}
                  {v.checkInAttempts?.length > 0 && (() => {
                    const attempt = v.checkInAttempts[v.checkInAttempts.length - 1];
                    return (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        Latest check-in attempt: {new Date(attempt.attemptedAt).toLocaleString()} · GPS {attempt.latitude ?? 'unavailable'}, {attempt.longitude ?? 'unavailable'} · accuracy {attempt.accuracyMeters ?? 'unavailable'} m · distance {attempt.distanceMeters == null ? 'unavailable' : `${Math.round(attempt.distanceMeters)} m`} · {attempt.result}
                        {attempt.reason && <span className="block text-amber-700 dark:text-amber-300">Reason: {attempt.reason}</span>}
                      </p>
                    );
                  })()}
                  {canResolveReviews && (
                    <div className="mt-3 space-y-2">
                      <label className="sr-only" htmlFor={`review-outcome-${v._id}`}>Resolution outcome</label>
                      <select
                        id={`review-outcome-${v._id}`}
                        value={reviewOutcomes[v._id] || 'suspicious'}
                        onChange={event => setReviewOutcomes(previous => ({ ...previous, [v._id]: event.target.value }))}
                        className="input text-xs"
                      >
                        <option value="suspicious">Resolve as Suspicious</option>
                        <option value="invalid">Resolve as Invalid</option>
                      </select>
                      <label className="sr-only" htmlFor={`review-reason-${v._id}`}>Required audit reason</label>
                      <textarea
                        aria-label="Review notes"
                        value={reviewNotes[v._id] || ''}
                        onChange={event => setReviewNotes(previous => ({ ...previous, [v._id]: event.target.value }))}
                        className="input text-xs"
                        rows={2}
                        maxLength={500}
                        placeholder="Review notes (required)"
                      />
                      <textarea
                        aria-label="Override reason"
                        id={`review-reason-${v._id}`}
                        value={reviewReasons[v._id] || ''}
                        onChange={event => setReviewReasons(previous => ({ ...previous, [v._id]: event.target.value }))}
                        className="input text-xs"
                        rows={2}
                        maxLength={500}
                        placeholder="Required override reason (10-500 characters)"
                      />
                      <button
                        type="button"
                        onClick={() => handleResolveReview(v)}
                        disabled={resolvingReview === v._id}
                        className="btn-primary w-full justify-center text-xs"
                      >
                        {resolvingReview === v._id ? 'Saving audited resolution...' : 'Resolve Review & Unlock Next Stop'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                {isEmployee && isOwnAssignment && status === 'pending' && (
                  <button
                    onClick={() => setActiveVisit(v)}
                    disabled={!isCurrent || !isEmployee}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg bg-blue-50 text-blue-700 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
                  >
                    {isCurrent ? 'Open Next Shop →' : <><FiLock size={12} /> Previous Stop Required</>}
                  </button>
                )}
                {isEmployee && isOwnAssignment && status === 'in_progress' && (
                  <button onClick={() => setActiveVisit(v)} className="flex-1 btn-primary justify-center text-xs">
                    Continue Visit →
                  </button>
                )}
                {canManage && status === 'pending' && (
                  <button onClick={() => handleDelete(v._id)} disabled={deleting === v._id}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                    <FiTrash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );})}
        </div>
      )}

      <AssignModal
        open={modal}
        onClose={() => setModal(false)}
        onSaved={() => { setModal(false); load(); }}
        staffList={staffList}
        dealerList={dealerList}
      />
    </div>
  );
}
