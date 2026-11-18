import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, Search, Users } from 'lucide-react';
import { platformAdminApi } from '../services/platformAdminApi';

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export default function PlatformAdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await platformAdminApi.getUsers();
      setUsers(Array.isArray(data.data) ? data.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load company users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const companies = useMemo(() => [...new Map(users.filter((user) => user.company?._id).map((user) => [user.company._id, user.company])).values()], [users]);
  const roles = useMemo(() => [...new Set(users.map((user) => user.role).filter(Boolean))].sort(), [users]);
  const filtered = users.filter((user) => {
    const companyName = user.company?.name || '';
    const searchMatch = `${user.name || ''} ${user.email || ''} ${companyName}`.toLowerCase().includes(search.toLowerCase());
    return searchMatch
      && (companyFilter === 'all' || user.company?._id === companyFilter)
      && (roleFilter === 'all' || user.role === roleFilter)
      && (statusFilter === 'all' || user.status === statusFilter);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Platform</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">Company users only; platform-admin accounts are stored separately.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200"><Users className="h-4 w-4" />{filtered.length} users</div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, company" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
        </div>
        <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"><option value="all">All companies</option>{companies.map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}</select>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"><option value="all">All roles</option>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-red-700 shadow-sm"><div className="flex items-center gap-2"><AlertCircle className="h-5 w-5" />{error}</div><button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium hover:bg-red-100"><RefreshCw className="h-4 w-4" />Retry</button></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr>{['User', 'Company', 'Role', 'Status', 'Registration Date', 'Last Login'].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td className="px-4 py-10 text-center text-slate-500" colSpan="6">Loading users...</td></tr> : filtered.length ? filtered.map((user) => (
              <tr key={`${user.company?._id}-${user._id}`} className="border-t border-slate-100">
                <td className="px-4 py-3"><p className="font-medium text-slate-900">{user.name || '—'}</p><p className="text-xs text-slate-500">{user.email || '—'}</p></td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{user.company?.name || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 uppercase text-slate-600">{user.role || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{user.status || 'unknown'}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(user.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(user.lastLogin)}</td>
              </tr>
            )) : <tr><td className="px-4 py-10 text-center text-slate-500" colSpan="6">{users.length ? 'No users match these filters.' : 'No company users were returned by the backend.'}</td></tr>}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
