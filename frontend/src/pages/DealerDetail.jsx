import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dealerService } from '../services';
import { PageLoader } from '../components/common/Spinner';
import { StatusBadge, formatCurrency } from '../components/common/index.jsx';
import { FiArrowLeft, FiDollarSign, FiFileText, FiBookOpen, FiClock } from 'react-icons/fi';
import toast from 'react-hot-toast';

const TABS = ['Overview', 'Collections', 'Invoices', 'Ledger'];

export default function DealerDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [dealer, setDealer] = useState(null);
  const [collections, setCollections] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const load = async () => {
      try {
        const [dealerRes, collectionsRes, invoicesRes, ledgerRes] = await Promise.all([
          dealerService.getOne(id),
          dealerService.getCollections(id),
          dealerService.getInvoices(id),
          dealerService.getLedger(id),
        ]);

        if (!cancelled) {
          setDealer(dealerRes.data.data);
          setCollections(collectionsRes.data.data || []);
          setInvoices(invoicesRes.data.data || []);
          setLedger(ledgerRes.data.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load dealer details');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  const summary = useMemo(() => ({
    outstanding: Number(dealer?.outstandingAmount || 0),
    dueToday: Number(dealer?.dueAmount || 0),
    overdue: Number(dealer?.overdueAmount || 0),
    creditLimit: Number(dealer?.creditLimit || 0),
    openingBalance: Number(dealer?.openingBalance || 0),
  }), [dealer]);

  if (loading) return <PageLoader />;
  if (error) return (
    <div className="card p-8 text-center">
      <p className="text-sm text-red-600">{error}</p>
      <button className="btn-primary mt-4" onClick={() => navigate('/dealers')}>Back to Dealers</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button className="text-sm text-slate-500 hover:text-slate-900" onClick={() => navigate('/dealers')}>
            <FiArrowLeft className="inline-block mr-2" /> Back to Dealers
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">{dealer.dealerName}</h1>
          <p className="text-sm text-slate-500">{dealer.dealerCode || 'Dealer profile'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-2 rounded-2xl bg-slate-100 text-slate-700 text-sm">Status: {dealer.status || 'active'}</span>
          <span className="px-3 py-2 rounded-2xl bg-slate-100 text-slate-700 text-sm">Credit: {dealer.creditStatus === 'blocked' ? 'Blocked' : 'Allowed'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Outstanding Balance</p>
          <p className="text-2xl font-bold mt-2">{formatCurrency(summary.outstanding)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Due Today</p>
          <p className="text-2xl font-bold mt-2">{formatCurrency(summary.dueToday)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Overdue Amount</p>
          <p className="text-2xl font-bold mt-2">{formatCurrency(summary.overdue)}</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoCell label="Credit Limit" value={formatCurrency(summary.creditLimit)} />
          <InfoCell label="Opening Balance" value={formatCurrency(summary.openingBalance)} />
          <InfoCell label="Province" value={dealer.province || '—'} />
          <InfoCell label="Area" value={dealer.area || '—'} />
        </div>
      </div>

      <div className="card p-0">
        <div className="flex flex-wrap gap-1 border-b border-slate-100 dark:border-slate-800">
          {TABS.map((tabLabel) => (
            <button key={tabLabel} onClick={() => setTab(tabLabel)}
              className={`px-4 py-3 text-sm font-medium transition ${tab === tabLabel ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}>
              {tabLabel}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'Overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="card p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Dealer Details</h2>
                <DetailRow label="Owner" value={dealer.ownerName} />
                <DetailRow label="Phone" value={dealer.phone} />
                <DetailRow label="Address" value={[dealer.address, dealer.area, dealer.district, dealer.province].filter(Boolean).join(', ')} />
                <DetailRow label="PAN" value={dealer.panNumber || '—'} />
                <DetailRow label="VAT" value={dealer.vatNumber || '—'} />
              </section>

              <section className="card p-4">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Sales Team</h2>
                <DetailRow label="SE" value={dealer.se?.name || '—'} />
                <DetailRow label="SO" value={Array.isArray(dealer.so) ? dealer.so.map((user) => user.name).join(', ') : dealer.so?.name || '—'} />
                <DetailRow label="ASM" value={dealer.asm?.name || '—'} />
                <DetailRow label="RSM" value={dealer.rsm?.name || '—'} />
                <DetailRow label="NSM" value={dealer.nsm?.name || '—'} />
              </section>
            </div>
          )}

          {tab === 'Collections' && (
            <div>
              {collections.length === 0 ? (
                <div className="text-sm text-slate-500">No collection receipts found for this dealer.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Receipt</th>
                        <th>Date</th>
                        <th className="text-right">Amount</th>
                        <th>Payment Type</th>
                        <th>Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collections.map((item) => (
                        <tr key={item._id}>
                          <td className="font-semibold text-primary-600">{item.collectionNumber}</td>
                          <td>{new Date(item.collectionDate || item.date).toLocaleDateString()}</td>
                          <td className="text-right font-semibold">{formatCurrency(item.amount)}</td>
                          <td className="capitalize">{item.paymentType}</td>
                          <td>{item.allocations?.length || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'Invoices' && (
            <div>
              {invoices.length === 0 ? (
                <div className="text-sm text-slate-500">No unpaid invoices available for this dealer.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Due Date</th>
                        <th className="text-right">Total</th>
                        <th className="text-right">Paid</th>
                        <th className="text-right">Remaining</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice._id}>
                          <td className="font-semibold text-slate-900">{invoice.invoiceNumber}</td>
                          <td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}</td>
                          <td className="text-right">{formatCurrency(invoice.grandTotal)}</td>
                          <td className="text-right">{formatCurrency(invoice.paidAmount)}</td>
                          <td className="text-right">{formatCurrency(invoice.remainingBalance)}</td>
                          <td><StatusBadge status={invoice.paymentStatus?.toLowerCase() || 'unpaid'} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'Ledger' && (
            <div>
              {ledger.length === 0 ? (
                <div className="text-sm text-slate-500">No ledger entries found for this dealer.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th className="text-right">Credit</th>
                        <th className="text-right">Balance</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((entry) => (
                        <tr key={entry._id}>
                          <td>{entry.date ? new Date(entry.date).toLocaleDateString() : '—'}</td>
                          <td>{entry.type}</td>
                          <td className="text-right">{entry.credit ? formatCurrency(entry.credit) : '—'}</td>
                          <td className="text-right">{formatCurrency(entry.balance)}</td>
                          <td>{entry.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 font-semibold text-slate-900">{value || '—'}</p>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-b-0 border-slate-200">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm text-slate-900">{value || '—'}</span>
    </div>
  );
}
