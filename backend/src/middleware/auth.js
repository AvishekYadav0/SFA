const jwt  = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found' });
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid' });
  }
};

exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  next();
};

/**
 * scopeFilter — MongoDB filter for Order / Collection / Visit / Dealer documents.
 *
 * Hierarchy stored on every document:
 *   nsm | rsm | asm | se | so (array on Dealer, ObjectId on Order/Collection/Visit)
 *
 * For Dealer, `so` is an array field → use $elemMatch / $in.
 * Pass `model = 'dealer'` when querying the Dealer collection.
 */
exports.scopeFilter = (req, model = 'default') => {
  const { role, _id } = req.user;

  if (role === 'admin') return {};
  if (role === 'nsm') return { nsm: _id };
  if (role === 'rsm') return { rsm: _id };
  if (role === 'asm') return { asm: _id };
  if (role === 'se')  return { se:  _id };

  if (role === 'so') {
    if (model === 'dealer') return { so: _id };
    return { so: _id };
  }

  // Dealer role: scope to their linked dealer document
  if (role === 'dealer') {
    const dealerId = req.user.linkedDealer;
    if (!dealerId) return { _id: null };
    if (model === 'dealer') return { _id: dealerId };
    return { dealer: dealerId };
  }

  return { _id: null }; // deny-all fallback
};

/**
 * userScopeFilter — MongoDB filter for the User collection.
 *
 * User model hierarchy fields: reportsTo, nsm, rsm, asm
 * SE's subordinates (SO) have reportsTo = se._id
 * SO has no subordinates in the user tree
 */
exports.userScopeFilter = (req) => {
  const { role, _id } = req.user;

  if (role === 'admin') return { role: { $ne: 'admin' } };
  if (role === 'nsm')   return { role: { $ne: 'admin' }, $or: [{ nsm: _id }, { _id }] };
  // rsm/asm: match stamped hierarchy field OR direct reportsTo
  // (stamped rsm/asm covers full chain for properly-created users;
  //  reportsTo covers direct reports; both together handle all cases)
  if (role === 'rsm')   return { role: { $ne: 'admin' }, $or: [{ rsm: _id }, { reportsTo: _id }] };
  if (role === 'asm')   return { role: { $ne: 'admin' }, $or: [{ asm: _id }, { reportsTo: _id }] };
  if (role === 'se')    return { reportsTo: _id };
  if (role === 'so')    return { _id };
  if (role === 'dealer') return { _id: null };

  return { _id: null };
};

/**
 * hierarchyFields — given the creating user, return the full hierarchy
 * object to stamp onto a new Order / Collection / Visit document.
 *
 * Works for both SE and SO creators.
 */
exports.hierarchyFields = async (creatingUser) => {
  const User = require('../models/User');
  const { role, _id, asm, rsm, nsm, reportsTo } = creatingUser;

  if (role === 'se') {
    return { se: _id, asm, rsm, nsm };
  }

  if (role === 'so') {
    // SO reports to an SE; load that SE to get the full chain
    const se = reportsTo ? await User.findById(reportsTo).lean() : null;
    return {
      so:  _id,
      se:  se?._id  || null,
      asm: se?.asm   || null,
      rsm: se?.rsm   || null,
      nsm: se?.nsm   || null,
    };
  }

  // Admin / NSM / RSM / ASM creating on behalf of someone — caller must supply se
  return {};
};
