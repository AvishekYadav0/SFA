import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services';
import toast from 'react-hot-toast';
import {
  FiTrendingUp, FiMail, FiLock, FiEye, FiEyeOff, FiShield, FiUsers, FiUser
} from 'react-icons/fi';
import { Spinner } from '../components/common/Spinner';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('admin');
  const [showPass, setShowPass] = useState(false);
  const [adminExists, setAdminExists] = useState(true);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    authService.checkAdmin()
      .then(res => setAdminExists(res.data.adminExists))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const onSubmit = async (data) => {
    try {
      const userData = await login(data.email, data.password, role);
      toast.success(`Welcome back, ${userData.name}! 👋`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect email or password. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl mb-3">
            <FiTrendingUp className="text-white text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">SFA System</h1>
          <p className="text-blue-200 mt-1 text-sm">Sales Force Automation</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 sm:p-8 border border-white/20 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-1">Welcome Back!</h2>
          <p className="text-blue-200 text-sm mb-5">Sign in to your account to continue</p>

          {/* Role Selector */}
          <div className="mb-5">
            <p className="text-xs font-medium text-blue-100 mb-2">I am signing in as</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { value: 'admin',  label: 'Admin',  icon: FiShield },
                { value: 'nsm',    label: 'NSM',    icon: FiShield },
                { value: 'rsm',    label: 'RSM',    icon: FiUsers },
                { value: 'asm',    label: 'ASM',    icon: FiUsers },
                { value: 'se',     label: 'SE',     icon: FiUser },
                { value: 'so',     label: 'SO',     icon: FiUser },
                { value: 'dealer', label: 'Dealer', icon: FiUser },
              ].map(({ value, label, icon: Icon }) => (
                <label key={value}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 cursor-pointer transition-all ${
                    role === value
                      ? 'border-white bg-white/20 text-white'
                      : 'border-white/20 text-blue-200 hover:border-white/40'
                  }`}>
                  <input type="radio" name="role" value={value}
                    checked={role === value} onChange={() => setRole(value)}
                    className="sr-only" />
                  <Icon className="text-sm" />
                  <span className="font-medium text-[10px] leading-none">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-blue-100 mb-1.5">
                Your Email Address
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('email', {
                    required: 'Please enter your email address',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email address' },
                  })}
                  type="email"
                  placeholder="Enter your email address"
                  className="input pl-10 bg-white/90"
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="text-red-300 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-blue-100 mb-1.5">
                Your Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('password', { required: 'Please enter your password' })}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className="input pl-10 pr-10 bg-white/90"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {errors.password && <p className="text-red-300 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('remember')} className="w-4 h-4 rounded accent-blue-500" />
                <span className="text-sm text-blue-200">Keep me signed in</span>
              </label>
              <button type="button"
                onClick={() => toast('Please contact your admin to reset your password.', { icon: '🔑' })}
                className="text-sm text-blue-200 hover:text-white underline underline-offset-2">
                Forgot Password?
              </button>
            </div>

            <button type="submit" disabled={isSubmitting}
              className="btn-primary w-full justify-center py-3 mt-1 text-base">
              {isSubmitting
                ? <><Spinner size="sm" /><span className="ml-2">Signing in...</span></>
                : `Sign In as ${role.toUpperCase()}`}
            </button>
          </form>

          {/* Staff note */}
          {['se', 'so', 'dealer'].includes(role) && (
            <p className="text-center text-blue-300 text-xs mt-4">
              Don't have an account? Ask your Admin to create one for you.
            </p>
          )}

          {/* No admin yet */}
          {!adminExists && (
            <p className="text-center text-blue-200 text-sm mt-5">
              No admin account yet?{' '}
              <button onClick={() => navigate('/admin-register')}
                className="text-white font-semibold underline underline-offset-2">
                Create Admin Account
              </button>
            </p>
          )}

          {/* Back to home */}
          <p className="text-center text-blue-300 text-xs mt-4">
            <button onClick={() => navigate('/')}
              className="hover:text-white underline underline-offset-2 transition-colors">
              ← Back to Home
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
