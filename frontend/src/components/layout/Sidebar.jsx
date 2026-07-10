import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiGrid, FiUsers, FiShoppingBag, FiPackage, FiClipboard,
  FiTruck, FiDollarSign, FiBarChart2, FiUser, FiSettings,
  FiLogOut, FiX, FiTrendingUp
} from 'react-icons/fi';

const navItems = [
  { to: '/dashboard',    icon: FiGrid,       label: 'Dashboard' },
  { to: '/salespersons', icon: FiUsers,       label: 'Sales Persons',    roles: ['admin'] },
  { to: '/dealers',      icon: FiShoppingBag, label: 'Dealers',          roles: ['admin'] },
  { to: '/products',     icon: FiPackage,     label: 'Products',         roles: ['admin'] },
  { to: '/orders',       icon: FiClipboard,   label: 'Order Plan' },
  { to: '/lifting',      icon: FiTruck,       label: 'Lifting Plan' },
  { to: '/collections',  icon: FiDollarSign,  label: 'Collection Plan' },
  { to: '/reports',      icon: FiBarChart2,   label: 'Reports',          roles: ['admin'] },
  { to: '/profile',      icon: FiUser,        label: 'Profile' },
  { to: '/settings',     icon: FiSettings,    label: 'Staff Management', roles: ['admin'] },
];

export const Sidebar = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const filtered = navItems.filter(item => !item.roles || item.roles.includes(user?.role));

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 z-30 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <FiTrendingUp className="text-white text-lg" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white text-sm">SFA System</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sales Force Auto</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <FiX className="text-slate-500" />
          </button>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name}</p>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${user?.role === 'admin' ? 'bg-blue-500' : 'bg-green-500'}`} />
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role}</p>
                {user?.designation && user?.role !== 'admin' && (
                  <p className="text-xs text-slate-400 truncate">· {user.designation}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {filtered.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={onClose}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Icon className="text-lg flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button onClick={handleLogout} className="sidebar-link w-full text-danger hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-danger">
            <FiLogOut className="text-lg" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
