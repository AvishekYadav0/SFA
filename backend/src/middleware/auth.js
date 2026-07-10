const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.authenticateUser = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user)
      return res.status(401).json({ success: false, message: 'User not found' });
    if (!req.user.isActive)
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact admin.' });
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

exports.authorizeAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
};

exports.authorizeStaff = (req, res, next) => {
  if (!['admin', 'staff'].includes(req.user?.role))
    return res.status(403).json({ success: false, message: 'Access denied' });
  next();
};

// Keep backward compat alias
exports.protect = exports.authenticateUser;
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ success: false, message: 'Access denied' });
  next();
};
