import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Eye, RefreshCw, Search } from 'lucide-react';
import { platformAdminApi } from '../services/platformAdminApi';

function displayDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export default function PlatformAdminCompanies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await platformAdminApi.getCompanies();
      setCompanies(Array.isArray(data.data) ? data.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load companies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleCompanies = useMemo(() => companies.filter((company) => {
    const matchesSearch = `${company.name || ''} ${company.email || ''} ${company.tenantId || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === 'all' || company.planCode === planFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'expired' ? company.subscriptionStatus === 'expired' : company.companyStatus === statusFilter);
    return matchesSearch && matchesPlan && matchesStatus;
  }), [companies, planFilter, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Platform</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Company Management</h1>
          <p className="mt-1 text-sm text-slate-500">{companies.length} registered companies</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, email, or tenant" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-500" />
        </div>
        <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          <option value="all">All plans</option><option value="BASIC">Basic</option><option value="PRO">Pro</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          <option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="pending">Pending</option><option value="expired">Expired subscription</option>
        </select>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5" />{error}</div>
          <button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium hover:bg-red-100"><RefreshCw className="h-4 w-4" /> Retry</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {['Company', 'Email', 'Tenant ID', 'Registered', 'Plan', 'Status', 'Users', 'Expiry', ''].map((heading) => <th key={heading || 'actions'} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-10 text-center text-slate-500" colSpan="9">Loading companies...</td></tr>
                ) : visibleCompanies.length ? visibleCompanies.map((company) => (
                  <tr key={company._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{company.name || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{company.email || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{company.tenantId || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{displayDate(company.registeredAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{company.subscriptionPlan || 'Unassigned'}</td>
                    <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${company.companyStatus === 'active' ? 'bg-green-100 text-green-700' : company.companyStatus === 'suspended' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'}`}>{company.companyStatus || 'unknown'}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{company.registeredUsers ?? 0} / {company.maxUsers ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{company.licenseExpiry ? `${company.daysRemaining} days` : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/platform-admin/companies/${company._id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        <Eye className="h-3.5 w-3.5" /> Details
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr><td className="px-4 py-10 text-center text-slate-500" colSpan="9">{companies.length ? 'No companies match these filters.' : 'No registered companies found.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
