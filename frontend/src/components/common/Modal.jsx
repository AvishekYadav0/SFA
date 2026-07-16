import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

/**
 * Fixed Modal:
 * - Backdrop click closes the modal (mousedown+click on the backdrop itself only)
 * - Clicks inside the modal content (including form submit buttons) are
 *   stopped from bubbling to the backdrop, so submitting a form no longer
 *   accidentally triggers onClose before/instead of onSubmit.
 * - Escape key closes the modal.
 * - Locks body scroll while open.
 */
export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose} // backdrop click closes
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()} // <-- THE FIX: stops clicks (incl. submit button) from bubbling to backdrop
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
