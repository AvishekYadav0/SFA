const Product = require('../models/Product');

exports.getAll = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const filter = {};
  if (req.query.search) filter.$or = [
    { productName: new RegExp(req.query.search, 'i') },
    { brand: new RegExp(req.query.search, 'i') },
    { sku: new RegExp(req.query.search, 'i') },
  ];
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  const total = await Product.countDocuments(filter);
  const data = await Product.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit);
  res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
};

exports.getOne = async (req, res) => {
  const data = await Product.findById(req.params.id);
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  const data = await Product.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data });
};

exports.update = async (req, res) => {
  const data = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data });
};

exports.remove = async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Deleted' });
};
