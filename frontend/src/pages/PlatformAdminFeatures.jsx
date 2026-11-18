import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { platformAdminApi } from '../services/platformAdminApi';

export default function PlatformAdminFeatures() {
  const [companies, setCompanies] = useState([]);
  const [features, setFeatures] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [companiesResponse, featuresResponse] = await Promise.all([
        platformAdminApi.getCompanies(),
        platformAdminApi.getFeatureCatalog(),
      ]);
      const rows = Array.isArray(companiesResponse.data.data) ? companiesResponse.data.data : [];
      const catalog = Array.isArray(featuresResponse.data.data) ? featuresResponse.data.data : [];
      setCompanies(rows);
      setFeatures(catalog);
      setDrafts(Object.fromEntries(rows.map((company) => [
        company._id,
        Array.isArray(company.assignedFeatures) ? company.assignedFeatures : [],
      ])));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load company feature permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (companyId, featureKey) => {
    setDrafts((current) => {
      const selected = current[companyId] || [];
      const next = selected.includes(featureKey)
        ? selected.filter((feature) => feature !== featureKey)
        : [...selected, featureKey];
      return { ...current, [companyId]: next };
    });
  };

  const save = async (company) => {
    const assigned = drafts[company._id] || [];
    if (!window.confirm(`Save ${assigned.length} enabled modules for ${company.name}?`)) return;
    setSavingId(company._id);
    setError('');
    setMessage('');
    try {
      await platformAdminApi.updateFeatures(company._id, { features: assigned });
      setMessage(`Feature permissions saved for ${company.name}.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Unable to save permissions for ${company.name}.`);
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Platform</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Feature Management</h1>
          <p className="mt-1 text-sm text-slate-500">The module list is loaded from the backend SFA feature catalog.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {message && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</div><button type="button" onClick={load} className="mt-2 font-semibold underline">Retry</button></div>}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading companies and module permissions...</div>
      ) : companies.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No registered companies are available for feature management.</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {companies.map((company) => {
            const assigned = drafts[company._id] || [];
            return (
              <section key={company._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-slate-900">{company.name}</h2>
                    <p className="text-sm text-slate-500">{company.subscriptionPlan || 'Unassigned'} plan · {company.email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"><ShieldCheck className="h-3.5 w-3.5" />{assigned.length}/{features.length} enabled</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {features.map((feature) => {
                    const enabled = assigned.includes(feature.key);
                    return (
                      <button key={feature.key} type="button" aria-pressed={enabled} onClick={() => toggle(company._id, feature.key)} className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${enabled ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                        <span>{feature.label}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium">{enabled ? <><Check className="h-3.5 w-3.5" />On</> : <><X className="h-3.5 w-3.5" />Off</>}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex justify-end">
                  <button type="button" disabled={savingId === company._id} onClick={() => save(company)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {savingId === company._id ? 'Saving permissions...' : 'Save permissions'}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
