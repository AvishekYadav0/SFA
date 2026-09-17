const jwt = require('jsonwebtoken');
const User = require('../models/User');
const MAX_ADMINS = 5;

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

exports.checkAdmin = async (req, res) => {
  try {
    const count = await User.countDocuments({ role: 'admin' });
    res.json({
      success: true,
      adminExists: count > 0,
      adminCount: count,
      adminLimitReached: count >= MAX_ADMINS,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.registerAdmin = async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount >= MAX_ADMINS) {
      return res.status(409).json({ success: false, message: 'The maximum of 3 admin accounts already exists.' });
    }

    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const admin = await User.create({ name, email, password, phone, role: 'admin' });
    const user = admin.toObject();
    delete user.password;
    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    const token = signToken(user._id);
    const userData = user.toObject();
    delete userData.password;
    res.json({ success: true, token, user: userData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
