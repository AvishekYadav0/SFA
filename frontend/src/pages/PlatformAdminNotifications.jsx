import { BellRing } from 'lucide-react';

export default function PlatformAdminNotifications() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Platform</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Notifications</h1>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <BellRing className="mx-auto h-9 w-9 text-slate-300" />
        <h2 className="mt-3 font-semibold text-slate-900">No platform notifications available</h2>
        <p className="mt-1 text-sm text-slate-500">The backend does not currently provide a platform notification feed, so no sample alerts are shown.</p>
      </div>
    </div>
  );
}
