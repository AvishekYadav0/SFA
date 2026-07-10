import { FiMenu, FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const titles = {
  '/dashboard':    'Dashboard',
  '/salespersons': 'Sales Persons',
  '/dealers':      'Dealers',
  '/products':     'Products',
  '/orders':       'Order Plans',
  '/lifting':      'Lifting Plans',
  '/collections':  'Collection Plans',
  '/reports':      'Reports',
  '/profile':      'Profile',
  '/settings':     'Staff Management',
};

export const Header = ({ onMenuClick }) => {
  const { dark, toggle } = useTheme();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const title = titles[pathname] || 'SFA System';

  return (
    <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
          <FiMenu className="text-slate-600 dark:text-slate-400" />
        </button>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        {/* Role badge */}
        <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          user?.role === 'admin'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        }`}>
          {user?.role === 'admin' ? '⚡ Admin' : '👤 Staff'}
        </span>
        <button onClick={toggle} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
          {dark ? <FiSun className="text-yellow-500" /> : <FiMoon className="text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
