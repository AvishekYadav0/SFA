import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiPlus } from 'react-icons/fi';
import { orderService, dealerService, productService, salespersonService, reportService } from '../services';
import { useCrud } from '../hooks/useCrud';
import { EmptyState } from '../components/common/EmptyState';
import { PageLoader } from '../components/common/Spinner';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Orders() {
  const { user } = useAuth();
  const crud = useCrud(orderService);
  const [showForm, setShowForm] = useState(false);
  const [dealers, setDealers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [provinceSummary, setProvinceSummary] = useState([]);

  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      salesperson: '',
      dealer: '',
      province: '',
      area: '',
      remarks: '',
      items: [ { product: '', quantity: 1, rate: 0, excisePercent: 0, vatPercent: 13 } ]
    }
  });

  const items = watch('items');

  useEffect(() => {
    crud.fetchAll({ page: 1, limit: 50 });
    dealerService.getAll({ limit: 200 }).then(r => setDealers(r.data.data || [])).catch(() => {});
    productService.getAll({ limit: 200 }).then(r => setProducts(r.data.data || [])).catch(() => {});
    salespersonService.getAll({ limit: 200 }).then(r => setSalespersons(r.data.data || [])).catch(() => {});
    reportService.provinceWise().then(r => setProvinceSummary(r.data.data || [])).catch(() => {});
  }, []);

  const openCreate = () => {
    reset();
    setShowForm(true);
  };

  const addRow = () => {
    const current = items || [];
    setValue('items', [...current, { product: '', quantity: 1, rate: 0, excisePercent: 0, vatPercent: 13 }]);
  };

  const removeRow = (idx) => {
    const current = items || [];
    const updated = current.filter((_, i) => i !== idx);
    setValue('items', updated);
  };

  const onItemChange = (idx, field, value) => {
    const current = items || [];
    const updated = current.map((it, i) => i === idx ? { ...it, [field]: value } : it);
    setValue('items', updated);
  };

  const calcRow = (it) => {
    const qty = +it.quantity || 0;
    const rate = +it.rate || 0;
    const basic = qty * rate;
    const excise = (basic * (+it.excisePercent || 0)) / 100;
    const vat = ((basic + excise) * (+it.vatPercent || 0)) / 100;
    const grand = basic + excise + vat;
    return { basic, excise, vat, grand };
  };

  const totals = (items || []).reduce((acc, it) => {
    const { basic, excise, vat, grand } = calcRow(it);
    acc.basic += basic; acc.excise += excise; acc.vat += vat; acc.grand += grand;
    return acc;
  }, { basic: 0, excise: 0, vat: 0, grand: 0 });

  const onSubmit = async (data) => {
    try {
      await orderService.create(data);
      toast.success('Order created');
      setShowForm(false);
      crud.fetchAll({ page: 1 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating order');
    }
  };

  /* FORM VIEW */
  if (showForm) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">New Order Plan</h1>
          <p className="text-xs text-slate-500 mt-0.5">All amounts auto-calculated • Formula: Basic = Qty × Rate | Excise = Basic × Excise% | VAT = (Basic+Excise) × VAT%</p>
        </div>
        <button className="btn-secondary" onClick={() => setShowForm(false)}>← Back to List</button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">Order Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="label text-xs">Date *</label>
              <input type="date" {...register('date')} className="input text-sm" />
            </div>
            <div>
              <label className="label text-xs">Sales Person *</label>
              <select {...register('salesperson')} className="input text-sm">
                <option value="">Select...</option>
                {salespersons.map(s => (<option key={s._id} value={s._id}>{s.name || s.fullName || s.username}</option>))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Dealer *</label>
              <select {...register('dealer')} className="input text-sm">
                <option value="">Select...</option>
                {dealers.map(d => (<option key={d._id} value={d._id}>{d.dealerName}</option>))}
              </select>
            </div>
            <div>
              <label className="label text-xs">Province *</label>
              <select {...register('province')} className="input text-sm">
                <option value="">Select Province...</option>
                <option value="Koshi">Koshi Province</option>
                <option value="Madhesh">Madhesh Province</option>
                <option value="Bagmati">Bagmati Province</option>
                <option value="Gandaki">Gandaki Province</option>
                <option value="Lumbini">Lumbini Province</option>
                <option value="Karnali">Karnali Province</option>
                <option value="Sudurpashchim">Sudurpashchim Province</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label text-xs">Area</label>
              <input {...register('area')} className="input text-sm" placeholder="Area" />
            </div>
            <div className="md:col-span-2">
              <label className="label text-xs">Remarks</label>
              <textarea {...register('remarks')} className="input text-sm h-20" placeholder="Optional remarks..." />
            </div>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 text-white font-semibold text-sm" style={{ background: '#1e3a8a' }}>
            📋 Order Items Sheet
            <button type="button" onClick={addRow} className="ml-4 btn-primary btn-sm"><FiPlus /> Add Row</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: '#1e40af', color: '#fff' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Product Name</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Quantity</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Rate (NPR)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Basic Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Excise %</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Excise Amt</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">VAT %</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">VAT Amt</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Grand Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(items || []).map((it, idx) => {
                  const r = calcRow(it);
                  return (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }} className="border-b border-slate-100">
                      <td className="px-3 py-3 text-xs">{idx + 1}</td>
                      <td className="px-3 py-3 text-xs">
                        <select className="input text-sm" value={it.product} onChange={e => onItemChange(idx, 'product', e.target.value)}>
                          <option value="">Select from list</option>
                          {products.map(p => (<option key={p._id} value={p._id}>{p.productName}</option>))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-center"><input type="number" min="0" className="input w-20 text-center" value={it.quantity} onChange={e => onItemChange(idx, 'quantity', +e.target.value)} /></td>
                      <td className="px-3 py-3 text-center"><input type="number" min="0" className="input w-28 text-center" value={it.rate} onChange={e => onItemChange(idx, 'rate', +e.target.value)} /></td>
                      <td className="px-3 py-3 text-center text-xs font-bold">{r.basic.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center"><input type="number" min="0" className="input w-20 text-center" value={it.excisePercent} onChange={e => onItemChange(idx, 'excisePercent', +e.target.value)} /></td>
                      <td className="px-3 py-3 text-center text-xs font-bold">{r.excise.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center"><input type="number" min="0" className="input w-20 text-center" value={it.vatPercent} onChange={e => onItemChange(idx, 'vatPercent', +e.target.value)} /></td>
                      <td className="px-3 py-3 text-center text-xs font-bold">{r.vat.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center text-xs font-bold text-blue-600">{r.grand.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center">
                        <button type="button" className="text-red-500" onClick={() => removeRow(idx)}>−</button>
                      </td>
                    </tr>
                  );
                })}

                {/* totals row */}
                <tr style={{ background: '#eef2ff' }}>
                  <td colSpan={4} className="px-3 py-3 text-right font-semibold">TOTALS →</td>
                  <td className="px-3 py-3 text-center font-bold">{totals.basic.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center font-semibold">—</td>
                  <td className="px-3 py-3 text-center font-bold text-orange-600">{totals.excise.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center font-semibold">—</td>
                  <td className="px-3 py-3 text-center font-bold text-blue-600">{totals.vat.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center font-bold text-green-700">{totals.grand.toFixed(2)}</td>
                  <td />
                </tr>

              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          <button type="submit" className="btn-primary px-8">Save Order</button>
        </div>
      </form>
    </div>
  );

  /* LIST VIEW */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">{crud.total} total orders across {provinceSummary.length || 0} provinces</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><FiPlus /> New Order</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {provinceSummary.length === 0 && crud.loading ? <div className="col-span-full"><PageLoader /></div> : (
          provinceSummary.length === 0 ? (
            <EmptyState title="No orders" description="No orders found" />
          ) : (
            provinceSummary.map((p, i) => (
              <div key={p.province || i} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-blue-50 flex items-center justify-center">📍</div>
                  <div>
                    <div className="text-sm font-semibold">{p.province || 'Unknown Province'}</div>
                    <div className="text-xs text-slate-500 mt-1">{p.count || 0} orders</div>
                    <div className="text-lg font-bold text-blue-700 mt-3">NPR {Number(p.total || 0).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>

    </div>
  );
}
