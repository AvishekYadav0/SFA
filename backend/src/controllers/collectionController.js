const Collection = require('../models/Collection');
const Dealer     = require('../models/Dealer');
const { scopeFilter, hierarchyFields } = require('../middleware/auth');

exports.getAll = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const filter = { ...scopeFilter(req) };
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.dealer)   filter.dealer   = req.query.dealer;
    if (req.query.se)       filter.se       = req.query.se;
    if (req.query.so)       filter.so       = req.query.so;
    if (req.query.province) filter.province = req.query.province;
    if (req.query.startDate && req.query.endDate)
      filter.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };

    const total = await Collection.countDocuments(filter);
    const data  = await Collection.find(filter)
      .populate('dealer', 'dealerName area')
      .populate('se',  'name employeeId')
      .populate('so',  'name employeeId')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit);

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const data = await Collection.findById(req.params.id)
      .populate('dealer se so asm', 'dealerName name');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const User   = require('../models/User');
    const dealer = await Dealer.findById(req.body.dealer);

    let creator = req.user;
    if (['admin', 'nsm', 'rsm', 'asm'].includes(req.user.role) && req.body.se) {
      creator = await User.findById(req.body.se);
    }
    const hierarchy = await hierarchyFields(creator);

    const data = await Collection.create({
      ...req.body,
      ...hierarchy,
      province: dealer?.province,
      district: dealer?.district,
      area:     dealer?.area,
      region:   dealer?.region,
      createdBy: req.user._id,
    });

    await Dealer.findByIdAndUpdate(req.body.dealer, {
      $inc: { outstandingAmount: -(req.body.amount || 0) }
    });

    res.status(201).json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const data = await Collection.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    const col = await Collection.findById(req.params.id);
    if (col) {
      await Dealer.findByIdAndUpdate(col.dealer, { $inc: { outstandingAmount: col.amount } });
      await col.deleteOne();
    }
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
