import { useEffect, useState } from 'react';
import { dealerPortalService } from '../services';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/common/Spinner';
import { FiUser, FiPhone, FiMapPin, FiCreditCard, FiShoppingBag, FiDollarSign, FiFileText, FiAlertCircle, FiTrendingUp, FiClock, FiPackage } from 'react-icons/fi';

const fmt = (n) => new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 0 }).format(n || 0);
const fmtN = (n) => new Intl.NumberFormat('en-NP').format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NP') : '—';

const STATUS_COLORS = {
  pending:    'bg-amber-100 text-amber-700',
  approved:   'bg-green-100 text-green-700',
  delivered:  'bg-teal-100 text-teal-700',
  completed:  'bg-blue-100 text-blue-700',
  cancelled:  'bg-red-100 text-red-700',
  dispatched: 'bg-purple-100 text-purple-700',
  packed:     'bg-indigo-100 text-indigo-700',
  draft:      'bg-slate-100 text-slate-600',
  verified:   'bg-green-100 text-green-700',
  rejected:   'bg-red-100 text-red-700',
};

const Badge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
    {status}
  </span>
);

const KPI = ({ icon: Icon, label, value, color = 'blue', sub }) => (
  <div className="card p-5 flex items-start gap-4">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-${color}-100 dark:bg-${color}-900/30`}>
      <Icon className={`text-lg text-${color}-600 dark:text-${color}-400`} />
    </div>
    <div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const TABS = ['Orders', 'Stock', 'Payments'];

export default function DealerPortal() {
  const { user } = useAuth();
  const [summary, setSummary]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [orders, setOrders]     = useState([]);
  const [payments, setPayments] = useState([]);
  const [stock, setStock]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [tab, setTab]           = useState('Orders');

  useEffect(() => {
    Promise.all([
      dealerPortalService.getSummary(),
      dealerPortalService.getProfile(),
      dealerPortalService.getOrders({ limit: 50 }),
      dealerPortalService.getPayments({ limit: 50 }),
      dealerPortalService.getStock(),
    ])
      .then(([s, p, o, pay, st]) => {
        setSummary(s.data.data);
        setProfile(p.data.data);
        setOrders(o.data.data || []);
        setPayments(pay.data.data || []);
        setStock(st.data.data || []);
      })
      .catch(e => setError(e.response?.data?.message || 'Failed to load portal. Ask your admin to link your account to a dealer.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  if (error) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <FiAlertCircle className="text-4xl text-red-400" />
      <p className="text-sm text-red-500 font-medium">{error}</p>
      <p className="text-xs text-slate-400">Contact your admin to link a dealer profile to your account.</p>
    </div>
  );

  const creditPct = summary.creditLimit > 0
    ? Math.min(100, Math.round((summary.outstandingBalance / summary.creditLimit) * 100))
    : 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{profile.dealerName}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Dealer Portal · Welcome, {user?.name}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KPI icon={FiAlertCircle}  label="Outstanding Balance" value={fmt(summary.outstandingBalance)} color="red" />
        <KPI icon={FiCreditCard}   label="Available Credit"    value={fmt(summary.availableCredit)}    color="green" />
        <KPI icon={FiTrendingUp}   label="Monthly Purchase"    value={fmt(summary.monthlyPurchase)}    color="blue" />
        <KPI icon={FiTrendingUp}   label="Yearly Purchase"     value={fmt(summary.yearlyPurchase)}     color="purple" />
        <KPI icon={FiShoppingBag}  label="Total Orders"        value={summary.totalOrders}             color="orange" />
        <KPI icon={FiClock}        label="Pending Orders"      value={summary.pendingOrders}           color="yellow" />
        <KPI icon={FiDollarSign}   label="Total Paid"          value={fmt(summary.totalPaid)}          color="teal" />
        <KPI icon={FiPackage}      label="Products in Stock"   value={stock.filter(r => r.closingStock > 0).length} color="blue" sub={`${stock.reduce((s,r) => s + (r.closingStock||0), 0)} total units`} />
      </div>

      {/* Credit utilisation */}
      {summary.creditLimit > 0 && (
        <div className="card p-5">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium">Credit Utilisation</span>
            <span>{creditPct}% of {fmt(summary.creditLimit)}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${creditPct >= 100 ? 'bg-red-500' : creditPct >= 80 ? 'bg-amber-400' : 'bg-green-500'}`}
              style={{ width: `${creditPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Profile info */}
      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <InfoRow icon={FiUser}     label="Owner"       value={profile.ownerName} />
        <InfoRow icon={FiPhone}    label="Phone"       value={profile.phone} />
        <InfoRow icon={FiMapPin}   label="Address"     value={[profile.address, profile.area, profile.district, profile.province].filter(Boolean).join(', ')} />
        <InfoRow icon={FiFileText} label="PAN Number"  value={profile.panNumber} />
        <InfoRow icon={FiFileText} label="VAT Number"  value={profile.vatNumber} />
        <InfoRow icon={FiUser}     label="Sales Executive" value={profile.se?.name} sub={profile.se?.phone} />
      </div>

      {/* Tabs */}
      <div className="card p-0">
        <div className="flex border-b border-slate-100 dark:border-slate-700">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t}
              <span className="ml-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">
                {t === 'Orders' ? orders.length : t === 'Stock' ? stock.length : payments.length}
              </span>
            </button>
          ))}
        </div>

        {tab === 'Orders' && (
          orders.length === 0
            ? <Empty icon={FiShoppingBag} msg="No orders yet." />
            : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Order #</th><th>Date</th><th>Amount</th><th>Payment</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o._id}>
                        <td className="font-medium text-primary-600">{o.orderNumber}</td>
                        <td>{fmtDate(o.date)}</td>
                        <td className="font-semibold">{fmt(o.grandTotal)}</td>
                        <td className="capitalize text-slate-500 text-xs">{o.paymentType}</td>
                        <td><Badge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}

        {tab === 'Stock' && (
          stock.length === 0
            ? <Empty icon={FiPackage} msg="No stock data available yet." />
            : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th className="text-right">Opening</th>
                      <th className="text-right">Dispatch</th>
                      <th className="text-right">Sales</th>
                      <th className="text-right">Closing</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((row, i) => {
                      const statusColor =
                        row.stockStatus === 'Healthy'      ? 'bg-green-100 text-green-700' :
                        row.stockStatus === 'Low Stock'    ? 'bg-orange-100 text-orange-700' :
                                                             'bg-red-100 text-red-700';
                      return (
                        <tr key={String(row.productId)}>
                          <td className="text-slate-400 text-xs">{i + 1}</td>
                          <td className="font-medium">{row.productName || '—'}</td>
                          <td className="text-right text-slate-600">{fmtN(row.openingStock)}</td>
                          <td className="text-right text-slate-600">{fmtN(row.companyDispatch)}</td>
                          <td className="text-right text-green-600 font-medium">{fmtN(row.dealerSales)}</td>
                          <td className="text-right font-bold text-blue-600">{fmtN(row.closingStock)}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
                              {row.stockStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 font-bold text-sm">
                      <td colSpan={2} className="px-4 py-2.5 text-slate-600 dark:text-slate-300">TOTAL</td>
                      <td className="px-4 py-2.5 text-right">{fmtN(stock.reduce((s, r) => s + (r.openingStock || 0), 0))}</td>
                      <td className="px-4 py-2.5 text-right">{fmtN(stock.reduce((s, r) => s + (r.companyDispatch || 0), 0))}</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{fmtN(stock.reduce((s, r) => s + (r.dealerSales || 0), 0))}</td>
                      <td className="px-4 py-2.5 text-right text-blue-600">{fmtN(stock.reduce((s, r) => s + (r.closingStock || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
        )}

        {tab === 'Payments' && (
          payments.length === 0
            ? <Empty icon={FiDollarSign} msg="No payment records yet." />
            : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Collection #</th><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p._id}>
                        <td className="font-medium text-primary-600">{p.collectionNumber}</td>
                        <td>{fmtDate(p.date)}</td>
                        <td className="font-semibold text-green-600">{fmt(p.amount)}</td>
                        <td className="capitalize text-slate-500 text-xs">{p.paymentType}</td>
                        <td className="text-slate-400 text-xs">{p.referenceNo || '—'}</td>
                        <td><Badge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="text-slate-500 text-sm" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm text-slate-900 dark:text-white font-medium">{value || '—'}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, msg }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <Icon className="text-3xl mb-2 opacity-40" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}
