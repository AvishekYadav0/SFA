import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { platformAdminApi } from '../services/platformAdminApi';

export default function PlatformAdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await platformAdminApi.login(form);
      localStorage.setItem('platformAdminToken', data.token);
      navigate('/platform-admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-blue-300">Platform Access</p>
          <h1 className="mt-3 text-3xl font-bold">Master Admin Login</h1>
          <p className="mt-2 text-sm text-slate-400">Signed-in platform admins only.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-blue-500"
              placeholder="platform-admin@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60">
            {loading ? 'Authenticating...' : 'Login to Platform'}
          </button>
        </form>
      </div>
    </div>
  );
}
