import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dailyVisitService, userService, dealerService } from '../services';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/common/Spinner';
import { FiMapPin, FiPlus, FiTrash2, FiCheck, FiX, FiClock, FiCalendar, FiUser, FiArrowLeft, FiPhone, FiShoppingCart, FiSlash } from 'react-icons/fi';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
  assigned: 'bg-amber-100 text-amber-700',
  visited:  'bg-green-100 text-green-700',
  skipped:  'bg-red-100 text-red-700',
};

const today = () => new Date().toISOString().split('T')[0];

/* ── Admin: Assign Modal ─────────────────────────────── */
function AssignModal({ open, onClose, onSaved, staffList, dealerList }) {
  const [date, setDate]             = useState(today());
  const [staffId, setStaffId]       = useState('');
  const [selected, setSelected]     = useState([]);
  const [search, setSearch]         = useState('');
  const [saving, setSaving]         = useState(false);

  if (!open) return null;

  const filtered = dealerList.filter(d =>
    d.dealerName.toLowerCase().includes(search.toLowerCase()) ||
    d.area?.toLowerCase().includes(search.toLowerCase())
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
              <select value={staffId} onChange={e => setStaffId(e.target.value)} className="input text-sm">
                <option value="">Select staff...</option>
                {staffList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label text-xs">Select Dealers ({selected.length} selected)</label>
            <input
              type="text" placeholder="Search dealer or area..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="input text-sm mb-2"
            />
            <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-y-auto max-h-52">
              {filtered.length === 0 ? (
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
function VisitDetail({ visit, onBack, onDone }) {
  const navigate = useNavigate();
  const [notes, setNotes]   = useState(visit.notes || '');
  const [saving, setSaving] = useState(false);
  const d = visit.dealer;

  const handleNo = async () => {
    setSaving(true);
    try {
      await dailyVisitService.updateStatus(visit._id, { visitStatus: 'visited', notes: notes || 'No order needed' });
      toast.success('Visit saved — no order');
      onDone();
    } catch { toast.error('Error saving visit'); }
    finally { setSaving(false); }
  };

  const handleYes = async () => {
    // mark visited first, then go to order creation pre-filled with dealer
    try {
      await dailyVisitService.updateStatus(visit._id, { visitStatus: 'visited', notes: notes || 'Order created' });
    } catch {}
    // navigate to orders page with dealer pre-filled via query param
    navigate(`/orders?dealer=${d?._id}&province=${encodeURIComponent(d?.province || '')}&area=${encodeURIComponent(d?.area || '')}&newOrder=1`);
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
      </div>

      {/* Question */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <p className="text-base font-bold text-slate-800 dark:text-white mb-1">Does the customer need products today?</p>
        <p className="text-xs text-slate-400 mb-4">Select YES to create an order, or NO to save the visit without an order.</p>

        <div>
          <label className="label text-xs">Visit Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Customer was busy, will order next week..."
            className="input text-sm mb-4"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleYes}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-green-50 border-2 border-green-200 hover:bg-green-100 hover:border-green-400 transition-all group">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FiShoppingCart className="text-white text-xl" />
            </div>
            <span className="font-bold text-green-700 text-sm">YES</span>
            <span className="text-xs text-green-600">Create Order</span>
          </button>

          <button
            onClick={handleNo}
            disabled={saving}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-red-50 border-2 border-red-200 hover:bg-red-100 hover:border-red-400 transition-all group">
            <div className="w-12 h-12 bg-red-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FiSlash className="text-white text-xl" />
            </div>
            <span className="font-bold text-red-600 text-sm">NO</span>
            <span className="text-xs text-red-500">{saving ? 'Saving...' : 'Save Visit'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────── */
export default function DailyVisits() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [visits, setVisits]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [date, setDate]           = useState(today());
  const [staffFilter, setStaffFilter] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [dealerList, setDealerList] = useState([]);
  const [modal, setModal]         = useState(false);
  const [deleting, setDeleting]   = useState(null);
  const [activeVisit, setActiveVisit] = useState(null); // visit detail view

  const load = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const res = await dailyVisitService.getAll({ date, staff: staffFilter || undefined });
        setVisits(res.data.data);
      } else {
        const res = await dailyVisitService.getMine(date);
        setVisits(res.data.data);
      }
    } catch { toast.error('Failed to load visits'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (isAdmin) {
      userService.getAll().then(r => setStaffList((r.data.data || []).filter(u => u.role === 'staff')));
      dealerService.getAll({ limit: 500 }).then(r => setDealerList(r.data.data || []));
    }
  }, [date, staffFilter]);

  const handleStatus = async (id, visitStatus) => {
    try {
      await dailyVisitService.updateStatus(id, { visitStatus });
      toast.success(`Marked as ${visitStatus}`);
      load();
    } catch { toast.error('Error updating status'); }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await dailyVisitService.remove(id);
      toast.success('Removed');
      load();
    } catch { toast.error('Error removing'); }
    finally { setDeleting(null); }
  };

  const stats = {
    total:   visits.length,
    visited: visits.filter(v => v.visitStatus === 'visited').length,
    pending: visits.filter(v => v.visitStatus === 'assigned').length,
    skipped: visits.filter(v => v.visitStatus === 'skipped').length,
  };

  // show visit detail screen
  if (activeVisit) return (
    <VisitDetail
      visit={activeVisit}
      onBack={() => setActiveVisit(null)}
      onDone={() => { setActiveVisit(null); load(); }}
    />
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isAdmin ? "Today's Shop Assignments" : "My Assigned Shops"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin ? 'Assign dealers to staff for daily visits' : 'Your shops to visit today'}
          </p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setModal(true)}>
            <FiPlus /> Assign Shops
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
          <FiCalendar className="text-slate-400" size={14} />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="text-sm bg-transparent outline-none text-slate-700 dark:text-slate-200" />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
            <FiUser className="text-slate-400" size={14} />
            <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
              className="text-sm bg-transparent outline-none text-slate-700 dark:text-slate-200">
              <option value="">All Staff</option>
              {staffList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Assigned', value: stats.total,   color: 'text-slate-700', bg: 'bg-slate-50 dark:bg-slate-800' },
          { label: 'Visited',        value: stats.visited, color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Pending',        value: stats.pending, color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Skipped',        value: stats.skipped, color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-slate-100 dark:border-slate-700`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Visit Cards */}
      {loading ? <PageLoader /> : visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FiMapPin className="text-5xl mb-3 opacity-30" />
          <p className="font-medium text-slate-500">No shops assigned for this date</p>
          {isAdmin && <p className="text-sm mt-1">Click "Assign Shops" to get started</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visits.map(v => (
            <div key={v._id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => !isAdmin && v.visitStatus === 'assigned' && setActiveVisit(v)}>

              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FiMapPin className="text-blue-600" size={18} />
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[v.visitStatus]}`}>
                  {v.visitStatus.charAt(0).toUpperCase() + v.visitStatus.slice(1)}
                </span>
              </div>

              {/* Dealer Info */}
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-0.5">
                {v.dealer?.dealerName}
              </h3>
              <p className="text-xs text-slate-500 mb-1">{v.dealer?.area} · {v.dealer?.province}</p>
              <p className="text-xs text-slate-400">{v.dealer?.phone}</p>

              {/* Staff (admin view) */}
              {isAdmin && v.staff && (
                <p className="text-xs text-blue-600 mt-2 font-medium">👤 {v.staff.name}</p>
              )}

              {/* Notes */}
              {v.notes && (
                <p className="text-xs text-slate-500 mt-2 italic bg-slate-50 dark:bg-slate-700 rounded-lg px-2 py-1">
                  "{v.notes}"
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                {v.visitStatus === 'assigned' && (
                  <>
                    {!isAdmin ? (
                      <button onClick={e => { e.stopPropagation(); setActiveVisit(v); }}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                        Visit Shop →
                      </button>
                    ) : (
                      <>
                        <button onClick={() => handleStatus(v._id, 'visited')}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                          <FiCheck size={12} /> Visited
                        </button>
                        <button onClick={() => handleStatus(v._id, 'skipped')}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                          <FiX size={12} /> Skip
                        </button>
                      </>
                    )}
                  </>
                )}
                {v.visitStatus === 'visited' && (
                  <span className="flex-1 text-center text-xs text-green-600 font-medium py-1.5">
                    ✓ Visit completed
                  </span>
                )}
                {v.visitStatus === 'skipped' && (
                  <button onClick={() => handleStatus(v._id, 'assigned')}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                    <FiClock size={12} /> Re-assign
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => handleDelete(v._id)} disabled={deleting === v._id}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                    <FiTrash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
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
