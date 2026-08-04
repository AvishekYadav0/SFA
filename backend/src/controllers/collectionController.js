const Collection = require('../models/Collection');
const { scopeFilter } = require('../middleware/auth');

exports.getAll = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const filter = { ...scopeFilter(req) };
  if (req.query.dealer)   filter.dealer  = req.query.dealer;
  if (req.query.month)    filter.month   = req.query.month;
  if (req.query.province && ['admin', 'nsm'].includes(req.user.role))
    filter.province = req.query.province;
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
  if (!['admin', 'nsm'].includes(req.user.role) && data.staffId?.toString() !== req.user._id.toString())
    return res.status(403).json({ success: false, message: 'Access denied' });
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  try {
    const province = ['admin', 'nsm'].includes(req.user.role) ? req.body.province : req.user.province;
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
    if (!['admin', 'nsm'].includes(req.user.role)) {
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
