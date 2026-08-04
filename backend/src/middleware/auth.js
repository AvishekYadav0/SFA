const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ── Token verification ────────────────────────────────────────────────────────
exports.authenticateUser = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user)
      return res.status(401).json({ success: false, message: 'User not found' });
    if (!user.isActive)
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact admin.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

exports.protect = exports.authenticateUser;

// ── Role-based gate ───────────────────────────────────────────────────────────
// Usage: authorize('admin', 'nsm')  — pass allowed roles
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: 'Access denied' });
  next();
};

exports.authorizeAdmin = exports.authorize('admin');
exports.authorizeStaff = exports.authorize('admin', 'nsm', 'rsm', 'asm', 'se', 'dealer');

// ── Hierarchical data-scope filter ───────────────────────────────────────────
// Returns a MongoDB filter object that restricts queries to the caller's scope.
// Attach to any collection that has `province`, `area`, `staffId`, `assignedTo`.
//
//  admin / nsm  → no restriction (see everything)
//  rsm          → filter by province
//  asm          → filter by province + area
//  se           → filter by staffId (their own records)
//  dealer       → filter by staffId (their own records only)
//
// Pass `dealerIdField` when the collection stores the dealer's _id instead of
// staffId (e.g. Dealer collection itself uses `_id`, not `staffId`).
exports.scopeFilter = (req, { dealerMode = false } = {}) => {
  const { role, province, area, _id } = req.user;

  switch (role) {
    case 'admin':
    case 'nsm':
      return {};                                    // full access

    case 'rsm':
      return { province };                          // province only

    case 'asm':
      return { province, area };                    // province + area

    case 'se':
      return dealerMode
        ? { assignedTo: _id }                       // dealers assigned to this SE
        : { staffId: _id };                         // own records

    case 'dealer':
      return dealerMode
        ? { assignedTo: _id }
        : { staffId: _id };

    default:
      return { _id: null };                         // deny-all fallback
  }
};
