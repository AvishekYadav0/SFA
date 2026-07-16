import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { orderService, liftingService, collectionService, salespersonService } from '../services';
import { formatCurrency, formatDate, StatusBadge } from '../components/common/index.jsx';
import { Skeleton } from '../components/common/Spinner';
import {
  FiClipboard, FiTruck, FiDollarSign, FiPlus,
  FiUser, FiMapPin, FiBriefcase, FiAlertCircle, FiUsers
} from 'react-icons/fi';

const QuickCard = ({ icon: Icon, label, count, color, bg, onClick }) => (
  <button onClick={onClick}
    className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer text-left w-full">
    <div className={`p-3 rounded-2xl ${bg}`}>
      <Icon className={`text-2xl ${color}`} />
    </div>
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{count}</p>
    </div>
  </button>
);

export default function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ orders: 0, lifting: 0, collections: 0, pendingOrders: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      orderService.getAll({ limit: 5 }),
      liftingService.getAll({ limit: 1 }),
      collectionService.getAll({ limit: 1 }),
      salespersonService.getAll({ limit: 1000 }),
    ]).then(([ordersRes, liftingRes, collRes, spRes]) => {
      const orders = ordersRes.data.data || [];
      setRecentOrders(orders.slice(0, 5));
      setSalespersons(spRes.data.data || []);
      setStats({
        orders: ordersRes.data.total || 0,
        lifting: liftingRes.data.total || 0,
        collections: collRes.data.total || 0,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563EB 50%, #3b82f6 100%)' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold">Welcome back, {user?.name}!</h1>
            <div className="flex flex-wrap gap-3 mt-1.5 text-blue-100 text-sm">
              {user?.designation && (
                <span className="flex items-center gap-1"><FiBriefcase size={13} />{user.designation}</span>
              )}
              {(user?.assignedArea || user?.province) && (
                <span className="flex items-center gap-1"><FiMapPin size={13} />{user.assignedArea || user.province}</span>
              )}
              {user?.employeeId && (
                <span className="flex items-center gap-1"><FiUser size={13} />ID: {user.employeeId}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickCard icon={FiClipboard} label="My Orders" count={stats.orders}
          color="text-white" bg="bg-blue-600" onClick={() => navigate('/orders')} />
        <QuickCard icon={FiTruck} label="Lifting Plans" count={stats.lifting}
          color="text-white" bg="bg-indigo-500" onClick={() => navigate('/lifting')} />
        <QuickCard icon={FiDollarSign} label="Collection Plans" count={stats.collections}
          color="text-white" bg="bg-emerald-500" onClick={() => navigate('/collections')} />
        <QuickCard icon={FiUsers} label="My Salespersons" count={salespersons.length}
          color="text-white" bg="bg-violet-500" onClick={() => navigate('/salespersons')} />
      </div>

      {/* Pending alert */}
      {stats.pendingOrders > 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl">
          <FiAlertCircle className="text-yellow-600 text-xl flex-shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You have <strong>{stats.pendingOrders}</strong> pending order{stats.pendingOrders > 1 ? 's' : ''} awaiting admin approval.
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Create Order Plan', icon: FiClipboard, to: '/orders', color: 'bg-blue-600 hover:bg-blue-700' },
            { label: 'Create Lifting Plan', icon: FiTruck, to: '/lifting', color: 'bg-indigo-600 hover:bg-indigo-700' },
            { label: 'Create Collection Plan', icon: FiDollarSign, to: '/collections', color: 'bg-emerald-600 hover:bg-emerald-700' },
          ].map(({ label, icon: Icon, to, color }) => (
            <button key={to} onClick={() => navigate(to)}
              className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-white font-medium text-sm transition-colors ${color}`}>
              <FiPlus className="text-lg" />
              <Icon className="text-lg" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div className="card p-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Recent Orders</h2>
          <button onClick={() => navigate('/orders')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <FiClipboard className="text-4xl mb-3" />
            <p className="text-sm">No orders yet.</p>
            <button onClick={() => navigate('/orders')} className="btn-primary mt-4 text-sm">
              <FiPlus /> Create First Order
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Dealer</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o._id}>
                    <td className="font-bold text-blue-600">{o.orderNumber}</td>
                    <td className="text-xs text-slate-500">{formatDate(o.date)}</td>
                    <td>{o.dealer?.dealerName || '—'}</td>
                    <td className="font-medium">{formatCurrency(o.grandTotal)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Salespersons */}
      <div className="card p-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">My Salespersons</h2>
            <p className="text-xs text-slate-500 mt-0.5">{salespersons.length} assigned to your province</p>
          </div>
          <button onClick={() => navigate('/salespersons')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View all →</button>
        </div>
        {salespersons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <FiUsers className="text-4xl mb-2 opacity-40" />
            <p className="text-sm">No salespersons assigned to your province yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Employee ID</th><th>Full Name</th><th>Phone</th><th>Area</th><th>Designation</th><th>Status</th></tr>
              </thead>
              <tbody>
                {salespersons.slice(0, 5).map(sp => (
                  <tr key={sp._id}>
                    <td className="font-medium text-blue-600">{sp.employeeId}</td>
                    <td className="font-medium">{sp.fullName}</td>
                    <td className="text-slate-500">{sp.phone}</td>
                    <td className="text-slate-500">{sp.area}</td>
                    <td><span className="badge-info">{sp.designation}</span></td>
                    <td><StatusBadge status={sp.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {salespersons.length > 5 && (
              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => navigate('/salespersons')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  +{salespersons.length - 5} more salespersons →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Permissions info */}
      <div className="card bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Your Access Level</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {[
            { label: 'Create & manage Order Plans', allowed: true },
            { label: 'Create & manage Lifting Plans', allowed: true },
            { label: 'Create & manage Collection Plans', allowed: true },
            { label: 'Edit pending records', allowed: true },
            { label: 'View Reports', allowed: false },
            { label: 'Manage Products / Dealers', allowed: false },
            { label: 'User Management', allowed: false },
            { label: 'Approve / Reject Orders', allowed: false },
          ].map(({ label, allowed }) => (
            <div key={label} className={`flex items-center gap-2 ${allowed ? 'text-green-700 dark:text-green-400' : 'text-slate-400'}`}>
              <span className="text-base">{allowed ? '✓' : '✗'}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
