const Collection = require('../models/Collection');

exports.getAll = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const filter = {};
  if (req.query.dealer) filter.dealer = req.query.dealer;
  if (req.query.month) filter.month = req.query.month;
  if (req.query.province) filter.province = req.query.province;
  // Staff: restrict to own province and own records
  if (req.user.role === 'staff') {
    filter.province = req.user.province;
    filter.staffId = req.user._id;
  }
  const total = await Collection.countDocuments(filter);
  const data = await Collection.find(filter)
    .populate('dealer', 'dealerName area province')
    .populate('staffId', 'name province')
    .sort('-createdAt').skip((page - 1) * limit).limit(limit);
  res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
};

exports.getOne = async (req, res) => {
  const data = await Collection.findById(req.params.id).populate('dealer').populate('staffId', 'name province');
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  if (req.user.role === 'staff' && data.province !== req.user.province)
    return res.status(403).json({ success: false, message: 'Access denied' });
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  try {
    const province = req.user.role === 'staff' ? req.user.province : req.body.province;
    if (!province) return res.status(400).json({ success: false, message: 'Province is required' });
    const data = await Collection.create({
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
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role === 'staff') {
      if (collection.staffId?.toString() !== req.user._id.toString())
        return res.status(403).json({ success: false, message: 'Access denied' });
      delete req.body.province;
    }
    const data = await Collection.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  await Collection.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Deleted' });
};
