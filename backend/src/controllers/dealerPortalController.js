const Order      = require('../models/Order');
const Collection = require('../models/Collection');
const Dealer     = require('../models/Dealer');

// All handlers require role === 'dealer' and req.user.linkedDealer to be set.
const getDealerId = (req) => req.user.linkedDealer;

exports.getProfile = async (req, res) => {
  try {
    const data = await Dealer.findById(getDealerId(req))
      .populate('se', 'name phone employeeId')
      .populate('asm', 'name phone');
    if (!data) return res.status(404).json({ success: false, message: 'Dealer not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOrders = async (req, res) => {
  try {
    const dealerId = getDealerId(req);
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = { dealer: dealerId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.startDate && req.query.endDate)
      filter.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };

    const total = await Order.countDocuments(filter);
    const data  = await Order.find(filter)
      .sort('-createdAt').skip((page - 1) * limit).limit(limit);
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getPayments = async (req, res) => {
  try {
    const dealerId = getDealerId(req);
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = { dealer: dealerId };
    if (req.query.startDate && req.query.endDate)
      filter.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };

    const total = await Collection.countDocuments(filter);
    const data  = await Collection.find(filter).sort('-date').skip((page - 1) * limit).limit(limit);
    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getSummary = async (req, res) => {
  try {
    const dealerId = getDealerId(req);
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);

    const dealer = await Dealer.findById(dealerId).lean();
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });

    const [monthlyPurchase, yearlyPurchase, totalOrders, pendingOrders, totalPaid] = await Promise.all([
      Order.aggregate([{ $match: { dealer: dealerId, date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Order.aggregate([{ $match: { dealer: dealerId, date: { $gte: yearStart },  status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Order.countDocuments({ dealer: dealerId }),
      Order.countDocuments({ dealer: dealerId, status: 'pending' }),
      Collection.aggregate([{ $match: { dealer: dealerId } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);

    res.json({
      success: true,
      data: {
        outstandingBalance: dealer.outstandingAmount,
        creditLimit:        dealer.creditLimit,
        availableCredit:    dealer.creditLimit - dealer.outstandingAmount,
        monthlyPurchase:    monthlyPurchase[0]?.total || 0,
        yearlyPurchase:     yearlyPurchase[0]?.total  || 0,
        totalOrders, pendingOrders,
        totalPaid: totalPaid[0]?.total || 0,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
