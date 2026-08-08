const Visit  = require('../models/Visit');
const Dealer = require('../models/Dealer');
const { scopeFilter, hierarchyFields } = require('../middleware/auth');

exports.getAll = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const filter = { ...scopeFilter(req) };
    if (req.query.dealer) filter.dealer = req.query.dealer;
    if (req.query.se)     filter.se     = req.query.se;
    if (req.query.so)     filter.so     = req.query.so;
    if (req.query.startDate && req.query.endDate)
      filter.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };

    const total = await Visit.countDocuments(filter);
    const data  = await Visit.find(filter)
      .populate('dealer', 'dealerName area province')
      .populate('se', 'name employeeId')
      .populate('so', 'name employeeId')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit);

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const data = await Visit.findById(req.params.id)
      .populate('dealer', 'dealerName area province')
      .populate('se so asm', 'name employeeId phone');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getStats = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [todayCount, monthCount, total] = await Promise.all([
      Visit.countDocuments({ ...scope, date: { $gte: today } }),
      Visit.countDocuments({ ...scope, date: { $gte: monthStart } }),
      Visit.countDocuments(scope),
    ]);
    res.json({ success: true, data: { todayCount, monthCount, total } });
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

    const data = await Visit.create({
      ...req.body,
      ...hierarchy,
      province: dealer?.province,
      district: dealer?.district,
      area:     dealer?.area,
      createdBy: req.user._id,
    });

    await Dealer.findByIdAndUpdate(req.body.dealer, { lastVisitDate: new Date() });
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.checkOut = async (req, res) => {
  try {
    const update = {
      status: 'checked-out',
      checkOutTime: new Date(),
      checkOutLat: req.body.lat,
      checkOutLng: req.body.lng,
    };
    const data = await Visit.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    const data = await Visit.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Visit.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
