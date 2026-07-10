const Lifting = require('../models/Lifting');

exports.getAll = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const filter = {};
  if (req.query.order) filter.order = req.query.order;
  if (req.query.dealer) filter.dealer = req.query.dealer;
  if (req.query.province) filter.province = req.query.province;
  // Staff: restrict to own province and own records
  if (req.user.role === 'staff') {
    filter.province = req.user.province;
    filter.staffId = req.user._id;
  }
  const total = await Lifting.countDocuments(filter);
  const data = await Lifting.find(filter)
    .populate('order', 'orderNumber')
    .populate('dealer', 'dealerName')
    .populate('product', 'productName')
    .populate('staffId', 'name province')
    .sort('-createdAt').skip((page - 1) * limit).limit(limit);
  res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
};

exports.getOne = async (req, res) => {
  const data = await Lifting.findById(req.params.id)
    .populate('order').populate('dealer').populate('product').populate('staffId', 'name province');
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  if (req.user.role === 'staff' && data.province !== req.user.province)
    return res.status(403).json({ success: false, message: 'Access denied' });
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  try {
    const province = req.user.role === 'staff' ? req.user.province : req.body.province;
    if (!province) return res.status(400).json({ success: false, message: 'Province is required' });
    const total = (req.body.week1 || 0) + (req.body.week2 || 0) + (req.body.week3 || 0) + (req.body.week4 || 0);
    if (total > req.body.orderedQuantity)
      return res.status(400).json({ success: false, message: 'Total lifted cannot exceed ordered quantity' });
    const data = await Lifting.create({
      ...req.body,
      province,
      staffId: req.user._id,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const lifting = await Lifting.findById(req.params.id);
    if (!lifting) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role === 'staff') {
      if (lifting.staffId?.toString() !== req.user._id.toString())
        return res.status(403).json({ success: false, message: 'Access denied' });
      delete req.body.province;
    }
    const total = (req.body.week1 ?? lifting.week1) + (req.body.week2 ?? lifting.week2) +
      (req.body.week3 ?? lifting.week3) + (req.body.week4 ?? lifting.week4);
    const ordered = req.body.orderedQuantity ?? lifting.orderedQuantity;
    if (total > ordered)
      return res.status(400).json({ success: false, message: 'Total lifted cannot exceed ordered quantity' });
    const data = await Lifting.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  await Lifting.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Deleted' });
};
