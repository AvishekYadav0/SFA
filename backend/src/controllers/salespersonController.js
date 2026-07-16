const Salesperson = require('../models/Salesperson');

const buildQuery = (query) => {
  const filter = {};
  if (query.search) filter.$or = [
    { fullName: new RegExp(query.search, 'i') },
    { employeeId: new RegExp(query.search, 'i') },
    { area: new RegExp(query.search, 'i') },
  ];
  if (query.status)   filter.status   = query.status;
  if (query.province) filter.province = query.province;
  return filter;
};

exports.getAll = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const filter = buildQuery(req.query);
  // Staff can only see salespersons in their assigned province
  if (req.user.role === 'staff' && req.user.province) {
    filter.province = req.user.province;
  }
  const total = await Salesperson.countDocuments(filter);
  const data = await Salesperson.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit);
  res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
};

exports.getOne = async (req, res) => {
  const data = await Salesperson.findById(req.params.id);
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  const data = await Salesperson.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data });
};

exports.update = async (req, res) => {
  const data = await Salesperson.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data });
};

exports.remove = async (req, res) => {
  await Salesperson.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Deleted' });
};
