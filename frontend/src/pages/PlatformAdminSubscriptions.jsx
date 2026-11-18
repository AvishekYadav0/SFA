import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, Eye, PauseCircle, PlayCircle, RefreshCw, Search } from 'lucide-react';
import { platformAdminApi } from '../services/platformAdminApi';

function dateLabel(date) {
  return date ? new Date(date).toLocaleDateString() : '—';
}

export default function PlatformAdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [actionId, setActionId] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await platformAdminApi.getSubscriptions();
      setSubscriptions(Array.isArray(data.data) ? data.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load subscriptions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSubscription = async (item) => {
    const nextStatus = item.status === 'active' ? 'suspended' : 'active';
    const verb = nextStatus === 'active' ? 'activate' : 'deactivate';
    if (!window.confirm(`${verb === 'activate' ? 'Activate' : 'Deactivate'} the ${item.planName || item.planCode} plan for ${item.company?.name || 'this company'}?`)) return;
    setActionId(item._id);
    setActionMessage('');
    setActionError('');
    try {
      await platformAdminApi.updateSubscriptionStatus(item._id, nextStatus);
      setActionMessage(`Subscription ${nextStatus === 'active' ? 'activated' : 'deactivated'} for ${item.company?.name || 'company'}.`);
      await load();
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Unable to update subscription status.');
    } finally {
      setActionId('');
    }
  };

  const filtered = useMemo(() => subscriptions.filter((item) => {
    const company = item.company?.name || '';
    const matchesText = `${company} ${item.planName || ''} ${item.planCode || ''} ${item.status || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (status === 'all' || item.status === status);
  }), [search, status, subscriptions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Platform</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Subscription Management</h1>
          <p className="mt-1 text-sm text-slate-500">Showing {filtered.length} of {subscriptions.length} database subscriptions.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, plan, or status" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-500" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          <option value="all">All statuses</option>
          {['active', 'expired', 'suspended', 'pending', 'past_due', 'cancelled'].map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
        </select>
      </div>

      {actionMessage && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{actionMessage}</div>}
      {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5" />{error}</div>
          <button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium hover:bg-red-100"><RefreshCw className="h-4 w-4" /> Retry</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr>
                {['Company', 'Plan', 'Start Date', 'Expiry Date', 'Days Remaining', 'Status', 'Payment', 'Action'].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>)}
              </tr></thead>
              <tbody>
                {loading ? <tr><td className="px-4 py-10 text-center text-slate-500" colSpan="8">Loading subscriptions...</td></tr>
                  : filtered.length ? filtered.map((item) => (
                    <tr key={item._id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{item.company?.name || 'Company unavailable'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.planName || item.planCode || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{dateLabel(item.startDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{dateLabel(item.expiryDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.expiryDate ? item.daysRemaining : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.status === 'active' ? 'bg-green-100 text-green-700' : item.status === 'expired' ? 'bg-red-100 text-red-700' : item.status === 'suspended' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>{item.status}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.paymentStatus || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.company?._id && <Link to={`/platform-admin/companies/${item.company._id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" /> Details</Link>}
                          {item.status === 'active' ? (
                            <button type="button" disabled={actionId === item._id} onClick={() => toggleSubscription(item)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><PauseCircle className="h-3.5 w-3.5" />Deactivate</button>
                          ) : item.status === 'suspended' && item.paymentStatus === 'paid' && item.expiryDate && new Date(item.expiryDate) > new Date() ? (
                            <button type="button" disabled={actionId === item._id} onClick={() => toggleSubscription(item)} className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-white px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"><PlayCircle className="h-3.5 w-3.5" />Activate</button>
                          ) : (
                            <Link to="/platform-admin/payments" className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100">{item.status === 'expired' ? 'Record renewal' : 'Verify payment'}</Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td className="px-4 py-12 text-center" colSpan="8">
                      <CalendarClock className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 font-medium text-slate-700">{subscriptions.length ? 'No subscriptions match these filters.' : 'No subscriptions are recorded in the database.'}</p>
                      <p className="mt-1 text-sm text-slate-500">{subscriptions.length ? 'Try another search or status.' : 'Open a company record to review or assign its subscription.'}</p>
                    </td></tr>
                  )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
