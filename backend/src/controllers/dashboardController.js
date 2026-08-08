const Order      = require('../models/Order');
const Collection = require('../models/Collection');
const Dealer     = require('../models/Dealer');
const Visit      = require('../models/Visit');
const User       = require('../models/User');
const Target     = require('../models/Target');
const { scopeFilter } = require('../middleware/auth');

// Dealer queries need the 'dealer' model hint so scopeFilter handles the so-array correctly
const dealerScope = (req) => scopeFilter(req, 'dealer');

exports.getDashboard = async (req, res) => {
  try {
    const scope      = scopeFilter(req);
    const dealerScp  = dealerScope(req);
    const { role, _id } = req.user;
    const now        = new Date();
    const today      = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    const weekAgo    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      todaySales, monthlySales, yearlySales,
      todayCollection, monthlyCollection,
      totalDealers, activeDealers,
      pendingOrders, totalOrders,
      totalOutstanding,
      prevMonthlySales,
      deliveredOrders, cancelledOrders,
    ] = await Promise.all([
      Order.aggregate([{ $match: { ...scope, date: { $gte: today }, status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Order.aggregate([{ $match: { ...scope, date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Order.aggregate([{ $match: { ...scope, date: { $gte: yearStart }, status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Collection.aggregate([{ $match: { ...scope, date: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Collection.aggregate([{ $match: { ...scope, date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Dealer.countDocuments(dealerScp),
      Dealer.countDocuments({ ...dealerScp, status: 'active' }),
      Order.countDocuments({ ...scope, status: 'pending' }),
      Order.countDocuments(scope),
      Dealer.aggregate([{ $match: dealerScp }, { $group: { _id: null, total: { $sum: '$outstandingAmount' } } }]),
      Order.aggregate([{ $match: { ...scope, date: { $gte: prevMonthStart, $lte: prevMonthEnd }, status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Order.countDocuments({ ...scope, status: 'delivered' }),
      Order.countDocuments({ ...scope, status: 'cancelled' }),
    ]);

    const target = await Target.findOne({ user: _id, month: now.getMonth() + 1, year: now.getFullYear() });

    const curMonthSales  = monthlySales[0]?.total  || 0;
    const prevMonthSales = prevMonthlySales[0]?.total || 0;
    const salesGrowth    = prevMonthSales > 0 ? Math.round(((curMonthSales - prevMonthSales) / prevMonthSales) * 100) : null;
    const targetPct      = target?.salesTarget > 0 ? Math.round((curMonthSales / target.salesTarget) * 100) : null;

    const [provinceSales, topProducts, topDealers, salesTrend, collectionTrend, orderStatusBreakdown] = await Promise.all([
      Order.aggregate([
        { $match: { ...scope, date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: '$province', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Order.aggregate([
        { $match: { ...scope, date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productName', total: { $sum: '$items.grandTotal' }, qty: { $sum: '$items.quantity' } } },
        { $sort: { total: -1 } }, { $limit: 10 },
      ]),
      Order.aggregate([
        { $match: { ...scope, date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: '$dealer', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }, { $limit: 10 },
        { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
        { $unwind: { path: '$dealer', preserveNullAndEmptyArrays: true } },
      ]),
      Order.aggregate([
        { $match: { ...scope, date: { $gte: weekAgo }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Collection.aggregate([
        { $match: { ...scope, date: { $gte: weekAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { ...scope, date: { $gte: monthStart } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    let extras = {};

    if (role === 'nsm' || role === 'admin') {
      const [totalRSM, totalASM, totalSE, rsmRanking, quarterSales, newDealers] = await Promise.all([
        User.countDocuments({ role: 'rsm', status: 'active' }),
        User.countDocuments({ role: 'asm', status: 'active' }),
        User.countDocuments({ role: 'se',  status: 'active' }),
        Order.aggregate([
          { $match: { date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } },
          { $group: { _id: '$rsm', total: { $sum: '$grandTotal' } } },
          { $sort: { total: -1 } }, { $limit: 10 },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        ]),
        Order.aggregate([{ $match: { date: { $gte: new Date(now.getFullYear(), now.getMonth() - 2, 1) }, status: { $nin: ['cancelled'] } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
        Dealer.countDocuments({ createdAt: { $gte: monthStart } }),
      ]);
      const seRanking = await Order.aggregate([
        { $match: { date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: '$se', total: { $sum: '$grandTotal' } } },
        { $sort: { total: -1 } }, { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      ]);
      extras = { totalRSM, totalASM, totalSE, rsmRanking, seRanking, quarterSales: quarterSales[0]?.total || 0, newDealers };
    }

    if (role === 'rsm') {
      const [totalASM, totalSE, asmRanking, regionDealers] = await Promise.all([
        User.countDocuments({ rsm: _id, role: 'asm', status: 'active' }),
        User.countDocuments({ rsm: _id, role: 'se',  status: 'active' }),
        Order.aggregate([
          { $match: { rsm: _id, date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } },
          { $group: { _id: '$asm', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        ]),
        Dealer.countDocuments({ rsm: _id }),
      ]);
      const seRanking = await Order.aggregate([
        { $match: { rsm: _id, date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: '$se', total: { $sum: '$grandTotal' } } },
        { $sort: { total: -1 } }, { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      ]);
      extras = { totalASM, totalSE, asmRanking, seRanking, regionDealers };
    }

    if (role === 'asm') {
      const [totalSE, todayVisits, monthVisits, seList] = await Promise.all([
        User.countDocuments({ asm: _id, role: 'se', status: 'active' }),
        Visit.countDocuments({ asm: _id, date: { $gte: today } }),
        Visit.countDocuments({ asm: _id, date: { $gte: monthStart } }),
        User.find({ asm: _id, role: 'se' }).select('name employeeId phone area status lastLogin target').lean(),
      ]);
      const seRanking = await Order.aggregate([
        { $match: { asm: _id, date: { $gte: monthStart }, status: { $nin: ['cancelled'] } } },
        { $group: { _id: '$se', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      ]);
      extras = { totalSE, todayVisits, monthVisits, seRanking, seList };
    }

    if (role === 'se') {
      const [totalSO, todayVisits, totalVisits, lastOrder, pendingCollection] = await Promise.all([
        User.countDocuments({ reportsTo: _id, role: 'so', status: 'active' }),
        Visit.countDocuments({ se: _id, date: { $gte: today } }),
        Visit.countDocuments({ se: _id, date: { $gte: monthStart } }),
        Order.findOne({ se: _id }).sort('-createdAt').populate('dealer', 'dealerName').lean(),
        Dealer.aggregate([{ $match: { se: _id } }, { $group: { _id: null, total: { $sum: '$outstandingAmount' } } }]),
      ]);
      extras = { totalSO, todayVisits, totalVisits, lastOrder, pendingCollection: pendingCollection[0]?.total || 0 };
    }

    if (role === 'so') {
      const [todayVisits, totalVisits, lastOrder, pendingCollection] = await Promise.all([
        Visit.countDocuments({ so: _id, date: { $gte: today } }),
        Visit.countDocuments({ so: _id, date: { $gte: monthStart } }),
        Order.findOne({ so: _id }).sort('-createdAt').populate('dealer', 'dealerName').lean(),
        // so is array on Dealer — use $elemMatch
        Dealer.aggregate([{ $match: { so: _id } }, { $group: { _id: null, total: { $sum: '$outstandingAmount' } } }]),
      ]);
      extras = { todayVisits, totalVisits, lastOrder, pendingCollection: pendingCollection[0]?.total || 0 };
    }

    res.json({
      success: true,
      data: {
        todaySales:        todaySales[0]?.total        || 0,
        monthlySales:      curMonthSales,
        yearlySales:       yearlySales[0]?.total       || 0,
        todayCollection:   todayCollection[0]?.total   || 0,
        monthlyCollection: monthlyCollection[0]?.total || 0,
        totalDealers, activeDealers, pendingOrders, totalOrders,
        deliveredOrders, cancelledOrders,
        totalOutstanding:  totalOutstanding[0]?.total  || 0,
        salesGrowth, targetPct,
        target: target || null,
        provinceSales, topProducts, topDealers, salesTrend, collectionTrend, orderStatusBreakdown,
        ...extras,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
