const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');
const Sale    = require('../models/Sale');
const { protect } = require('../middleware/auth');

const NEPAL_PROVINCES = [
  'Koshi Province',
  'Madhesh Province',
  'Bagmati Province',
  'Gandaki Province',
  'Lumbini Province',
  'Karnali Province',
  'Sudurpashchim Province',
];

const PAYMENT_METHODS = ['cash', 'bank', 'esewa', 'fonepay', 'cheque', 'credit'];

// All active statuses (not rejected/cancelled) — show in sales
const SALE_STATUSES = ['pending', 'approved', 'warehouse', 'out_for_delivery', 'delivered', 'completed'];

/**
 * GET /api/sales/by-province
 * Groups ALL active orders by province.
 * collectedAmount & paymentBreakdown only come from 'completed' orders.
 */
router.get('/by-province', protect, async (req, res) => {
  try {
    const { range = 'all', from, to } = req.query;
    const Salesperson = require('../models/Salesperson');

    const baseMatch = { status: { $in: SALE_STATUSES } };
    if (req.user.role === 'staff') baseMatch.staffId = req.user._id;

    const dateFilter = buildDateFilter(range, from, to);
    if (dateFilter) baseMatch.createdAt = dateFilter;

    // Main province stats — all active orders
    const results = await Order.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: '$province',
          totalOrders: { $sum: 1 },
          totalSales:  { $sum: '$grandTotal' },
          collected:   { $sum: '$collectedAmount' },
          dealers:     { $addToSet: '$dealer' },
        },
      },
      {
        $project: {
          _id: 0,
          province:    '$_id',
          totalOrders: 1,
          totalSales:  1,
          collected:   1,
          outstanding: { $subtract: ['$totalSales', '$collected'] },
          dealerCount: { $size: '$dealers' },
          collectionRate: {
            $cond: [
              { $eq: ['$totalSales', 0] }, 0,
              { $multiply: [{ $divide: ['$collected', '$totalSales'] }, 100] },
            ],
          },
        },
      },
    ]);

    // Real active staff count per province from Salesperson collection
    const staffCounts = await Salesperson.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$province', count: { $sum: 1 } } },
    ]);
    const staffMap = {};
    staffCounts.forEach(s => { staffMap[s._id] = s.count; });

    // Payment breakdown — only completed orders
    const completedMatch = { ...baseMatch, status: 'completed' };
    const paymentAgg = await Order.aggregate([
      { $match: completedMatch },
      {
        $group: {
          _id:    { province: '$province', method: '$paymentMethod' },
          amount: { $sum: '$collectedAmount' },
          count:  { $sum: 1 },
        },
      },
    ]);

    const paymentMap = {};
    paymentAgg.forEach(({ _id, amount, count }) => {
      if (!paymentMap[_id.province]) paymentMap[_id.province] = {};
      paymentMap[_id.province][_id.method] = { amount, count };
    });

    const provinceMap = {};
    results.forEach(item => { provinceMap[item.province] = item; });

    const provinces = NEPAL_PROVINCES.map(name => {
      const base = provinceMap[name] || {
        province: name, totalOrders: 0, totalSales: 0,
        collected: 0, outstanding: 0, dealerCount: 0,
        collectionRate: 0,
      };
      base.activeStaffCount = staffMap[name] || 0;
      base.paymentBreakdown = paymentMap[name] || {};
      return base;
    });

    const overall = provinces.reduce(
      (acc, item) => {
        acc.totalOrders  += item.totalOrders;
        acc.totalSales   += item.totalSales;
        acc.collected    += item.collected;
        acc.outstanding  += item.outstanding;
        PAYMENT_METHODS.forEach(m => {
          acc.paymentBreakdown[m] = (acc.paymentBreakdown[m] || 0) + (item.paymentBreakdown[m]?.amount || 0);
        });
        return acc;
      },
      { totalOrders: 0, totalSales: 0, collected: 0, outstanding: 0, paymentBreakdown: {} }
    );

    return res.status(200).json({ success: true, provinces, overall });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to load sales data' });
  }
});

/**
 * GET /api/sales/trend
 * Daily / weekly / monthly / yearly trend for active orders
 */
router.get('/trend', protect, async (req, res) => {
  try {
    const { province, range = 'month', groupBy = 'day' } = req.query;
    const match = { status: { $in: SALE_STATUSES } };
    if (province) match.province = province;
    if (req.user.role === 'staff') match.staffId = req.user._id;

    const dateFilter = buildDateFilter(range, req.query.from, req.query.to);
    if (dateFilter) match.createdAt = dateFilter;

    let groupId;
    if (groupBy === 'day')   groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };
    if (groupBy === 'week')  groupId = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
    if (groupBy === 'month') groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
    if (groupBy === 'year')  groupId = { year: { $year: '$createdAt' } };

    const data = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id:        groupId,
          totalSales: { $sum: '$grandTotal' },
          collected:  { $sum: '$collectedAmount' },
          orders:     { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
    ]);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const formatted = data.map(d => {
      let label = '';
      if (groupBy === 'day')   label = `${d._id.day} ${MONTHS[(d._id.month || 1) - 1]}`;
      if (groupBy === 'week')  label = `Wk ${d._id.week} '${String(d._id.year).slice(2)}`;
      if (groupBy === 'month') label = `${MONTHS[(d._id.month || 1) - 1]} ${d._id.year}`;
      if (groupBy === 'year')  label = `${d._id.year}`;
      return { label, totalSales: d.totalSales, collected: d.collected, orders: d.orders };
    });

    return res.json({ success: true, data: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/sales/orders
 * Paginated list of active orders, filterable by province
 */
router.get('/orders', protect, async (req, res) => {
  try {
    const { province, range = 'all', from, to, page = 1, limit = 20 } = req.query;
    const match = { status: { $in: SALE_STATUSES } };
    if (province) match.province = province;
    if (req.user.role === 'staff') match.staffId = req.user._id;

    const dateFilter = buildDateFilter(range, from, to);
    if (dateFilter) match.createdAt = dateFilter;

    const total = await Order.countDocuments(match);
    const data  = await Order.find(match)
      .populate('dealer',      'dealerName area')
      .populate('salesperson', 'fullName')
      .populate('staffId',     'name')
      .sort('-createdAt')
      .skip((+page - 1) * +limit)
      .limit(+limit);

    return res.json({ success: true, data, total, pages: Math.ceil(total / +limit) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

function buildDateFilter(range, from, to) {
  if (from && to) return { $gte: new Date(from), $lte: new Date(`${to}T23:59:59`) };
  const now = new Date();
  switch (range) {
    case 'today': { const s = new Date(now); s.setHours(0,0,0,0); return { $gte: s }; }
    case 'week':  { const s = new Date(now); s.setDate(s.getDate()-7); return { $gte: s }; }
    case 'month': return { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'year':  return { $gte: new Date(now.getFullYear(), 0, 1) };
    default: return null;
  }
}

/**
 * GET /api/sales/staff-by-province
 * Salespersons for a province with their sales stats
 */
router.get('/staff-by-province', protect, async (req, res) => {
  try {
    const { province } = req.query;
    if (!province) return res.status(400).json({ success: false, message: 'province required' });

    const Salesperson = require('../models/Salesperson');

    const [staff, salesAgg] = await Promise.all([
      Salesperson.find({ province }).select('fullName designation area employeeId status'),
      Order.aggregate([
        { $match: { province, status: { $in: SALE_STATUSES } } },
        { $group: { _id: '$salesperson', totalSales: { $sum: '$grandTotal' }, collected: { $sum: '$collectedAmount' }, orderCount: { $sum: 1 } } },
      ]),
    ]);

    const salesMap = {};
    salesAgg.forEach(s => { salesMap[String(s._id)] = s; });

    const data = staff.map(sp => {
      const s = salesMap[String(sp._id)] || {};
      return {
        _id:        sp._id,
        fullName:   sp.fullName,
        designation:sp.designation,
        area:       sp.area,
        employeeId: sp.employeeId,
        status:     sp.status,
        totalSales: s.totalSales  || 0,
        collected:  s.collected   || 0,
        orderCount: s.orderCount  || 0,
        outstanding: (s.totalSales || 0) - (s.collected || 0),
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/sales/records
 * Paginated list of Sale records (auto-created from orders)
 */
router.get('/records', protect, async (req, res) => {
  try {
    const { status, province, page = 1, limit = 20 } = req.query;
    const match = {};
    if (status)   match.status   = status;
    if (province) match.province = province;
    if (req.user.role === 'staff') match.staffId = req.user._id;

    const total = await Sale.countDocuments(match);
    const data  = await Sale.find(match)
      .populate('order',       'orderNumber date grandTotal paymentType')
      .populate('salesperson', 'fullName')
      .populate('dealer',      'dealerName area')
      .populate('staffId',     'name')
      .sort('-createdAt')
      .skip((+page - 1) * +limit)
      .limit(+limit);

    return res.json({ success: true, data, total, pages: Math.ceil(total / +limit) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
