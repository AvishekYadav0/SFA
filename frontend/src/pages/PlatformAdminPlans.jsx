import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Edit3, RefreshCw, X } from 'lucide-react';
import { platformAdminApi } from '../services/platformAdminApi';

const emptyPlan = {
  description: '',
  price: 0,
  currency: 'INR',
  defaultDurationDays: 365,
  maxUsers: 10,
  maxDealers: 20,
  features: [],
  isActive: true,
};

export default function PlatformAdminPlans() {
  const [plans, setPlans] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingPlan, setEditingPlan] = useState(null);
  const [form, setForm] = useState(emptyPlan);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [plansResponse, featuresResponse] = await Promise.all([
        platformAdminApi.getPlans(),
        platformAdminApi.getFeatureCatalog(),
      ]);
      setPlans(Array.isArray(plansResponse.data.data) ? plansResponse.data.data : []);
      setFeatures(Array.isArray(featuresResponse.data.data) ? featuresResponse.data.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load subscription plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const edit = (plan) => {
    setMessage('');
    setEditingPlan(plan);
    setForm({
      description: plan.description || '',
      price: plan.price ?? 0,
      currency: plan.currency || 'INR',
      defaultDurationDays: plan.defaultDurationDays ?? 365,
      maxUsers: plan.maxUsers ?? 1,
      maxDealers: plan.maxDealers ?? 0,
      features: Array.isArray(plan.features) ? plan.features : [],
      isActive: plan.isActive !== false,
    });
  };

  const toggleFeature = (key) => {
    setForm((current) => ({
      ...current,
      features: current.features.includes(key)
        ? current.features.filter((feature) => feature !== key)
        : [...current.features, key],
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (!editingPlan) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await platformAdminApi.updatePlan(editingPlan._id, {
        ...form,
        price: Number(form.price),
        defaultDurationDays: Number(form.defaultDurationDays),
        maxUsers: Number(form.maxUsers),
        maxDealers: Number(form.maxDealers),
      });
      setEditingPlan(null);
      setMessage(`${editingPlan.name} plan saved.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save plan changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Platform</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Subscription Plans</h1>
          <p className="mt-1 text-sm text-slate-500">Basic and Pro plans, loaded from the platform database.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {message && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</div><button type="button" onClick={load} className="mt-2 font-semibold underline">Retry</button></div>}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading plans...</div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No Basic or Pro plans were returned by the backend.</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {plans.map((plan) => (
            <section key={plan._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">{plan.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{plan.description || 'No plan description.'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{plan.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-slate-500">Price</p><p className="mt-1 font-semibold text-slate-900">{plan.currency || 'INR'} {Number(plan.price || 0).toLocaleString()}</p></div>
                <div><p className="text-slate-500">Duration</p><p className="mt-1 font-semibold text-slate-900">{plan.defaultDurationDays} days</p></div>
                <div><p className="text-slate-500">Maximum users</p><p className="mt-1 font-semibold text-slate-900">{plan.maxUsers}</p></div>
                <div><p className="text-slate-500">Maximum dealers</p><p className="mt-1 font-semibold text-slate-900">{plan.maxDealers}</p></div>
              </div>
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned modules ({plan.features?.length || 0})</p>
                {plan.features?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {plan.features.map((key) => <span key={key} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{features.find((feature) => feature.key === key)?.label || key}</span>)}
                  </div>
                ) : <p className="text-sm text-slate-500">No modules are currently assigned.</p>}
              </div>
              <button type="button" onClick={() => edit(plan)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"><Edit3 className="h-4 w-4" /> Edit {plan.name} Plan</button>
            </section>
          ))}
        </div>
      )}

      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditingPlan(null); }}>
          <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-xl font-semibold text-slate-900">Edit {editingPlan.name} plan</h2><p className="text-sm text-slate-500">Changes are saved to the platform database.</p></div>
              <button type="button" disabled={saving} onClick={() => setEditingPlan(null)} aria-label="Close editor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={save} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium text-slate-700">Description</span><textarea rows="2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></label>
                <label><span className="mb-1 block text-sm font-medium text-slate-700">Price</span><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></label>
                <label><span className="mb-1 block text-sm font-medium text-slate-700">Currency</span><input required maxLength="3" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></label>
                <label><span className="mb-1 block text-sm font-medium text-slate-700">Default duration (days)</span><input type="number" min="1" required value={form.defaultDurationDays} onChange={(event) => setForm({ ...form, defaultDurationDays: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></label>
                <label><span className="mb-1 block text-sm font-medium text-slate-700">Maximum users</span><input type="number" min="1" required value={form.maxUsers} onChange={(event) => setForm({ ...form, maxUsers: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></label>
                <label><span className="mb-1 block text-sm font-medium text-slate-700">Maximum dealers</span><input type="number" min="0" required value={form.maxDealers} onChange={(event) => setForm({ ...form, maxDealers: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" /></label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600" /> Active for new subscriptions</label>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-slate-800">Available SFA modules</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {features.map((feature) => {
                    const checked = form.features.includes(feature.key);
                    return (
                      <label key={feature.key} className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm ${checked ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-600'}`}>
                        <span>{feature.label}</span>
                        <input type="checkbox" checked={checked} onChange={() => toggleFeature(feature.key)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" disabled={saving} onClick={() => setEditingPlan(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"><Check className="h-4 w-4" />{saving ? 'Saving...' : 'Save plan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
