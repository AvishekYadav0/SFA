import { useEffect, useState } from 'react';
import { notificationService } from '../services';
import { PageLoader } from '../components/common/Spinner';
import { FiBell, FiCheck, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const TYPE_COLORS = {
  order:       'bg-blue-100 text-blue-600',
  collection:  'bg-green-100 text-green-600',
  dealer:      'bg-orange-100 text-orange-600',
  target:      'bg-purple-100 text-purple-600',
  outstanding: 'bg-red-100 text-red-600',
  general:     'bg-slate-100 text-slate-600',
};

export default function Notifications() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal]   = useState(0);

  const load = () => {
    setLoading(true);
    notificationService.getAll({ limit: 50 })
      .then(r => { setItems(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setItems(p => p.map(n => n._id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const markAll = async () => {
    try {
      await notificationService.markAllRead();
      setItems(p => p.map(n => ({ ...n, read: true })));
      toast.success('All marked as read');
    } catch {}
  };

  const unread = items.filter(n => !n.read).length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="btn-secondary text-sm flex items-center gap-2">
            <FiCheckCircle /> Mark All Read
          </button>
        )}
      </div>

      {loading ? <PageLoader /> : items.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <FiBell className="mx-auto text-4xl mb-3 opacity-30" />
          <p>No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <div key={n._id}
              className={`card p-4 flex items-start gap-4 transition-all ${!n.read ? 'border-l-4 border-primary-500' : 'opacity-70'}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[n.type] || TYPE_COLORS.general}`}>
                <FiBell className="text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{n.title}</p>
                <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.read && (
                <button onClick={() => markRead(n._id)}
                  className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg text-green-600 flex-shrink-0">
                  <FiCheck />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
