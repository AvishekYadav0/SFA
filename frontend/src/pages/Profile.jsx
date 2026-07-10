import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services';
import toast from 'react-hot-toast';
import { FiUser, FiLock, FiSave } from 'react-icons/fi';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const { register: regProfile, handleSubmit: handleProfile, formState: { isSubmitting: savingProfile } } = useForm({
    defaultValues: { name: user?.name, phone: user?.phone }
  });
  const { register: regPass, handleSubmit: handlePass, reset: resetPass, formState: { isSubmitting: savingPass } } = useForm();

  const onProfileSave = async (data) => {
    try {
      const res = await authService.updateProfile(data);
      updateUser(res.data.user);
      toast.success('Profile updated');
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const onPasswordSave = async (data) => {
    if (data.newPassword !== data.confirmPassword) return toast.error('Passwords do not match');
    try {
      await authService.changePassword(data);
      toast.success('Password changed');
      resetPass();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile</h1>

      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{user?.name}</h2>
            <p className="text-slate-500">{user?.email}</p>
            <span className="badge-info mt-1 capitalize">{user?.role?.replace('_', ' ')}</span>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-100 dark:border-slate-700">
          {[{ id: 'profile', icon: FiUser, label: 'Profile Info' }, { id: 'password', icon: FiLock, label: 'Change Password' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <t.icon />{t.label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <form onSubmit={handleProfile(onProfileSave)} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input {...regProfile('name', { required: 'Required' })} className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={user?.email} disabled className="input opacity-60 cursor-not-allowed" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input {...regProfile('phone')} className="input" placeholder="98XXXXXXXX" />
            </div>
            <button type="submit" className="btn-primary" disabled={savingProfile}>
              <FiSave />{savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}

        {tab === 'password' && (
          <form onSubmit={handlePass(onPasswordSave)} className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input {...regPass('currentPassword', { required: 'Required' })} type="password" className="input" />
            </div>
            <div>
              <label className="label">New Password</label>
              <input {...regPass('newPassword', { required: 'Required', minLength: { value: 6, message: 'Min 6 chars' } })} type="password" className="input" />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input {...regPass('confirmPassword', { required: 'Required' })} type="password" className="input" />
            </div>
            <button type="submit" className="btn-primary" disabled={savingPass}>
              <FiLock />{savingPass ? 'Saving...' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
