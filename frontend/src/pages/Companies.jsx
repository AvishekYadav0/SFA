import { useState, useEffect } from 'react';
import { FiPlus, FiRefreshCw, FiBriefcase, FiMail, FiLock, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null); // 'add' | 'legacy'
  const [saving, setSaving]       = useState(false);
  const [addForm, setAddForm]     = useState({ companyName: '', adminEmail: '', tempPassword: '' });
  const [legacyForm, setLegacyForm] = useState({ companyName: '', adminEmail: '' });

  const load = () => {
    setLoading(true);
    api.get('/saas/companies')
      .then(r => setCompanies(r.data.data || []))
      .catch(() => toast.error('Failed to load companies'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/saas/companies', addForm);
      toast.success('Company added successfully!');
      setModal(null);
      setAddForm({ companyName: '', adminEmail: '', tempPassword: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add company');
    } finally { setSaving(false); }
  };

  const handleLegacy = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/saas/companies/onboard-legacy', legacyForm);
      toast.success('Legacy company onboarded successfully!');
      setModal(null);
      setLegacyForm({ companyName: '', adminEmail: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to onboard legacy company');
    } finally { setSaving(false); }
  };

  const toggleStatus = async (company) => {
    const newStatus = company.status === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/saas/companies/${company._id}/status`, { status: newStatus });
      toast.success(`Company ${newStatus}`);
      load();
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Companies</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage all registered companies and tenants.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModal('legacy')} className="btn-secondary text-sm flex items-center gap-1.5">
            <FiBriefcase className="text-xs" /> Onboard Existing
          </button>
          <button onClick={() => setModal('add')} className="btn-primary text-sm flex items-center gap-1.5">
            <FiPlus className="text-xs" /> Add Company
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-white text-xs">
                <th className="px-3 py-3 text-left">#</th>
                <th className="px-3 py-3 text-left">Company</th>
                <th className="px-3 py-3 text-left">Email</th>
                <th className="px-3 py-3 text-left">Tenant ID</th>
                <th className="px-3 py-3 text-left">Admin</th>
                <th className="px-3 py-3 text-left">Plan</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">Loading...</td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">No companies yet.</td></tr>
              ) : companies.map((c, i) => (
                <tr key={c._id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">{c.name}</td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{c.email}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{c.tenantId}</td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{c.adminUser?.name || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 capitalize">{c.plan}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {c.isLegacy
                      ? <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">Legacy</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">New</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toggleStatus(c)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white">
                      {c.status === 'active' ? <FiToggleRight className="text-green-500 text-xl" /> : <FiToggleLeft className="text-red-400 text-xl" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Company Modal */}
      {modal === 'add' && (
        <Modal title="Add New Company" onClose={() => setModal(null)}>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Company Name</label>
              <input required value={addForm.companyName} onChange={e => setAddForm(f => ({ ...f, companyName: e.target.value }))}
                className="input w-full" placeholder="Company name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Company Admin Email</label>
              <input required type="email" value={addForm.adminEmail} onChange={e => setAddForm(f => ({ ...f, adminEmail: e.target.value }))}
                className="input w-full" placeholder="admin@company.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Temporary Password</label>
              <input required type="text" value={addForm.tempPassword} onChange={e => setAddForm(f => ({ ...f, tempPassword: e.target.value }))}
                className="input w-full" placeholder="Temporary password (min 8 chars)" minLength={8} />
            </div>
            <p className="text-xs text-slate-400">The admin will be required to change their password on first login.</p>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Adding...' : 'Add Company'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Onboard Legacy Modal */}
      {modal === 'legacy' && (
        <Modal title="Onboard Existing Company" onClose={() => setModal(null)}>
          <form onSubmit={handleLegacy} className="space-y-4">
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-xs text-orange-700 dark:text-orange-300">
              This will safely assign a tenantId to an existing company admin without changing their password, ID or any existing data.
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Company Name</label>
              <input required value={legacyForm.companyName} onChange={e => setLegacyForm(f => ({ ...f, companyName: e.target.value }))}
                className="input w-full" placeholder="Company name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Existing Admin Email</label>
              <input required type="email" value={legacyForm.adminEmail} onChange={e => setLegacyForm(f => ({ ...f, adminEmail: e.target.value }))}
                className="input w-full" placeholder="Existing admin email" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Onboarding...' : 'Onboard Company'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
