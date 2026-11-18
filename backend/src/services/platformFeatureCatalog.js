const PLATFORM_FEATURES = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'dealers', label: 'Dealers', path: '/dealers' },
  { key: 'dealer_portal', label: 'Dealer Portal', path: '/dealer-portal' },
  { key: 'team_management', label: 'Team Management', path: '/users' },
  { key: 'products', label: 'Products', path: '/products' },
  { key: 'orders', label: 'Orders', path: '/orders' },
  { key: 'pipeline', label: 'Pipeline', path: '/pipeline' },
  { key: 'sales', label: 'Sales', path: '/sales' },
  { key: 'collections', label: 'Collections', path: '/collections' },
  { key: 'collection_plans', label: 'Collection Plans', path: '/collection-plans' },
  { key: 'monthly_planning', label: 'Monthly Planning', path: '/monthly-planning' },
  { key: 'stock_status', label: 'Stock Status', path: '/stock-status' },
  { key: 'daily_visits', label: 'Daily Visits', path: '/daily-visits' },
  { key: 'visits', label: 'Visits', path: '/visits' },
  { key: 'targets', label: 'Targets', path: '/targets' },
  { key: 'reports', label: 'Reports', path: '/reports' },
  { key: 'lifting', label: 'Lifting Plan', path: '/lifting' },
  { key: 'claims', label: 'Claims', path: '/claims' },
  { key: 'notifications', label: 'Notifications', path: '/notifications' },
  { key: 'profile', label: 'Profile', path: '/profile' },
  { key: 'settings', label: 'Settings', path: '/settings' },
  { key: 'database_backup', label: 'Database Backup', path: '/admin/backups' },
];

const BASIC_FEATURES = [
  'dashboard',
  'dealers',
  'team_management',
  'products',
  'orders',
  'sales',
  'collections',
  'notifications',
  'profile',
  'reports',
];

const PRO_FEATURES = PLATFORM_FEATURES.map(({ key }) => key);

const LEGACY_FEATURE_KEYS = {
  basic_reports: ['reports'],
  advanced_reports: ['reports'],
  gps_visit_tracking: ['daily_visits', 'visits'],
  stock_management: ['stock_status'],
  gps: ['daily_visits', 'visits'],
  monthlyPlanning: ['monthly_planning'],
};

function normalizeFeatureKeys(features = []) {
  return [...new Set(features.flatMap((feature) => LEGACY_FEATURE_KEYS[feature] || [feature]))]
    .filter(feature => PLATFORM_FEATURES.some(item => item.key === feature));
}

module.exports = { PLATFORM_FEATURES, BASIC_FEATURES, PRO_FEATURES, normalizeFeatureKeys };
