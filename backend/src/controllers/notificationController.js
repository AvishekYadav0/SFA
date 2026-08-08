const Notification = require('../models/Notification');

exports.getAll = async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.unread === 'true') filter.read = false;
    const data = await Notification.find(filter).sort('-createdAt').limit(50).lean();
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ success: true, data, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    if (req.params.id === 'all') {
      await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    } else {
      await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { read: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const data = await Notification.create({ ...req.body });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteOne = async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper: push notification to a user (used internally)
exports.push = async (userId, type, title, message, link = null, data = {}) => {
  try {
    await Notification.create({ userId, type, title, message, link, data });
  } catch (_) {}
};
