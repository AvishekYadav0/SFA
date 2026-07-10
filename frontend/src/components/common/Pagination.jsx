import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export const Pagination = ({ page, pages, onPage }) => {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <p className="text-sm text-slate-500 dark:text-slate-400">Page {page} of {pages}</p>
      <div className="flex gap-2">
        <button className="btn-secondary py-1.5 px-3" onClick={() => onPage(page - 1)} disabled={page === 1}>
          <FiChevronLeft />
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = Math.max(1, Math.min(pages - 4, page - 2)) + i;
          return (
            <button key={p} onClick={() => onPage(p)}
              className={`btn py-1.5 px-3 ${p === page ? 'bg-primary-600 text-white' : 'btn-secondary'}`}>
              {p}
            </button>
          );
        })}
        <button className="btn-secondary py-1.5 px-3" onClick={() => onPage(page + 1)} disabled={page === pages}>
          <FiChevronRight />
        </button>
      </div>
    </div>
  );
};
