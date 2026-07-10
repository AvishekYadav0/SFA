import { FiAlertTriangle } from 'react-icons/fi';
import { Spinner } from './Spinner';

export const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, loading }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <FiAlertTriangle className="text-danger text-xl" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
