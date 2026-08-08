const User = require('../models/User');
const { userScopeFilter } = require('../middleware/auth');

exports.getAll = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Base scope — enforces hierarchy visibility
    const scopeBase = userScopeFilter(req);
    const filter = { ...scopeBase };

    // Admin/NSM: exclude admin accounts from list
    if (!filter.role) filter.role = { $ne: 'admin' };

    // Optional role filter — merge safely without overwriting $or scope
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const searchOr = [
        { name:       new RegExp(req.query.search, 'i') },
        { email:      new RegExp(req.query.search, 'i') },
        { employeeId: new RegExp(req.query.search, 'i') },
      ];
      // Preserve existing $or from scope filter by wrapping in $and
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }
    if (req.query.asm) filter.asm = req.query.asm;
    if (req.query.rsm) filter.rsm = req.query.rsm;

    const total = await User.countDocuments(filter);
    const data  = await User.find(filter)
      .populate('reportsTo', 'name role')
      .populate('asm', 'name')
      .populate('rsm', 'name')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit);

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const data = await User.findById(req.params.id)
      .populate('reportsTo asm rsm nsm', 'name role');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    // Auto-populate hierarchy refs when creating a user
    const body = { ...req.body, createdBy: req.user._id };

    // Auto-stamp hierarchy refs based on reportsTo chain
    if (body.reportsTo) {
      const parent = await User.findById(body.reportsTo).lean();
      if (parent) {
        if (parent.role === 'nsm') {
          body.nsm = parent._id;
        } else if (parent.role === 'rsm') {
          body.rsm = parent._id;
          body.nsm = parent.nsm;
        } else if (parent.role === 'asm') {
          body.asm = parent._id;
          body.rsm = parent.rsm;
          body.nsm = parent.nsm;
        } else if (parent.role === 'se') {
          body.asm = parent.asm;
          body.rsm = parent.rsm;
          body.nsm = parent.nsm;
        } else if (parent.role === 'so') {
          body.asm = parent.asm;
          body.rsm = parent.rsm;
          body.nsm = parent.nsm;
        }
      }
    }

    const data = await User.create(body);
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const { password, ...rest } = req.body;

    // Re-stamp hierarchy refs if reportsTo changed
    if (rest.reportsTo) {
      const parent = await User.findById(rest.reportsTo).lean();
      if (parent) {
        if (parent.role === 'nsm') {
          rest.nsm = parent._id; rest.rsm = null; rest.asm = null;
        } else if (parent.role === 'rsm') {
          rest.rsm = parent._id; rest.nsm = parent.nsm; rest.asm = null;
        } else if (parent.role === 'asm') {
          rest.asm = parent._id; rest.rsm = parent.rsm; rest.nsm = parent.nsm;
        } else if (parent.role === 'se' || parent.role === 'so') {
          rest.asm = parent.asm; rest.rsm = parent.rsm; rest.nsm = parent.nsm;
        }
      }
    }

    const data = await User.findByIdAndUpdate(req.params.id, rest, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getSubordinates = async (req, res) => {
  try {
    const { role, _id } = req.user;
    let filter = {};
    if (role === 'rsm')        filter = { rsm: _id };
    else if (role === 'asm')   filter = { asm: _id };
    else if (role === 'se')    filter = { reportsTo: _id };
    else if (role === 'so')    filter = { _id: null };
    const data = await User.find(filter).select('-password');
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.toggleStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    user.status = user.status === 'active' ? 'inactive' : 'active';
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, message: `User ${user.status}`, data: user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'Not found' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
