import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { collectionService, dealerService } from '../services';
import { useCrud } from '../hooks/useCrud';
import { EmptyState } from '../components/common/EmptyState';
import { formatCurrency } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { Pagination } from '../components/common/Pagination';
import { FiPlus, FiArrowLeft, FiDollarSign, FiChevronRight } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Collections() {
  const { user } = useAuth();
  const crud = useCrud(collectionService);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [dealers, setDealers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [useFifo, setUseFifo] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: {
      dealer: '',
      collectionDate: new Date().toISOString().slice(0, 10),
      amount: '',
      paymentType: 'cash',
      reference: '',
      chequeNumber: '',
      bankName: '',
      transactionId: '',
      remarks: '',
      fifo: true,
    },
  });

  const dealerId = watch('dealer');
  const amount = Number(watch('amount') || 0);
  const paymentType = watch('paymentType');
  const fifo = watch('fifo');

  const selectedDealer = useMemo(() => dealers.find((d) => d._id === dealerId), [dealers, dealerId]);
  const invoiceTotal = useMemo(() => invoices.reduce((sum, invoice) => sum + (invoice.remainingBalance || 0), 0), [invoices]);
  const selectedInvoiceCount = useMemo(() => invoices.filter((invoice) => invoice._selected).length, [invoices]);
  const selectedInvoiceSum = useMemo(() => invoices.reduce((sum, invoice) => sum + (invoice._selected ? Number(invoice._allocationAmount || invoice.remainingBalance || 0) : 0), 0), [invoices]);

  useEffect(() => {
    crud.fetchAll({ page, limit: 10 });
    dealerService.getAll({ limit: 200 }).then((res) => setDealers(res.data.data || [])).catch(() => {});
  }, [page]);

  useEffect(() => {
    if (!dealerId) return setInvoices([]);
    setLoadingInvoices(true);
    collectionService.getDealerInvoices(dealerId)
      .then((res) => {
        const invoiceList = (res.data.data || []).map((invoice) => ({
          ...invoice,
          _selected: false,
          _allocationAmount: invoice.remainingBalance || 0,
        }));
        setInvoices(invoiceList);
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load invoices'))
      .finally(() => setLoadingInvoices(false));
  }, [dealerId]);

  const openCreate = () => {
    setShowForm(true);
    reset({
      dealer: '',
      collectionDate: new Date().toISOString().slice(0, 10),
      amount: '',
      paymentType: 'cash',
      reference: '',
      chequeNumber: '',
      bankName: '',
      transactionId: '',
      remarks: '',
      fifo: true,
    });
    setInvoices([]);
    setUseFifo(true);
  };

  const handleDealerChange = (event) => {
    reset({ ...watch(), dealer: event.target.value, fifo: true });
    setUseFifo(true);
  };

  const toggleFifo = () => {
    setValue('fifo', !fifo);
    setUseFifo(!fifo);
    setInvoices((prev) => prev.map((invoice) => ({ ...invoice, _selected: false, _allocationAmount: invoice.remainingBalance || 0 })));
  };

  const handleInvoiceSelection = (invoiceId, selected) => {
    setInvoices((prev) => prev.map((invoice) => invoice._id === invoiceId ? {
      ...invoice,
      _selected: selected,
      _allocationAmount: selected ? invoice._allocationAmount || invoice.remainingBalance || 0 : 0,
    } : invoice));
  };

  const handleAllocationChange = (invoiceId, value) => {
    const amountValue = Number(value || 0);
    setInvoices((prev) => prev.map((invoice) => invoice._id === invoiceId ? {
      ...invoice,
      _selected: amountValue > 0,
      _allocationAmount: amountValue,
    } : invoice));
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        dealer: data.dealer,
        collectionDate: data.collectionDate,
        amount: Number(data.amount),
        paymentMode: data.paymentType,
        reference: data.reference,
        chequeNumber: data.chequeNumber,
        bankName: data.bankName,
        transactionId: data.transactionId,
        remarks: data.remarks,
      };

      if (data.fifo) {
        payload.fifo = true;
      } else {
        const allocations = invoices
          .filter((invoice) => invoice._selected && Number(invoice._allocationAmount) > 0)
          .map((invoice) => ({ sale: invoice._id, amount: Number(invoice._allocationAmount) }));

        if (!allocations.length) throw new Error('Select at least one invoice allocation');
        payload.allocations = allocations;
      }

      await collectionService.create(payload);
      toast.success('Collection recorded');
      setShowForm(false);
      crud.fetchAll({ page });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save collection');
    }
  };

  const canManage = ['admin', 'nsm', 'rsm', 'asm', 'se', 'so'].includes(user?.role);

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">New Collection</h1>
            <p className="text-xs text-slate-500 mt-0.5">Record a dealer receipt and allocate it against outstanding invoices.</p>
          </div>
          <button className="btn-secondary" onClick={() => setShowForm(false)}>
            <FiArrowLeft className="inline-block mr-2" /> Back to Collections
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card p-4 space-y-3">
              <div>
                <label className="label text-xs">Dealer *</label>
                <select {...register('dealer', { required: 'Dealer is required' })}
                  onChange={handleDealerChange}
                  className="input text-sm">
                  <option value="">Select Dealer...</option>
                  {dealers.map((dealer) => (
                    <option key={dealer._id} value={dealer._id}>{dealer.dealerName} — {dealer.area}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs">Collection Date *</label>
                <input type="date" {...register('collectionDate', { required: true })} className="input text-sm" />
              </div>

              <div>
                <label className="label text-xs">Payment Type *</label>
                <select {...register('paymentType')} className="input text-sm">
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank">Bank</option>
                  <option value="online">Online</option>
                </select>
              </div>

              <div>
                <label className="label text-xs">Amount *</label>
                <input type="number" step="0.01" min="0" {...register('amount', { required: 'Amount is required' })}
                  className="input text-sm" placeholder="0.00" />
              </div>

              <div>
                <label className="label text-xs">Reference</label>
                <input type="text" {...register('reference')} className="input text-sm" placeholder="Receipt ref" />
              </div>

              <div>
                <label className="label text-xs">Cheque / Transaction</label>
                <input type="text" {...register('transactionId')} className="input text-sm" placeholder="Cheque or Txn ID" />
              </div>

              <div>
                <label className="label text-xs">Bank Name</label>
                <input type="text" {...register('bankName')} className="input text-sm" placeholder="Bank name" />
              </div>

              <div>
                <label className="label text-xs">Remarks</label>
                <textarea {...register('remarks')} className="input text-sm h-24" placeholder="Optional note" />
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="card p-4">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Invoice Allocation</h2>
                    <p className="text-xs text-slate-500">Choose FIFO allocation or manually assign the collection to invoices.</p>
                  </div>
                  <button type="button" onClick={toggleFifo}
                    className="btn-secondary text-xs py-2 px-3">
                    {fifo ? 'Switch to manual allocation' : 'Switch to FIFO allocation'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                    <p className="text-xs text-slate-500">Outstanding invoice balance</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(invoiceTotal)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                    <p className="text-xs text-slate-500">Selected allocation</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(selectedInvoiceSum)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-xs uppercase">
                        <th className="px-3 py-2 text-left">Invoice</th>
                        <th className="px-3 py-2 text-right">Due Date</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right">Remaining</th>
                        <th className="px-3 py-2 text-center">Allocate</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingInvoices ? (
                        <tr><td colSpan={6} className="p-4 text-center text-slate-500">Loading invoices…</td></tr>
                      ) : invoices.length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-slate-500">Select a dealer to show outstanding invoices.</td></tr>
                      ) : invoices.map((invoice) => (
                        <tr key={invoice._id} className={invoice._selected ? 'bg-slate-50' : ''}>
                          <td className="px-3 py-2 text-xs font-medium">{invoice.invoiceNumber}</td>
                          <td className="px-3 py-2 text-right text-xs text-slate-500">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}</td>
                          <td className="px-3 py-2 text-right text-xs">{formatCurrency(invoice.grandTotal)}</td>
                          <td className="px-3 py-2 text-right text-xs">{formatCurrency(invoice.remainingBalance)}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" disabled={fifo} checked={fifo ? false : invoice._selected}
                              onChange={(e) => handleInvoiceSelection(invoice._id, e.target.checked)} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" step="0.01" min="0" value={invoice._allocationAmount}
                              disabled={fifo || !invoice._selected}
                              onChange={(e) => handleAllocationChange(invoice._id, e.target.value)}
                              className="input text-xs text-right" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedDealer && (
                <div className="card p-4 border border-slate-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Dealer selected</p>
                      <p className="text-lg font-semibold text-slate-900">{selectedDealer.dealerName}</p>
                    </div>
                    <span className="text-sm text-slate-500">Outstanding: {formatCurrency(selectedDealer.outstandingAmount || 0)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary px-8" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Collection'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Collections</h1>
          <p className="text-sm text-slate-500 mt-0.5">{crud.total} receipts recorded</p>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={openCreate}>
            <FiPlus className="inline-block mr-2" /> New Collection
          </button>
        )}
      </div>

      <div className="card p-0">
        {crud.loading ? (
          <PageLoader />
        ) : crud.data.length === 0 ? (
          <EmptyState icon={FiDollarSign} title="No collections yet" description="Record a dealer collection to start tracking receipts." action={canManage && <button className="btn-primary" onClick={openCreate}><FiPlus /> New Collection</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs uppercase">
                    <th className="px-3 py-3 text-left">Receipt</th>
                    <th className="px-3 py-3 text-left">Dealer</th>
                    <th className="px-3 py-3 text-right">Date</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3 text-left">Payment</th>
                    <th className="px-3 py-3 text-left">Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {crud.data.map((item, index) => (
                    <tr key={item._id} className={index % 2 === 0 ? '' : 'bg-slate-50'}>
                      <td className="px-3 py-3 text-xs font-semibold">{item.collectionNumber || '—'}</td>
                      <td className="px-3 py-3 text-xs">{item.dealer?.dealerName || 'Unknown'}</td>
                      <td className="px-3 py-3 text-xs text-right">{item.collectionDate ? new Date(item.collectionDate).toLocaleDateString() : ''}</td>
                      <td className="px-3 py-3 text-xs text-right font-bold text-slate-800">{formatCurrency(item.amount)}</td>
                      <td className="px-3 py-3 text-xs">{item.paymentType}</td>
                      <td className="px-3 py-3 text-xs">{item.allocations?.length || 0} <FiChevronRight className="inline-block ml-1 align-middle" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4"><Pagination page={page} pages={crud.pages} onPage={setPage} /></div>
          </>
        )}
      </div>
    </div>
  );
}
