const User = require('../models/User');
const jwt = require('jsonwebtoken');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// POST /api/auth/register-admin
exports.registerAdmin = async (req, res) => {
  try {
    const { name, companyName, email, phone, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    if (password !== confirmPassword)
      return res.status(400).json({ success: false, message: 'Passwords do not match' });

    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists)
      return res.status(400).json({ success: false, message: 'Admin account already exists. Please login.' });

    const emailExists = await User.findOne({ email });
    if (emailExists)
      return res.status(400).json({ success: false, message: 'Email already in use' });

    await User.create({ name, companyName, email, phone, password, role: 'admin', isActive: true });
    res.status(201).json({ success: true, message: 'Admin account created. Please login.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/check-admin
exports.checkAdmin = async (req, res) => {
  const adminExists = await User.findOne({ role: 'admin' });
  res.json({ success: true, adminExists: !!adminExists });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    if (role && user.role !== role)
      return res.status(401).json({ success: false, message: `No ${role} account found with this email` });

    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    if (!user.isActive)
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact admin.' });

    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        phone:        user.phone,
        companyName:  user.companyName,
        employeeId:   user.employeeId,
        designation:  user.designation,
        province:     user.province,
        district:     user.district,
        assignedArea: user.assignedArea,
        isActive:     user.isActive,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id, { name, phone }, { new: true }
    ).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both fields required' });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const user = await User.findById(req.user._id);
    if (!(await user.matchPassword(currentPassword)))
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
