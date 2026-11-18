import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, PauseCircle, PlayCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { platformAdminApi } from '../services/platformAdminApi';

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function PlatformAdminCompanyDetails() {
  const { companyId } = useParams();
  const [detail, setDetail] = useState(null);
  const [featureCatalog, setFeatureCatalog] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [editingPlan, setEditingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [companyResponse, featureResponse, plansResponse] = await Promise.all([
        platformAdminApi.getCompany(companyId),
        platformAdminApi.getFeatureCatalog(),
        platformAdminApi.getPlans(),
      ]);
      setDetail(companyResponse.data.data);
      setFeatureCatalog(Array.isArray(featureResponse.data.data) ? featureResponse.data.data : []);
      const availablePlans = Array.isArray(plansResponse.data.data) ? plansResponse.data.data : [];
      setPlans(availablePlans);
      setSelectedPlan(companyResponse.data.data?.subscription?.planCode || availablePlans[0]?.code || '');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load company details.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const savePlan = async () => {
    if (!selectedPlan || !window.confirm(`Assign the ${selectedPlan} plan to ${detail?.company?.name}?`)) return;
    setSavingPlan(true);
    setActionError('');
    setActionMessage('');
    try {
      await platformAdminApi.changePlan(companyId, { planCode: selectedPlan });
      setEditingPlan(false);
      await load();
      setActionMessage('Subscription plan updated. Existing expiry date was preserved.');
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Unable to update the company plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  const toggleSubscriptionStatus = async () => {
    if (!subscription?._id) return;
    const nextStatus = subscription.status === 'active' ? 'suspended' : 'active';
    const verb = nextStatus === 'active' ? 'activate' : 'deactivate';
    if (!window.confirm(`${verb === 'activate' ? 'Activate' : 'Deactivate'} subscription access for ${company.name}?`)) return;
    setSavingStatus(true);
    setActionError('');
    setActionMessage('');
    try {
      await platformAdminApi.updateSubscriptionStatus(subscription._id, nextStatus);
      await load();
      setActionMessage(`Subscription access ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`);
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Unable to update subscription status.');
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading company details...</div>;
  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
        <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5" />{error}</div>
        <button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium hover:bg-red-100"><RefreshCw className="h-4 w-4" /> Retry</button>
      </div>
    );
  }

  const company = detail?.company || {};
  const subscription = detail?.subscription;
  const users = detail?.users || [];
  const activeUsers = users.filter((user) => user.status === 'active').length;
  const assignedFeatures = new Set(subscription?.assignedFeatures || []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/platform-admin/companies" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"><ArrowLeft className="h-4 w-4" /> Companies</Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Company Details</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">{company.name || 'Company'}</h1>
          <p className="mt-1 text-sm text-slate-500">{company.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditingPlan(true)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{subscription ? 'Change plan' : 'Assign plan'}</button>
          <Link to="/platform-admin/features" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"><ShieldCheck className="h-4 w-4" /> Manage features</Link>
        </div>
      </div>

      {actionMessage && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{actionMessage}</div>}
      {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Company overview</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ['Company name', company.name],
              ['Email', company.email],
              ['Tenant ID', company.tenantId],
              ['Status', company.status],
              ['Registered', formatDate(company.createdAt)],
              ['Company plan', company.plan],
            ].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-900">{value || '—'}</dd></div>)}
          </dl>
        </section>

        {editingPlan && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
            <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
              <h2 className="text-lg font-semibold text-slate-900">{subscription ? 'Change subscription plan' : 'Assign subscription plan'}</h2>
              <p className="mt-1 text-sm text-slate-500">The current license expiry date will not be changed.</p>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Plan
                <select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5">
                  {plans.map((plan) => <option key={plan._id} value={plan.code}>{plan.name} ({plan.defaultDurationDays} days)</option>)}
                </select>
              </label>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" disabled={savingPlan} onClick={() => setEditingPlan(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">Cancel</button>
                <button type="button" disabled={savingPlan || !selectedPlan} onClick={savePlan} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{savingPlan ? 'Saving...' : 'Confirm plan'}</button>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Subscription</h2>
            {subscription?.status === 'active' ? (
              <button type="button" disabled={savingStatus} onClick={toggleSubscriptionStatus} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><PauseCircle className="h-4 w-4" />Deactivate plan</button>
            ) : subscription?.status === 'suspended' && subscription.paymentStatus === 'paid' && subscription.expiryDate && new Date(subscription.expiryDate) > new Date() ? (
              <button type="button" disabled={savingStatus} onClick={toggleSubscriptionStatus} className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"><PlayCircle className="h-4 w-4" />Activate plan</button>
            ) : subscription ? (
              <Link to="/platform-admin/payments" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100">{subscription.status === 'expired' ? 'Record renewal' : 'Verify payment'}</Link>
            ) : null}
          </div>
          {subscription ? (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ['Current plan', subscription.planName],
                ['Status', subscription.status],
                ['Start date', formatDate(subscription.startDate)],
                ['Expiry date', formatDate(subscription.expiryDate)],
                ['Days remaining', subscription.daysRemaining ?? (subscription.expiryDate ? Math.ceil((new Date(subscription.expiryDate) - Date.now()) / 86400000) : '—')],
                ['Payment status', subscription.paymentStatus],
                ['Maximum users', subscription.maxUsers],
                ['Maximum dealers', subscription.maxDealers],
              ].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 font-medium capitalize text-slate-900">{value ?? '—'}</dd></div>)}
            </dl>
          ) : <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">There is no subscription record for this company yet.</p>}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-slate-900">SFA module access</h2><p className="text-sm text-slate-500">{assignedFeatures.size} modules enabled</p></div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {featureCatalog.map((feature) => {
            const enabled = assignedFeatures.has(feature.key);
            return <div key={feature.key} className={`rounded-xl border px-3 py-2 text-sm ${enabled ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{feature.label}: <span className="font-semibold">{enabled ? 'On' : 'Off'}</span></div>;
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Company users ({users.length})</h2>
          <p className="mt-1 text-sm text-slate-500">{activeUsers} active users</p>
          <div className="mt-4 max-h-80 overflow-auto">
            {users.length ? <table className="min-w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="py-2 pr-3 font-medium">Name</th><th className="py-2 pr-3 font-medium">Email</th><th className="py-2 pr-3 font-medium">Role</th><th className="py-2 font-medium">Status</th></tr></thead><tbody>{users.map((user) => <tr key={user._id} className="border-t border-slate-100"><td className="py-2 pr-3 text-slate-900">{user.name || '—'}</td><td className="py-2 pr-3 text-slate-600">{user.email || '—'}</td><td className="py-2 pr-3 text-slate-600">{user.role || '—'}</td><td className="py-2 text-slate-600">{user.status || '—'}</td></tr>)}</tbody></table> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No company users were returned.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
          <div className="mt-4 space-y-3">
            {(detail?.auditLogs || []).length ? detail.auditLogs.map((entry) => (
              <article key={entry._id} className="rounded-xl bg-slate-50 p-3">
                <p className="font-medium text-slate-900">{entry.description || entry.action}</p>
                <p className="mt-1 text-xs text-slate-500">{entry.action} · {formatDate(entry.createdAt)}</p>
              </article>
            )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No audit activity recorded for this company.</p>}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Payment history ({detail?.payments?.length || 0})</h2>
        {(detail?.payments || []).length ? <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Amount</th><th className="px-3 py-2 font-medium">Reference</th><th className="px-3 py-2 font-medium">Status</th></tr></thead><tbody>{detail.payments.map((payment) => <tr key={payment._id} className="border-t border-slate-100"><td className="px-3 py-2">{formatDate(payment.createdAt)}</td><td className="px-3 py-2">{payment.currency || 'INR'} {payment.amount ?? 0}</td><td className="px-3 py-2">{payment.transactionReference || '—'}</td><td className="px-3 py-2">{payment.paymentStatus || '—'}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-slate-500">No payment records found.</p>}
      </section>
    </div>
  );
}
