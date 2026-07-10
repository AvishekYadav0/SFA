export { Modal } from './Modal';
export { Spinner, PageLoader, Skeleton } from './Spinner';
export { Pagination } from './Pagination';
export { SearchInput } from './SearchInput';
export { EmptyState } from './EmptyState';
export { ConfirmDialog } from './ConfirmDialog';

export const StatusBadge = ({ status }) => {
  const map = {
    active: 'badge-success', inactive: 'badge-danger',
    pending: 'badge-warning', approved: 'badge-success',
    rejected: 'badge-danger', cancelled: 'badge-gray',
  };
  return <span className={map[status] || 'badge-gray'} style={{ textTransform: 'capitalize' }}>{status}</span>;
};

export const formatCurrency = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'NPR', minimumFractionDigits: 0 }).format(n || 0);

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
