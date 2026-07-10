import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services';
import toast from 'react-hot-toast';
import {
  FiTrendingUp, FiUser, FiMail, FiLock, FiPhone, FiEye, FiEyeOff, FiBriefcase
} from 'react-icons/fi';
import { Spinner } from '../components/common/Spinner';

export default function AdminRegister() {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const { register: registerAdmin, login } = useAuth();
  // registerAdmin calls authService.registerAdmin via context
  const navigate = useNavigate();
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checking, setChecking]       = useState(true);
  const [adminExists, setAdminExists] = useState(false);

  useEffect(() => {
    authService.checkAdmin()
      .then(res => setAdminExists(res.data.adminExists))
      .finally(() => setChecking(false));
  }, []);

  const onSubmit = async (data) => {
    try {
      await registerAdmin(data);
      await login(data.email, data.password, 'admin');
      toast.success(`Welcome, ${data.name}! Your admin account is ready.`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (adminExists) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-10 border border-white/20 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiTrendingUp className="text-yellow-300 text-3xl" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Admin Already Exists</h2>
          <p className="text-blue-200 text-sm mb-6">
            An admin account has already been created. Please sign in to continue.
          </p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full justify-center py-3">
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl mb-4">
            <FiTrendingUp className="text-white text-3xl" />
          </div>
          <h1 className="text-3xl font-bold text-white">SFA System</h1>
          <p className="text-blue-200 mt-1">Create your admin account to get started</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-1">Admin Sign Up</h2>
          <p className="text-blue-200 text-sm mb-6">Fill in your details below</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Name + Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-100 mb-1.5">
                  Your Full Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register('name', { required: 'Please enter your full name' })}
                    placeholder="e.g. John Doe"
                    className="input pl-10 bg-white/90"
                    autoComplete="name"
                  />
                </div>
                {errors.name && <p className="text-red-300 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-100 mb-1.5">
                  Company Name
                </label>
                <div className="relative">
                  <FiBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register('companyName')}
                    placeholder="e.g. ABC Traders Pvt. Ltd."
                    className="input pl-10 bg-white/90"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-blue-100 mb-1.5">
                Email Address <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('email', {
                    required: 'Please enter your email address',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email address' },
                  })}
                  type="email"
                  placeholder="e.g. john@yourcompany.com"
                  className="input pl-10 bg-white/90"
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="text-red-300 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-blue-100 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  {...register('phone')}
                  placeholder="e.g. 9800000000"
                  className="input pl-10 bg-white/90"
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Password + Confirm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-100 mb-1.5">
                  Create Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register('password', {
                      required: 'Please create a password',
                      minLength: { value: 8, message: 'Password must be at least 8 characters' },
                    })}
                    type={showPass ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    className="input pl-10 pr-10 bg-white/90"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {errors.password && <p className="text-red-300 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-100 mb-1.5">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: v => v === watch('password') || 'Passwords do not match',
                    })}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Re-enter your password"
                    className="input pl-10 pr-10 bg-white/90"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirm ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-red-300 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <button type="submit" disabled={isSubmitting}
              className="btn-primary w-full justify-center py-3 mt-2 text-base">
              {isSubmitting
                ? <><Spinner size="sm" /><span className="ml-2">Creating account...</span></>
                : 'Create My Admin Account'}
            </button>
          </form>

          <p className="text-center text-blue-200 text-sm mt-5">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')}
              className="text-white font-semibold underline underline-offset-2">
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
