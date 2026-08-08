import { useState, useEffect } from 'react';
import { FiMenu, FiSun, FiMoon, FiBell } from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services';

const TITLES = {
  '/dashboard':    'Dashboard',
  '/users':        'Team Management',
  '/dealers':      'Dealers',
  '/products':     'Products',
  '/orders':       'Orders',
  '/pipeline':     'Sales Pipeline',
  '/sales':        'Sales',
  '/collections':  'Collections',
  '/visits':       'Visits',
  '/targets':      'Targets',
  '/reports':      'Reports',
  '/lifting':      'Lifting Plan',
  '/notifications':'Notifications',
  '/profile':      'Profile',
  '/settings':     'Settings',
};

const ROLE_BADGE = {
  nsm:   { label: '🏆 NSM',   cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  rsm:   { label: '📊 RSM',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  asm:   { label: '🎯 ASM',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  se:    { label: '👤 SE',    cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  so:    { label: '🔖 SO',    cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  admin: { label: '⚡ Admin', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export const Header = ({ onMenuClick }) => {
  const { dark, toggle } = useTheme();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  const title = TITLES[pathname] || 'SFA System';
  const badge = ROLE_BADGE[user?.role];

  useEffect(() => {
    notificationService.getAll({ read: false, limit: 1 })
      .then(r => setUnread(r.data?.total || 0))
      .catch(() => {});
  }, [pathname]);

  return (
    <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
          <FiMenu className="text-slate-600 dark:text-slate-400" />
        </button>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        )}
        <button onClick={() => navigate('/notifications')} className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
          <FiBell className="text-slate-600 dark:text-slate-400" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        <button onClick={toggle} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
          {dark ? <FiSun className="text-yellow-500" /> : <FiMoon className="text-slate-600 dark:text-slate-400" />}
        </button>
      </div>
    </header>
  );
};
