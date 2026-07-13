const Order        = require('../models/Order');
const Collection   = require('../models/Collection');
const Lifting      = require('../models/Lifting');
const Salesperson  = require('../models/Salesperson');
const Dealer       = require('../models/Dealer');

const PROVINCES = [
  'Koshi Province',
  'Madhesh Province',
  'Bagmati Province',
  'Gandaki Province',
  'Lumbini Province',
  'Karnali Province',
  'Sudurpashchim Province',
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

exports.getDashboard = async (req, res) => {
  try {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    // ── Core counts ──────────────────────────────────
    const [
      totalOrders,
      pendingOrders,
      pendingLifting,
      totalDealers,
      totalSalespersons,
      allApprovedOrders,
      allCollections,
      monthlySales,
      monthlyCollections,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Lifting.countDocuments({ remainingQuantity: { $gt: 0 } }),
      Dealer.countDocuments({ status: 'active' }),
      Salesperson.countDocuments({ status: 'active' }),
      Order.find({ status: 'approved' }).populate('dealer', 'dealerName province area'),
      Collection.find().populate('dealer', 'dealerName province area'),
      Order.aggregate([
        { $match: { status: 'approved', date: { $gte: yearStart } } },
        { $group: { _id: { month: { $month: '$date' } }, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        { $sort: { '_id.month': 1 } },
      ]),
      Collection.aggregate([
        { $match: { createdAt: { $gte: yearStart } } },
        { $group: { _id: { month: { $month: '$createdAt' } }, total: { $sum: '$totalCollection' } } },
        { $sort: { '_id.month': 1 } },
      ]),
    ]);

    const totalSalesAmount   = allApprovedOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const totalCollection    = allCollections.reduce((s, c) => s + (c.totalCollection || 0), 0);
    const outstandingBalance = allCollections.reduce((s, c) => s + (c.closingBalance  || 0), 0);

    // ── Monthly charts ───────────────────────────────
    const salesChart = MONTHS.map((name, i) => {
      const f = monthlySales.find(m => m._id.month === i + 1);
      return { name, sales: f?.total || 0, orders: f?.count || 0 };
    });
    const collectionChart = MONTHS.map((name, i) => {
      const f = monthlyCollections.find(m => m._id.month === i + 1);
      return { name, collection: f?.total || 0 };
    });

    // ── Province-wise stats using real province field ─
    const provinceMap = {};
    PROVINCES.forEach(p => {
      provinceMap[p] = { province: p, totalOrders: 0, totalSales: 0, totalCollection: 0, outstandingBalance: 0, totalDealers: 0, activeStaff: 0 };
    });

    // orders → use order.province field directly
    for (const order of allApprovedOrders) {
      const prov = order.province || order.dealer?.province || '';
      if (provinceMap[prov]) {
        provinceMap[prov].totalOrders += 1;
        provinceMap[prov].totalSales  += order.grandTotal || 0;
      }
    }

    // collections → use dealer.province field
    for (const col of allCollections) {
      const prov = col.province || col.dealer?.province || '';
      if (provinceMap[prov]) {
        provinceMap[prov].totalCollection    += col.totalCollection || 0;
        provinceMap[prov].outstandingBalance += col.closingBalance  || 0;
      }
    }

    // dealers → use dealer.province field
    const allDealers = await Dealer.find({ status: 'active' });
    for (const dealer of allDealers) {
      const prov = dealer.province || '';
      if (provinceMap[prov]) provinceMap[prov].totalDealers += 1;
    }

    // salespersons → use salesperson.province field
    const allStaff = await Salesperson.find({ status: 'active' });
    for (const sp of allStaff) {
      const prov = sp.province || '';
      if (provinceMap[prov]) provinceMap[prov].activeStaff += 1;
    }

    // always return all 7 provinces
    const provinceStats = PROVINCES.map(p => provinceMap[p]);

    // ── Top products ─────────────────────────────────
    const topProducts = await Order.aggregate([
      { $match: { status: 'approved' } },
      { $unwind: '$items' },
      { $group: {
        _id: '$items.product',
        productName: { $first: '$items.productName' },
        totalQty:    { $sum: '$items.quantity' },
        totalAmount: { $sum: '$items.grandTotal' },
      }},
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
    ]);

    // ── Top salespersons ─────────────────────────────
    const topStaffRaw = await Order.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$salesperson', totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 } } },
      { $sort: { totalSales: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'salespersons', localField: '_id', foreignField: '_id', as: 'sp' } },
      { $unwind: { path: '$sp', preserveNullAndEmptyArrays: true } },
    ]);
    const topStaff = topStaffRaw.map(t => ({
      name:       t.sp?.fullName || 'Unknown',
      province:   t.sp?.province || '',
      area:       t.sp?.area     || '',
      totalSales: t.totalSales,
      orderCount: t.orderCount,
    }));

    // ── Recent records ───────────────────────────────
    const recentOrders = await Order.find()
      .populate('salesperson', 'fullName')
      .populate('dealer', 'dealerName province')
      .sort('-createdAt').limit(5);

    const recentCollections = await Collection.find()
      .populate('dealer', 'dealerName province')
      .sort('-createdAt').limit(5);

    res.json({
      success: true,
      data: {
        totalOrders,
        totalSalesAmount,
        totalCollection,
        outstandingBalance,
        totalDealers,
        totalSalespersons,
        pendingOrders,
        pendingLifting,
        salesChart,
        collectionChart,
        provinceStats,
        topProducts,
        topStaff,
        recentOrders:      recentOrders.map(o => o.toObject()),
        recentCollections: recentCollections.map(c => c.toObject()),
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
