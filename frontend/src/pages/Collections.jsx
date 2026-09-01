import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { collectionService, dealerService } from '../services';
import { useCrud } from '../hooks/useCrud';
import { EmptyState } from '../components/common/EmptyState';
import { formatCurrency } from '../components/common/index.jsx';
import { PageLoader } from '../components/common/Spinner';
import { Pagination } from '../components/common/Pagination';
import { FiPlus, FiArrowLeft, FiDollarSign, FiChevronRight, FiX, FiPrinter } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Collections() {
  const { user } = useAuth();
  const crud = useCrud(collectionService);
  const [showForm, setShowForm] = useState(false);
  const [receipt, setReceipt] = useState(null); // selected receipt for detail modal
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
                    <p className="text-xs text-slate-500">{useFifo ? 'Will be auto-allocated (FIFO)' : 'Selected allocation'}</p>
                    <p className="text-lg font-bold text-slate-900">{useFifo ? formatCurrency(Math.min(amount, invoiceTotal)) : formatCurrency(selectedInvoiceSum)}</p>
                  </div>
                </div>
                {useFifo && invoices.length > 0 && (
                  <div className="mb-3 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                    ✅ FIFO mode: collection will be applied to oldest orders first automatically.
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-xs uppercase">
                        <th className="px-3 py-2 text-left">Invoice</th>
                        <th className="px-3 py-2 text-left">Order Date</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-right">Remaining</th>
                        {!useFifo && <th className="px-3 py-2 text-center">Select</th>}
                        {!useFifo && <th className="px-3 py-2 text-right">Pay Amount</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {loadingInvoices ? (
                        <tr><td colSpan={6} className="p-4 text-center text-slate-500">Loading invoices…</td></tr>
                      ) : invoices.length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-slate-500">Select a dealer to show outstanding invoices.</td></tr>
                      ) : invoices.map((invoice) => (
                        <tr key={invoice._id}
                          className={`border-b border-slate-100 ${
                            !useFifo && invoice._selected ? 'bg-green-50' : 'hover:bg-slate-50'
                          }`}>
                          <td className="px-3 py-2 text-xs font-semibold text-blue-700">{invoice.invoiceNumber}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {invoice.date ? new Date(invoice.date).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-medium">{formatCurrency(invoice.grandTotal)}</td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-red-600">{formatCurrency(invoice.remainingBalance)}</td>
                          {!useFifo && (
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={!!invoice._selected}
                                onChange={(e) => handleInvoiceSelection(invoice._id, e.target.checked)}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"
                              />
                            </td>
                          )}
                          {!useFifo && (
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number" step="0.01" min="0"
                                max={invoice.remainingBalance}
                                value={invoice._allocationAmount || ''}
                                disabled={!invoice._selected}
                                onChange={(e) => handleAllocationChange(invoice._id, e.target.value)}
                                className="w-28 text-right text-xs border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                              />
                            </td>
                          )}
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
                    <tr key={item._id} className={`${index % 2 === 0 ? '' : 'bg-slate-50'} hover:bg-blue-50 cursor-pointer transition-colors`}
                      onClick={() => setReceipt(item)}>
                      <td className="px-3 py-3 text-xs font-semibold text-blue-700">{item.collectionNumber || '—'}</td>
                      <td className="px-3 py-3 text-xs font-medium">{item.dealer?.dealerName || 'Unknown'}</td>
                      <td className="px-3 py-3 text-xs text-right">{item.collectionDate ? new Date(item.collectionDate).toLocaleDateString() : ''}</td>
                      <td className="px-3 py-3 text-xs text-right font-bold text-green-700">{formatCurrency(item.amount)}</td>
                      <td className="px-3 py-3 text-xs capitalize">{item.paymentType}</td>
                      <td className="px-3 py-3 text-xs">
                        <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                          {item.allocations?.length || 0} invoices
                          <FiChevronRight size={12} />
                        </span>
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

      {/* Receipt Detail Modal */}
      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function ReceiptModal({ receipt, onClose }) {
  const printReceipt = () => {
    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${receipt.collectionNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 32px; }
          .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px; }
          .header h1 { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
          .header p { font-size: 12px; color: #64748b; margin-top: 4px; }
          .badge { display: inline-block; background: #dcfce7; color: #166534; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; margin-top: 6px; }
          .section { margin-bottom: 18px; }
          .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
          .field label { font-size: 11px; color: #64748b; }
          .field p { font-size: 13px; font-weight: 600; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #1e293b; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          tr:last-child td { border-bottom: none; }
          .amount-box { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 14px 20px; text-align: center; margin-top: 20px; }
          .amount-box .label { font-size: 12px; color: #64748b; }
          .amount-box .value { font-size: 28px; font-weight: bold; color: #166534; }
          .footer { text-align: center; margin-top: 28px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>COLLECTION RECEIPT</h1>
          <p>SFA Sales Force Automation System</p>
          <span class="badge">✓ VERIFIED</span>
        </div>

        <div class="section">
          <div class="grid2">
            <div class="field"><label>Receipt No.</label><p>${receipt.collectionNumber || '—'}</p></div>
            <div class="field"><label>Collection Date</label><p>${receipt.collectionDate ? new Date(receipt.collectionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p></div>
            <div class="field"><label>Dealer</label><p>${receipt.dealer?.dealerName || '—'}</p></div>
            <div class="field"><label>Payment Mode</label><p style="text-transform:capitalize">${receipt.paymentType || '—'}</p></div>
            ${receipt.reference ? `<div class="field"><label>Reference</label><p>${receipt.reference}</p></div>` : ''}
            ${receipt.transactionId ? `<div class="field"><label>Cheque / Txn ID</label><p>${receipt.transactionId}</p></div>` : ''}
            ${receipt.bankName ? `<div class="field"><label>Bank</label><p>${receipt.bankName}</p></div>` : ''}
            ${receipt.remarks ? `<div class="field"><label>Remarks</label><p>${receipt.remarks}</p></div>` : ''}
          </div>
        </div>

        ${receipt.allocations?.length ? `
        <div class="section">
          <div class="section-title">Invoice Allocations</div>
          <table>
            <thead><tr><th>#</th><th>Invoice / Order</th><th style="text-align:right">Allocated Amount</th></tr></thead>
            <tbody>
              ${receipt.allocations.map((a, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${a.invoiceNumber || a.sale?.invoiceNumber || '—'}</td>
                  <td style="text-align:right;font-weight:bold">NPR ${Number(a.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : ''}

        <div class="amount-box">
          <div class="label">Total Amount Collected</div>
          <div class="value">NPR ${Number(receipt.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; SFA System</p>
          <p style="margin-top:4px">This is a computer-generated receipt. No signature required.</p>
        </div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{receipt.collectionNumber}</h2>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">✓ Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={printReceipt}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors">
              <FiPrinter size={13} /> Print / Download
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <FiX size={16} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Dealer', receipt.dealer?.dealerName],
              ['Date', receipt.collectionDate ? new Date(receipt.collectionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
              ['Payment Mode', receipt.paymentType],
              ['Reference', receipt.reference || '—'],
              receipt.transactionId && ['Cheque / Txn ID', receipt.transactionId],
              receipt.bankName && ['Bank', receipt.bankName],
              receipt.remarks && ['Remarks', receipt.remarks],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 capitalize">{value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Invoice Allocations */}
          {receipt.allocations?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Invoice Allocations</p>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Invoice</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.allocations.map((a, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2 text-xs font-medium text-blue-700">{a.invoiceNumber || a.sale?.invoiceNumber || '—'}</td>
                        <td className="px-3 py-2 text-xs text-right font-bold text-green-700">{formatCurrency(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">Total Amount Collected</p>
            <p className="text-3xl font-bold text-green-700">{formatCurrency(receipt.amount)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
