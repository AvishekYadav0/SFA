const Dealer = require('../models/Dealer');

exports.getAll = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const filter = {};
  if (req.query.search) filter.$or = [
    { dealerName: new RegExp(req.query.search, 'i') },
    { ownerName: new RegExp(req.query.search, 'i') },
    { area: new RegExp(req.query.search, 'i') },
  ];
  if (req.query.status) filter.status = req.query.status;
  if (req.query.province) filter.province = req.query.province;
  // Staff: restrict to own province
  if (req.user.role === 'staff') filter.province = req.user.province;
  const total = await Dealer.countDocuments(filter);
  const data = await Dealer.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit);
  res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
};

exports.getOne = async (req, res) => {
  const data = await Dealer.findById(req.params.id);
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  const data = await Dealer.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data });
};

exports.update = async (req, res) => {
  const data = await Dealer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data });
};

exports.remove = async (req, res) => {
  await Dealer.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Deleted' });
};
