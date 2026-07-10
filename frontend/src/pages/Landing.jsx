import { useNavigate } from 'react-router-dom';
import { FiTrendingUp, FiUserPlus, FiLogIn } from 'react-icons/fi';
import { authService } from '../services';
import toast from 'react-hot-toast';

export default function Landing() {
  const navigate = useNavigate();

  const handleSignUp = async () => {
    try {
      const res = await authService.checkAdmin();
      if (res.data.adminExists) {
        toast.error('An admin account already exists. Please sign in.');
      } else {
        navigate('/admin-register');
      }
    } catch {
      navigate('/admin-register');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl mb-5">
            <FiTrendingUp className="text-white text-4xl" />
          </div>
          <h1 className="text-4xl font-bold text-white">SFA System</h1>
          <p className="text-blue-200 mt-2 text-base">Sales Force Automation Platform</p>
        </div>

        {/* Cards */}
        <div className="space-y-4">

          {/* Sign Up */}
          <button
            onClick={handleSignUp}
            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-left transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-400 transition-colors">
                <FiUserPlus className="text-white text-xl" />
              </div>
              <div>
                <p className="text-white font-semibold text-lg">Create Admin Account</p>
                <p className="text-blue-200 text-sm mt-0.5">New here? Set up your admin profile first</p>
              </div>
            </div>
          </button>

          {/* Sign In */}
          <button
            onClick={() => navigate('/login')}
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
          Staff accounts are created by the Admin · Only one admin allowed
        </p>
      </div>
    </div>
  );
}
