const CollectionPlan = require('../models/CollectionPlan');
const { scopeFilter, hierarchyFields } = require('../middleware/auth');

exports.getAll = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = { ...scopeFilter(req) };
    if (req.query.dealer) filter.dealer = req.query.dealer;
    if (req.query.month) filter.month = req.query.month;
    if (req.query.province) filter.province = req.query.province;

    const total = await CollectionPlan.countDocuments(filter);
    const data = await CollectionPlan.find(filter)
      .populate('dealer', 'dealerName province area')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const data = await CollectionPlan.findById(req.params.id).populate('dealer', 'dealerName province area');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const hierarchy = await hierarchyFields(req.user);
    const data = await CollectionPlan.create({ ...req.body, ...hierarchy, createdBy: req.user._id });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const data = await CollectionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await CollectionPlan.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
