import { useEffect, useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { platformAdminApi } from '../services/platformAdminApi';

const initialSettings = {
  platformName: 'SFA Platform',
  defaultSubscriptionDuration: 365,
  defaultGracePeriod: 7,
  expiryNotificationSchedule: '7,3,1 days before expiry',
  defaultCurrency: 'INR',
  supportEmail: 'support@sfa.platform',
  platformContact: '+91 98765 43210',
  subscriptionPolicies: 'All new companies receive a 365-day Basic or Pro license by default. Expiry reminders are sent before the grace period ends.',
};

export default function PlatformAdminSettings() {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await platformAdminApi.getSettings?.() || { data: { data: initialSettings } };
        setSettings({ ...initialSettings, ...(data?.data || {}) });
      } catch (error) {
        setSettings(initialSettings);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await platformAdminApi.updateSettings?.(settings);
      window.alert('Platform settings saved successfully.');
    } catch (error) {
      window.alert('Unable to save platform settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-600">Platform</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Platform Settings</h1>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Platform configuration</h2>
            <p className="text-sm text-slate-500">Keep tenant-level subscription defaults and platform contact details aligned.</p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading platform settings...</div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Platform Name</span>
              <input value={settings.platformName} onChange={(e) => handleChange('platformName', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-blue-500 focus:bg-white" />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Default Currency</span>
              <input value={settings.defaultCurrency} onChange={(e) => handleChange('defaultCurrency', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-blue-500 focus:bg-white" />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Default Subscription Duration (Days)</span>
              <input type="number" min="1" value={settings.defaultSubscriptionDuration} onChange={(e) => handleChange('defaultSubscriptionDuration', Number(e.target.value || 365))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-blue-500 focus:bg-white" />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Default Grace Period (Days)</span>
              <input type="number" min="0" value={settings.defaultGracePeriod} onChange={(e) => handleChange('defaultGracePeriod', Number(e.target.value || 7))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-blue-500 focus:bg-white" />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Expiry Notification Schedule</span>
              <input value={settings.expiryNotificationSchedule} onChange={(e) => handleChange('expiryNotificationSchedule', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-blue-500 focus:bg-white" />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Support Email</span>
              <input type="email" value={settings.supportEmail} onChange={(e) => handleChange('supportEmail', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-blue-500 focus:bg-white" />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Platform Contact Information</span>
              <input value={settings.platformContact} onChange={(e) => handleChange('platformContact', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-blue-500 focus:bg-white" />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Subscription Policies</span>
              <textarea rows="4" value={settings.subscriptionPolicies} onChange={(e) => handleChange('subscriptionPolicies', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-blue-500 focus:bg-white" />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
