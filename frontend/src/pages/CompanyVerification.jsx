import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiLock, FiMail, FiShield } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { authService } from '../services';

export default function CompanyVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem('companyVerificationToken');
    sessionStorage.removeItem('verifiedCompany');
  }, []);

  const submit = async event => {
    event.preventDefault();
    setVerifying(true);
    try {
      const response = await authService.verifyCompany({ email: email.trim().toLowerCase(), password });
      const { companyVerificationToken, data } = response.data;
      sessionStorage.setItem('companyVerificationToken', companyVerificationToken);
      sessionStorage.setItem('verifiedCompany', JSON.stringify(data));
      toast.success(`Company verified: ${data.name}`);
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Company verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="auth-page auth-page--company-verification min-h-screen bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="auth-brand-mark inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4">
            <img src="/icons/Screenshot%202026-10-30%20at%209.53.11%20PM.png" alt="SFA logo" className="auth-brand-logo" />
          </div>
          <h1 className="text-3xl font-bold text-white">Company Verification</h1>
          <p className="text-blue-200 mt-2">Verify your company account to continue to SFA.</p>
        </div>
        <form onSubmit={submit} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/20 shadow-2xl space-y-5">
          <label className="block text-sm font-medium text-blue-100">
            Company Email
            <span className="relative block mt-1.5">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required type="email" autoComplete="username" value={email}
                onChange={event => setEmail(event.target.value)}
                className="input pl-10 bg-white/90" placeholder="admin@company.com" />
            </span>
          </label>
          <label className="block text-sm font-medium text-blue-100">
            Company Password
            <span className="relative block mt-1.5">
              <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required type="password" autoComplete="current-password" value={password}
                onChange={event => setPassword(event.target.value)}
                className="input pl-10 bg-white/90" placeholder="Company administrator password" />
            </span>
          </label>
          <button type="submit" disabled={verifying} className="btn-primary w-full justify-center py-3">
            <FiShield />
            {verifying ? 'Verifying...' : 'Verify Company & Continue'}
          </button>
          <p className="text-center text-sm text-blue-200">
            New company?{' '}
            <button type="button" className="underline text-white" onClick={() => navigate('/company-register')}>Register Your Company</button>
          </p>
        </form>
      </div>
    </div>
  );
}
