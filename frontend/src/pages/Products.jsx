import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { productService } from '../services';
import { useCrud } from '../hooks/useCrud';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Pagination } from '../components/common/Pagination';
import { SearchInput } from '../components/common/SearchInput';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge, formatCurrency } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { FiPlus, FiEdit2, FiTrash2, FiPackage } from 'react-icons/fi';
import toast from 'react-hot-toast';

const CATEGORIES = ['Beverages', 'Snacks', 'Dairy', 'Personal Care', 'Household', 'Other'];
const UNITS = ['Piece', 'Box', 'Carton', 'Kg', 'Liter', 'Pack'];

export default function Products() {
  const crud = useCrud(productService);
  const [modal, setModal] = useState({ open: false, data: null });
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => { crud.fetchAll({ page, search, limit: 10 }); }, [page, search]);

  const openCreate = () => { reset({}); setModal({ open: true, data: null }); };
  const openEdit = (item) => { reset(item); setModal({ open: true, data: item }); };

  const onSubmit = async (data) => {
    try {
      if (modal.data) await crud.update(modal.data._id, data);
      else await crud.create(data);
      setModal({ open: false, data: null });
      crud.fetchAll({ page, search });
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await crud.remove(confirm.id); setConfirm({ open: false, id: null }); crud.fetchAll({ page, search }); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Products</h1>
          <p className="text-sm text-slate-500 mt-1">{crud.total} total records</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search products..." />
          <button className="btn-primary" onClick={openCreate}><FiPlus />Add New</button>
        </div>
      </div>

      <div className="card p-0">
        {crud.loading ? <PageLoader /> : crud.data.length === 0 ? (
          <EmptyState icon={FiPackage} title="No products found" description="Add your first product" action={<button className="btn-primary" onClick={openCreate}><FiPlus />Add Product</button>} />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Product Name</th><th>Brand</th><th>Category</th><th>SKU</th><th>Unit</th><th>Rate</th><th>Excise%</th><th>VAT%</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {crud.data.map(p => (
                    <tr key={p._id}>
                      <td className="font-medium">{p.productName}</td>
                      <td>{p.brand}</td>
                      <td>{p.category}</td>
                      <td className="text-xs text-slate-500">{p.sku}</td>
                      <td>{p.unit}</td>
                      <td className="font-medium">{formatCurrency(p.rate)}</td>
                      <td>{p.excisePercent}%</td>
                      <td>{p.vatPercent}%</td>
                      <td>{p.stock}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-blue-600"><FiEdit2 /></button>
                          <button onClick={() => setConfirm({ open: true, id: p._id })} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-danger"><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4"><Pagination page={page} pages={crud.pages} onPage={setPage} /></div>
          </>
        )}
      </div>

      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? 'Edit Product' : 'Add Product'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Product Name</label>
            <input {...register('productName', { required: 'Required' })} className="input"  placeholder='Enter Product Name' />
            {errors.productName && <p className="text-danger text-xs mt-1">{errors.productName.message}</p>}
          </div>
          <div>
            <label className="label">Brand</label>
            <input {...register('brand', { required: 'Required' })} className="input" placeholder='eg : Iphone ' />
            {errors.brand && <p className="text-danger text-xs mt-1">{errors.brand.message}</p>}
          </div>
          <div>
            <label className="label">Category</label>
            <select {...register('category', { required: 'Required' })} className="input">
              <option value="">Select...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="text-danger text-xs mt-1">{errors.category.message}</p>}
          </div>
          <div>
            <label className="label">SKU</label>
            <input {...register('sku', { required: 'Required' })} className="input" placeholder='eg : MAS-1001' />
            {errors.sku && <p className="text-danger text-xs mt-1">{errors.sku.message}</p>}
          </div>
          <div>
            <label className="label">Unit</label>
            <select {...register('unit', { required: 'Required' })} className="input">
              <option value="">Select...</option>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Rate (NPR)</label>
            <input {...register('rate', { required: 'Required', valueAsNumber: true, min: 0 })} type="number" step="0.01" className="input" />
            {errors.rate && <p className="text-danger text-xs mt-1">{errors.rate.message}</p>}
          </div>
          <div>
            <label className="label">Excise %</label>
            <input {...register('excisePercent', { valueAsNumber: true })} type="number" step="0.01" className="input" defaultValue={0} />
          </div>
          <div>
            <label className="label">VAT %</label>
            <input {...register('vatPercent', { valueAsNumber: true })} type="number" step="0.01" className="input" defaultValue={13} />
          </div>
          <div>
            <label className="label">Stock</label>
            <input {...register('stock', { valueAsNumber: true })} type="number" className="input" defaultValue={0} />
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal({ open: false, data: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : modal.data ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={confirm.open} title="Delete Product" message="This action cannot be undone."
        onConfirm={handleDelete} onCancel={() => setConfirm({ open: false, id: null })} loading={deleting} />
    </div>
  );
}
