const Dealer = require('../models/Dealer');
const Order = require('../models/Order');
const Collection = require('../models/Collection');
const Claim = require('../models/Claim');
const Sale = require('../models/Sale');
const { scopeFilter } = require('../middleware/auth');

exports.getMyProfile = async (req, res) => {
  try {
    // Find dealer linked to this user account (by linkedUser OR assignedTo)
    const dealer = await Dealer.findOne({
      $or: [
        { linkedUser: req.user._id },
        { assignedTo: req.user._id },
      ]
    });
    if (!dealer) return res.status(404).json({ success: false, message: 'No dealer profile linked to your account. Contact your admin.' });

    const [orders, collections, claims, sales] = await Promise.all([
      Order.find({ dealer: dealer._id })
        .populate('items.product', 'productName sku')
        .sort('-createdAt').limit(100),
      Collection.find({ dealer: dealer._id })
        .sort('-year -createdAt').limit(24),
      // Claims submitted by this user OR linked to this dealer
      Claim.find({ $or: [{ submittedBy: req.user._id }, { dealer: dealer._id }] })
        .populate('submittedBy', 'name role')
        .sort('-createdAt').limit(100),
      Sale.find({ dealer: dealer._id })
        .populate('salesperson', 'fullName')
        .sort('-createdAt').limit(100),
    ]);

    res.json({ success: true, data: { dealer, orders, collections, claims, sales } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAll = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const filter = { ...scopeFilter(req, { dealerMode: true }) };
  if (req.query.search) filter.$or = [
    { dealerName: new RegExp(req.query.search, 'i') },
    { ownerName:  new RegExp(req.query.search, 'i') },
    { area:       new RegExp(req.query.search, 'i') },
  ];
  if (req.query.status)   filter.status   = req.query.status;
  // Only allow province override for admin/nsm (scopeFilter already locks rsm/asm)
  if (req.query.province && ['admin', 'nsm'].includes(req.user.role))
    filter.province = req.query.province;
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

// Link a user account to a dealer (admin only)
exports.linkUser = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
    // Unlink from any previous dealer
    await Dealer.updateMany({ linkedUser: userId }, { $unset: { linkedUser: '' } });
    const dealer = await Dealer.findByIdAndUpdate(
      req.params.id,
      { linkedUser: userId },
      { new: true }
    );
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });
    res.json({ success: true, message: 'User linked to dealer successfully', data: dealer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
