import { useNavigate } from 'react-router-dom';
import { FiUserPlus, FiLogIn } from 'react-icons/fi';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="auth-page auth-page--landing min-h-screen bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="auth-brand-mark inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-5">
            <img src="/icons/Screenshot%202026-10-30%20at%209.53.11%20PM.png" alt="SFA logo" className="auth-brand-logo" />
          </div>
          <h1 className="text-4xl font-bold text-white">SFA System</h1>
          <p className="text-blue-200 mt-2 text-base">Sales Force Automation Platform</p>
        </div>

        {/* Cards */}
        <div className="space-y-4">

          {/* Company Registration */}
          <button
            onClick={() => navigate('/company-register')}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-left transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-400 transition-colors">
                <FiUserPlus className="text-white text-xl" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Register Your Company</p>
                <p className="text-blue-200 text-sm mt-0.5">Create a company workspace for your SFA team</p>
              </div>
            </div>
          </button>

          {/* Sign In */}
          <button
            onClick={() => {
              sessionStorage.removeItem('companyVerificationToken');
              sessionStorage.removeItem('verifiedCompany');
              navigate('/company-verification');
            }}
            className="w-full bg-white hover:bg-blue-50 rounded-2xl p-5 text-left transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-700 transition-colors">
                <FiLogIn className="text-white text-xl" />
              </div>
              <div>
                <p className="text-slate-900 font-semibold text-lg">Sign In</p>
                <p className="text-slate-500 text-sm mt-0.5">Welcome back — login to your account</p>
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-blue-300 text-xs mt-8">
          Staff accounts are created by admins · Up to 8 admin accounts allowed
        </p>
      </div>
    </div>
  );
}
