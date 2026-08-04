const User = require('../models/User');
const { ROLES } = require('../models/User');

// GET /api/users
// admin/nsm → all users | rsm → province | asm → province+area | se/dealer → only self
exports.getUsers = async (req, res) => {
  try {
    const { role, province, area, _id } = req.user;
    let filter = {};

    if (role === 'rsm')                    filter = { province };
    else if (role === 'asm')               filter = { province, area };
    else if (role === 'se' || role === 'dealer') filter = { _id };

    // Allow filtering by role query param (admin only)
    if (role === 'admin' && req.query.role) filter.role = req.query.role;

    const users = await User.find(filter).select('-password').sort('-createdAt');
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users/create-staff
exports.createStaff = async (req, res) => {
  try {
    const { name, email, password, phone, province, area, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const assignedRole = role && ROLES.includes(role) && role !== 'admin' ? role : 'se';

    // RSM/ASM can only create roles below themselves
    const callerIdx = ROLES.indexOf(req.user.role);
    const newIdx    = ROLES.indexOf(assignedRole);
    if (newIdx >= callerIdx && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Cannot create a user with equal or higher role' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const user = await User.create({
      name, email, password, phone,
      province: province || null,
      area:     area     || null,
      role:     assignedRole,
      isActive: true,
      createdBy: req.user._id,
    });
    res.status(201).json({
      success: true,
      message: 'Staff account created successfully',
      data: { ...user.toObject(), password: undefined },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, province, area, role } = req.body;
    const updateData = { name, email, phone, province: province || null, area: area || null };
    if (role && ROLES.includes(role) && role !== 'admin') updateData.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin account' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Staff account deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/status
exports.toggleStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot deactivate admin' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, message: `Account ${user.isActive ? 'activated' : 'deactivated'}`, data: { isActive: user.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/users/:id/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot reset admin password here' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
