const jwt = require('jsonwebtoken');
const PlatformAdmin = require('../models/PlatformAdmin');

exports.platformProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Platform admin token is required.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || decoded.accountType !== 'platform_admin') {
      return res.status(401).json({ success: false, message: 'Invalid platform admin token.' });
    }

    const admin = await PlatformAdmin.findById(decoded.id).select('+passwordHash');
    if (!admin || !admin.isActive || admin.accountType !== 'platform_admin') {
      return res.status(403).json({ success: false, message: 'Platform admin access is disabled.' });
    }

    req.platformAdmin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Platform admin authentication failed.' });
  }
};

exports.requirePlatformPermission = (...permissions) => (req, res, next) => {
  const allowed = req.platformAdmin?.permissions || [];
  const missing = permissions.filter(permission => !allowed.includes(permission) && !allowed.includes('all'));
  if (missing.length) {
    return res.status(403).json({ success: false, message: 'You do not have permission for this platform action.' });
  }
  next();
};
