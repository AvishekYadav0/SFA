import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services';
import toast from 'react-hot-toast';
import {
  FiTrendingUp, FiMail, FiLock, FiEye, FiEyeOff, FiShield, FiUsers
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl mb-4">
            <FiTrendingUp className="text-white text-3xl" />
          </div>
          <h1 className="text-3xl font-bold text-white">SFA System</h1>
          <p className="text-blue-200 mt-1">Sales Force Automation</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-1">Welcome Back!</h2>
          <p className="text-blue-200 text-sm mb-6">Sign in to your account to continue</p>

          {/* Role Selector */}
          <div className="mb-6">
            <p className="text-sm font-medium text-blue-100 mb-3">I am signing in as</p>
            <div className="flex gap-3">
              {[
                { value: 'admin', label: 'Admin', icon: FiShield },
                { value: 'staff', label: 'Staff Member', icon: FiUsers },
              ].map(({ value, label, icon: Icon }) => (
                <label key={value}
                  className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    role === value
                      ? 'border-white bg-white/20 text-white'
                      : 'border-white/20 text-blue-200 hover:border-white/40'
                  }`}>
                  <input type="radio" name="role" value={value}
                    checked={role === value} onChange={() => setRole(value)}
                    className="sr-only" />
                  <Icon className="text-base flex-shrink-0" />
                  <span className="font-medium text-sm">{label}</span>
                  <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    role === value ? 'border-white' : 'border-white/40'
                  }`}>
                    {role === value && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
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
                : `Sign In as ${role === 'admin' ? 'Admin' : 'Staff'}`}
            </button>
          </form>

          {/* Staff note */}
          {role === 'staff' && (
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
