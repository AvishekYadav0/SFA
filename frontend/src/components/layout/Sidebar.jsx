import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiGrid, FiUsers, FiShoppingBag, FiPackage, FiClipboard,
  FiDollarSign, FiBarChart2, FiUser, FiSettings, FiLogOut,
  FiX, FiTrendingUp, FiMapPin, FiBell, FiTarget,
  FiTruck, FiGitMerge, FiShoppingCart, FiHome, FiCalendar, FiLayers
} from 'react-icons/fi';

const NAV = [
  { to: '/dashboard',    icon: FiGrid,        label: 'Dashboard',       roles: ['nsm','rsm','asm','se','so','admin'] },
  { to: '/dealers',      icon: FiShoppingBag, label: 'Dealers',         roles: ['nsm','rsm','asm','se','so','admin'] },
  { to: '/dealer-portal',icon: FiHome,        label: 'My Portal',       roles: ['dealer'] },
  { to: '/users',        icon: FiUsers,       label: 'Team Management', roles: ['nsm','rsm','asm','se','admin'] },
  { to: '/products',     icon: FiPackage,     label: 'Products',        roles: ['nsm','asm','admin'] },
  { to: '/orders',       icon: FiClipboard,   label: 'Orders',          roles: ['nsm','rsm','asm','se','so','admin'] },
  { to: '/pipeline',     icon: FiGitMerge,    label: 'Pipeline',        roles: ['nsm','rsm','asm','admin'] },
  { to: '/sales',        icon: FiShoppingCart,label: 'Sales',           roles: ['nsm','rsm','asm','se','so','admin'] },
  { to: '/collections',  icon: FiDollarSign,  label: 'Collections',    roles: ['nsm','rsm','asm','se','so','admin'] },
  { to: '/collection-plans', icon: FiCalendar,  label: 'Collection Plans', roles: ['nsm','rsm','asm','se','so','admin'] },
  { to: '/monthly-planning', icon: FiCalendar,  label: 'Monthly Planning', roles: ['nsm','rsm','asm','se','so','admin'] },
  { to: '/stock-status', icon: FiLayers,      label: 'Stock Status',    roles: ['nsm','rsm','asm','se','so','dealer','admin'] },
  { to: '/visits',       icon: FiMapPin,      label: 'Visits',          roles: ['nsm','rsm','asm','se','so','admin'] },
  { to: '/targets',      icon: FiTarget,      label: 'Targets',         roles: ['nsm','rsm','asm','se','admin'] },
  { to: '/reports',      icon: FiBarChart2,   label: 'Reports',         roles: ['nsm','rsm','asm','se','admin'] },
  { to: '/lifting',      icon: FiTruck,       label: 'Lifting Plan',    roles: ['so','se','asm','rsm','nsm','admin'] },
  { to: '/notifications',icon: FiBell,        label: 'Notifications',   roles: ['nsm','rsm','asm','se','so','admin'] },
  { to: '/profile',      icon: FiUser,        label: 'Profile',         roles: ['nsm','rsm','asm','se','so','dealer','admin'] },
  { to: '/settings',     icon: FiSettings,    label: 'Settings',        roles: ['nsm','admin'] },
];

const ROLE_COLORS = {
  nsm:    'bg-purple-600',
  rsm:    'bg-blue-600',
  asm:    'bg-green-600',
  se:     'bg-orange-500',
  so:     'bg-yellow-500',
  dealer: 'bg-teal-600',
  admin:  'bg-red-600',
};

const ROLE_LABELS = {
  nsm:    'National Sales Manager',
  rsm:    'Regional Sales Manager',
  asm:    'Area Sales Manager',
  se:     'Sales Executive',
  so:     'Sales Officer',
  dealer: 'Dealer',
  admin:  'Administrator',
};

export const Sidebar = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };
  const filtered = NAV.filter(item => !item.roles || item.roles.includes(user?.role));

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 z-30 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <FiTrendingUp className="text-white text-lg" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white text-sm">SFA System</h1>
              <p className="text-xs text-slate-500">Sales Force Auto</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <FiX className="text-slate-500" />
          </button>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <div className={`w-10 h-10 ${ROLE_COLORS[user?.role] || 'bg-slate-500'} rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{ROLE_LABELS[user?.role] || user?.role}</p>
              {user?.employeeId && <p className="text-xs text-slate-400">{user.employeeId}</p>}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
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
          <button onClick={handleLogout} className="sidebar-link w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
            <FiLogOut className="text-lg" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
