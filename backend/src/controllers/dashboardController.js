const Order      = require('../models/Order');
const Dealer     = require('../models/Dealer');
const Collection = require('../models/Collection');
const Lifting    = require('../models/Lifting');
const { scopeFilter } = require('../middleware/auth');

exports.getStats = async (req, res) => {
  try {
    const scope      = scopeFilter(req);
    const isTopLevel = ['admin', 'nsm'].includes(req.user.role);

    // Last 6 months labels
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleString('default', { month: 'short' }) });
    }
    const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      pendingOrders,
      activeDealers,
      pendingLifting,
      salesAgg,
      collectionAgg,
      topProductsAgg,
      topStaffAgg,
      recentOrders,
      recentCollections,
    ] = await Promise.all([
      Order.countDocuments({ ...scope, status: 'pending' }),

      Dealer.countDocuments({ ...scope, status: 'active' }),

      Lifting.countDocuments({ ...scope }),

      // Monthly sales (last 6 months)
      Order.aggregate([
        { $match: { ...scope, status: { $in: ['approved','warehouse','out_for_delivery','delivered','completed'] }, createdAt: { $gte: chartStart } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, sales: { $sum: '$grandTotal' } } },
      ]),

      // Monthly collection (last 6 months)
      Collection.aggregate([
        { $match: { ...scope, createdAt: { $gte: chartStart } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, collection: { $sum: '$totalCollection' } } },
      ]),

      // Top 5 products by sales amount
      Order.aggregate([
        { $match: { ...scope, status: { $in: ['approved','warehouse','out_for_delivery','delivered','completed'] } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', productName: { $first: '$items.productName' }, totalQty: { $sum: '$items.quantity' }, totalAmount: { $sum: '$items.grandTotal' } } },
        { $sort: { totalAmount: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'p' } },
        { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
        { $project: { productName: { $ifNull: ['$p.productName', '$productName', 'Unknown'] }, sku: '$p.sku', brand: '$p.brand', category: '$p.category', unit: '$p.unit', rate: '$p.rate', totalQty: 1, totalAmount: 1 } },
      ]),

      // Top 5 staff by sales (salesperson field on orders)
      isTopLevel ? Order.aggregate([
        { $match: { status: { $in: ['approved','warehouse','out_for_delivery','delivered','completed'] } } },
        { $group: { _id: '$staffId', totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 }, province: { $first: '$province' } } },
        { $sort: { totalSales: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $project: { name: { $ifNull: ['$u.name', 'Unknown'] }, totalSales: 1, orderCount: 1, province: 1 } },
      ]) : Promise.resolve([]),

      // Recent 10 orders
      Order.find(scope)
        .populate('dealer', 'dealerName province')
        .sort('-createdAt')
        .limit(10)
        .lean(),

      // Recent 10 collections
      Collection.find(scope)
        .populate('dealer', 'dealerName province')
        .sort('-createdAt')
        .limit(10)
        .lean(),
    ]);

    // Build chart arrays aligned to last 6 months
    const salesMap      = Object.fromEntries(salesAgg.map(r => [`${r._id.year}-${r._id.month}`, r.sales]));
    const collectionMap = Object.fromEntries(collectionAgg.map(r => [`${r._id.year}-${r._id.month}`, r.collection]));

    const salesChart      = months.map(m => ({ name: m.label, sales:      salesMap[`${m.year}-${m.month}`]      || 0 }));
    const collectionChart = months.map(m => ({ name: m.label, collection: collectionMap[`${m.year}-${m.month}`] || 0 }));

    res.json({
      success: true,
      data: {
        pendingOrders,
        activeDealers,
        pendingLifting,
        salesChart,
        collectionChart,
        topProducts:        topProductsAgg,
        topStaff:           topStaffAgg,
        recentOrders,
        recentCollections,
      },
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard data' });
  }
};
