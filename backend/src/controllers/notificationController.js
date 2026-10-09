const Notification = require('../models/Notification');

exports.getAll = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.unread === 'true' || req.query.read === 'false') filter.read = false;
    if (req.query.read === 'true') filter.read = true;
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
    const [data, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort('-createdAt').limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ success: true, data, total, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    if (req.params.id === 'all') {
      await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    } else {
      await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, message, type, link } = req.body;
    const data = await Notification.create({
      user: req.user._id,
      title,
      message,
      type,
      link,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteOne = async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper: push notification to a user (used internally)
exports.push = async (userId, type, title, message, link = null, data = {}) => {
  try {
    await Notification.create({ user: userId, type, title, message, link, data });
  } catch (error) {
    console.error('Failed to create notification:', error.message);
  }
};
