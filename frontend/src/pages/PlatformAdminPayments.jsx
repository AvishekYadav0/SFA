import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, Plus, RefreshCw, TrendingUp, X } from 'lucide-react';
import { platformAdminApi } from '../services/platformAdminApi';

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export default function PlatformAdminPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [recordError, setRecordError] = useState('');
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({
    companyId: '',
    planCode: '',
    amount: '',
    currency: 'INR',
    paymentMethod: 'Bank transfer',
    transactionReference: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await platformAdminApi.getPayments();
      setPayments(Array.isArray(data.data) ? data.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load payment records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openRecordForm = async () => {
    setRecordOpen(true);
    setRecordError('');
    setRecordLoading(true);
    try {
      const [companyResponse, plansResponse] = await Promise.all([
        platformAdminApi.getCompanies(),
        platformAdminApi.getPlans(),
      ]);
      const companyRows = Array.isArray(companyResponse.data.data) ? companyResponse.data.data : [];
      const planRows = Array.isArray(plansResponse.data.data) ? plansResponse.data.data : [];
      setCompanies(companyRows);
      setPlans(planRows);
      const initialPlan = planRows[0];
      setForm((current) => ({
        ...current,
        companyId: companyRows[0]?._id || '',
        planCode: initialPlan?.code || '',
        amount: initialPlan?.price == null ? '' : String(initialPlan.price),
        currency: initialPlan?.currency || 'INR',
      }));
    } catch (requestError) {
      setRecordError(requestError.response?.data?.message || 'Unable to load companies and plans.');
    } finally {
      setRecordLoading(false);
    }
  };

  const recordPayment = async (event) => {
    event.preventDefault();
    const company = companies.find((item) => item._id === form.companyId);
    if (!company || !form.planCode) {
      setRecordError('Select a company and subscription plan.');
      return;
    }
    setRecordSaving(true);
    setRecordError('');
    try {
      await platformAdminApi.recordManualPayment({
        ...form,
        amount: Number(form.amount),
      });
      setRecordOpen(false);
      setMessage(`Payment recorded as pending for ${company.name}. Verify it only after confirming the funds were received.`);
      await load();
    } catch (requestError) {
      setRecordError(requestError.response?.data?.message || 'Unable to record the payment.');
    } finally {
      setRecordSaving(false);
    }
  };

  const verifyPayment = async (payment) => {
    const companyName = payment.company?.name || 'this company';
    if (!window.confirm(`Confirm that ${payment.currency || 'INR'} ${Number(payment.amount || 0).toLocaleString()} was received from ${companyName}? This will activate or renew its subscription.`)) return;
    setMessage('');
    setError('');
    try {
      await platformAdminApi.verifyManualPayment(payment._id);
      setMessage(`Payment verified. ${companyName}'s subscription is active.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to verify the payment.');
    }
  };

  const paidPayments = payments.filter((payment) => payment.paymentStatus === 'paid');
  const totalRevenue = paidPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidCount = paidPayments.length;
  const pendingCount = payments.filter((payment) => payment.paymentStatus === 'pending').length;
  const failedCount = payments.filter((payment) => payment.paymentStatus === 'failed').length;
  const currency = paidPayments[0]?.currency || payments[0]?.currency || 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Platform</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Payments & Billing</h1><p className="mt-1 text-sm text-slate-500">Verified records from the subscription payment collection.</p></div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200"><TrendingUp className="h-4 w-4" />{currency} {totalRevenue.toLocaleString()}</div>
          <button type="button" onClick={openRecordForm} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Record payment</button>
          <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Refresh</button>
        </div>
      </div>

      {message && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Paid Revenue', value: `${currency} ${totalRevenue.toLocaleString()}` },
          { label: 'Paid Payments', value: paidCount },
          { label: 'Pending Payments', value: pendingCount },
          { label: 'Failed Payments', value: failedCount },
        ].map((stat) => <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-slate-500"><span className="text-sm">{stat.label}</span><CreditCard className="h-4 w-4" /></div><p className="mt-4 text-2xl font-bold text-slate-900">{stat.value}</p></div>)}
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-red-700 shadow-sm"><div className="flex items-center gap-2"><AlertCircle className="h-5 w-5" />{error}</div><button type="button" onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium hover:bg-red-100"><RefreshCw className="h-4 w-4" />Retry</button></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr>{['Company', 'Plan', 'Amount', 'Reference', 'Method', 'Date', 'Status', 'Action'].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td className="px-4 py-10 text-center text-slate-500" colSpan="8">Loading payment data...</td></tr> : payments.length ? payments.map((payment) => (
              <tr key={payment._id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{payment.company?.name || 'Company unavailable'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{payment.planName || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{payment.currency || 'INR'} {Number(payment.amount || 0).toLocaleString()}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{payment.transactionReference || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{payment.paymentMethod || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(payment.paidAt || payment.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${payment.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : payment.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{payment.paymentStatus}</span></td>
                <td className="whitespace-nowrap px-4 py-3">{payment.paymentStatus === 'pending' ? <button type="button" onClick={() => verifyPayment(payment)} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700"><CheckCircle2 className="h-3.5 w-3.5" />Verify & activate</button> : <span className="text-xs text-slate-400">—</span>}</td>
              </tr>
            )) : <tr><td className="px-4 py-12 text-center text-slate-500" colSpan="8">No payment records exist in the database.</td></tr>}</tbody>
          </table></div>
        </div>
      )}

      {recordOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <form onSubmit={recordPayment} className="max-h-[95vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-xl font-semibold text-slate-900">Record offline payment</h2><p className="mt-1 text-sm text-slate-500">The payment stays pending until you verify receipt. No online payment is assumed.</p></div>
              <button type="button" onClick={() => setRecordOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            {recordError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{recordError}</div>}
            {recordLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading companies and plans...</p> : (
              <>
                <label className="block text-sm font-medium text-slate-700">Company
                  <select required value={form.companyId} onChange={(event) => setForm((current) => ({ ...current, companyId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5">
                    <option value="">Select a company</option>
                    {companies.map((company) => <option key={company._id} value={company._id}>{company.name} ({company.email})</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">Plan
                  <select required value={form.planCode} onChange={(event) => {
                    const selected = plans.find((plan) => plan.code === event.target.value);
                    setForm((current) => ({ ...current, planCode: event.target.value, amount: selected ? String(selected.price) : current.amount, currency: selected?.currency || current.currency }));
                  }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5">
                    <option value="">Select a plan</option>
                    {plans.filter((plan) => plan.isActive).map((plan) => <option key={plan._id} value={plan.code}>{plan.name} · {plan.currency} {Number(plan.price || 0).toLocaleString()}</option>)}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">Amount
                    <input required type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Currency
                    <input required maxLength="8" value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">Payment method
                    <select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5">
                      {['Bank transfer', 'Cash', 'Cheque', 'Other'].map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Transaction reference
                    <input maxLength="160" value={form.transactionReference} onChange={(event) => setForm((current) => ({ ...current, transactionReference: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" placeholder="Optional" />
                  </label>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                  <button type="button" disabled={recordSaving} onClick={() => setRecordOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">Cancel</button>
                  <button type="submit" disabled={recordSaving || recordLoading || !companies.length || !plans.length} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">{recordSaving ? 'Recording...' : 'Record as pending'}</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
