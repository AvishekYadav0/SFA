import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiBriefcase, FiLock, FiMail } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { authService } from '../services';

export default function CompanyRegister() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ companyName: '', email: '', password: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const submit = async event => {
    event.preventDefault();
    const companyName = form.companyName.trim();
    const email = form.email.trim().toLowerCase();
    if (!companyName || !email || !form.password) return toast.error('Complete all fields.');
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters.');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match.');

    setSaving(true);
    try {
      await authService.registerCompany({
        companyName,
        email,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      toast.success('Company registered. Verify your company to continue.');
      navigate('/company-verification', { replace: true, state: { email, from: location.pathname } });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Company registration failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-page auth-page--company-register min-h-screen bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="auth-brand-mark inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4">
            <img src="/icons/Screenshot%202026-10-30%20at%209.53.11%20PM.png" alt="SFA logo" className="auth-brand-logo" />
          </div>
          <h1 className="text-3xl font-bold text-white">SFA System</h1>
          <p className="text-blue-200 mt-1">Register Your Company</p>
        </div>
        <form onSubmit={submit} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/20 shadow-2xl space-y-4">
          <label className="block text-sm font-medium text-blue-100">
            Company Name
            <span className="relative block mt-1.5">
              <FiBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required maxLength={120} autoComplete="organization" value={form.companyName}
                onChange={event => set('companyName', event.target.value)}
                className="input pl-10 bg-white/90" placeholder="Your company name" />
            </span>
          </label>
          <label className="block text-sm font-medium text-blue-100">
            Company Email
            <span className="relative block mt-1.5">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required type="email" autoComplete="email" value={form.email}
                onChange={event => set('email', event.target.value)}
                className="input pl-10 bg-white/90" placeholder="admin@company.com" />
            </span>
          </label>
          <label className="block text-sm font-medium text-blue-100">
            Password
            <span className="relative block mt-1.5">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required minLength={8} type="password" autoComplete="new-password" value={form.password}
                onChange={event => set('password', event.target.value)}
                className="input pl-10 bg-white/90" placeholder="At least 8 characters" />
            </span>
          </label>
          <label className="block text-sm font-medium text-blue-100">
            Confirm Password
            <span className="relative block mt-1.5">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required type="password" autoComplete="new-password" value={form.confirmPassword}
                onChange={event => set('confirmPassword', event.target.value)}
                className="input pl-10 bg-white/90" placeholder="Re-enter your password" />
            </span>
          </label>
          <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-3">
            {saving ? 'Registering...' : 'Register Your Company'}
          </button>
          <p className="text-center text-sm text-blue-200">
            Already registered?{' '}
            <button type="button" className="underline text-white" onClick={() => navigate('/company-verification')}>Verify your company</button>
          </p>
        </form>
      </div>
    </div>
  );
}
