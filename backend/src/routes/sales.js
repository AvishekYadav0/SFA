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
const SALE_STATUSES = ['pending', 'approved', 'hold', 'warehouse', 'out_for_delivery', 'delivered', 'completed'];

function normalizeSaleItems(items = []) {
  return (items || []).map(it => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    const basic = qty * rate;
    const discountPercent = Number(it.discountPercent) || 0;
    const discountAmount = Number(it.discountAmount) || 0;
    const taxableBasic = Math.max(0, basic - discountAmount - ((basic * discountPercent) / 100));
    const excise = taxableBasic * ((Number(it.excisePercent) || 0) / 100);
    const vat = (taxableBasic + excise) * ((Number(it.vatPercent) || 0) / 100);
    return {
      ...it,
      quantity: qty,
      rate,
      discountPercent,
      discountAmount,
      basicAmount: basic,
      exciseAmount: excise,
      vatAmount: vat,
      grandTotal: taxableBasic + excise + vat,
    };
  });
}

function buildInvoiceNumber() {
  const ts = Date.now().toString();
  return `INV-${ts.slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
}

/**
 * GET /api/sales/by-province
 * Groups ALL active orders by province.
 * collectedAmount & paymentBreakdown only come from 'completed' orders.
 */
router.get('/by-province', protect, async (req, res) => {
  try {
    const { range = 'all', from, to } = req.query;
    const { scopeFilter } = require('../middleware/auth');
    const scope = scopeFilter(req);

    const orderMatch = { status: { $in: SALE_STATUSES }, ...scope };
    const manualMatch = { status: { $in: SALE_STATUSES }, order: { $exists: false }, ...scope };

    const dateFilter = buildDateFilter(range, from, to);
    if (dateFilter) {
      orderMatch.createdAt = dateFilter;
      manualMatch.createdAt = dateFilter;
    }

    const User = require('../models/User');

    const orderResults = await Order.aggregate([
      { $match: orderMatch },
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
          dealers:      1,
        },
      },
    ]);

    const manualResults = await Sale.aggregate([
      { $match: manualMatch },
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
          dealers:      1,
        },
      },
    ]);

    const completedOrderMatch = { ...orderMatch, status: 'completed' };
    const paymentAgg = await Order.aggregate([
      { $match: completedOrderMatch },
      {
        $group: {
          _id:    { province: '$province', method: '$paymentType' },
          amount: { $sum: '$collectedAmount' },
          count:  { $sum: 1 },
        },
      },
    ]);

    const completedManualMatch = { ...manualMatch, status: 'completed' };
    const manualPaymentAgg = await Sale.aggregate([
      { $match: completedManualMatch },
      {
        $group: {
          _id:    { province: '$province', method: '$paymentType' },
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
    manualPaymentAgg.forEach(({ _id, amount, count }) => {
      if (!paymentMap[_id.province]) paymentMap[_id.province] = {};
      const existing = paymentMap[_id.province][_id.method] || { amount: 0, count: 0 };
      paymentMap[_id.province][_id.method] = {
        amount: existing.amount + amount,
        count: existing.count + count,
      };
    });

    const provinceMap = {};
    orderResults.forEach(item => { provinceMap[item.province] = item; });
    const manualMap = {};
    manualResults.forEach(item => { manualMap[item.province] = item; });

    // Staff counts — scoped to logged-in user's hierarchy
    const staffCounts = await Order.aggregate([
      { $match: { status: { $in: SALE_STATUSES }, ...scope } },
      {
        $group: {
          _id: '$province',
          staffIds: { $addToSet: '$se' },
          soIds:    { $addToSet: '$so' },
          asmIds:   { $addToSet: '$asm' },
        },
      },
    ]);
    const staffCountMap = {};
    staffCounts.forEach(s => {
      const ids = new Set([
        ...(s.staffIds || []), ...(s.soIds || []), ...(s.asmIds || [])
      ].filter(Boolean).map(String));
      staffCountMap[s._id] = ids.size;
    });

    const provinces = NEPAL_PROVINCES.map(name => {
      const order = provinceMap[name] || { province: name, totalOrders: 0, totalSales: 0, collected: 0, dealers: [] };
      const manual = manualMap[name] || { totalOrders: 0, totalSales: 0, collected: 0, dealers: [] };
      const dealerSet = new Set([...(order.dealers || []), ...(manual.dealers || [])].filter(Boolean).map(String));
      const totalSales = (order.totalSales || 0) + (manual.totalSales || 0);
      const collected = (order.collected || 0) + (manual.collected || 0);
      const totalOrders = (order.totalOrders || 0) + (manual.totalOrders || 0);
      const outstanding = Math.max(0, totalSales - collected);
      return {
        province: name,
        totalOrders,
        totalSales,
        collected,
        outstanding,
        dealerCount: dealerSet.size,
        collectionRate: totalSales === 0 ? 0 : Math.round((collected / totalSales) * 100),
        activeStaffCount: staffCountMap[name] || 0,
        paymentBreakdown: paymentMap[name] || {},
      };
    });

    const overall = provinces.reduce(
      (acc, item) => {
        acc.totalOrders += item.totalOrders;
        acc.totalSales += item.totalSales;
        acc.collected += item.collected;
        acc.outstanding += item.outstanding;
        PAYMENT_METHODS.forEach(m => {
          acc.paymentBreakdown[m] = (acc.paymentBreakdown[m] || 0) + ((item.paymentBreakdown[m] && item.paymentBreakdown[m].amount) || 0);
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
    const { scopeFilter } = require('../middleware/auth');
    const scope = scopeFilter(req);

    const orderMatch = { status: { $in: SALE_STATUSES }, ...scope };
    const manualMatch = { status: { $in: SALE_STATUSES }, order: { $exists: false }, ...scope };
    if (province) {
      orderMatch.province = province;
      manualMatch.province = province;
    }

    const dateFilter = buildDateFilter(range, req.query.from, req.query.to);
    if (dateFilter) {
      orderMatch.createdAt = dateFilter;
      manualMatch.createdAt = dateFilter;
    }

    let groupId;
    if (groupBy === 'day')   groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };
    if (groupBy === 'week')  groupId = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
    if (groupBy === 'month') groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
    if (groupBy === 'year')  groupId = { year: { $year: '$createdAt' } };

    const [orderData, manualData] = await Promise.all([
      Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id:        groupId,
            totalSales: { $sum: '$grandTotal' },
            collected:  { $sum: '$collectedAmount' },
            orders:     { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
      ]),
      Sale.aggregate([
        { $match: manualMatch },
        {
          $group: {
            _id:        groupId,
            totalSales: { $sum: '$grandTotal' },
            collected:  { $sum: '$collectedAmount' },
            orders:     { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
      ]),
    ]);

    const combinedMap = new Map();
    const mergeRow = (row) => {
      const key = JSON.stringify(row._id);
      const existing = combinedMap.get(key);
      if (existing) {
        existing.totalSales += row.totalSales;
        existing.collected += row.collected;
        existing.orders += row.orders;
      } else {
        combinedMap.set(key, { ...row });
      }
    };
    orderData.forEach(mergeRow);
    manualData.forEach(mergeRow);

    const merged = Array.from(combinedMap.values());
    merged.sort((a, b) => {
      if (a._id.year !== b._id.year) return a._id.year - b._id.year;
      if (groupBy === 'month' || groupBy === 'day') {
        if (a._id.month !== b._id.month) return a._id.month - b._id.month;
      }
      if (groupBy === 'week') {
        if (a._id.week !== b._id.week) return a._id.week - b._id.week;
      }
      if (groupBy === 'day') {
        if (a._id.day !== b._id.day) return a._id.day - b._id.day;
      }
      return 0;
    });

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const formatted = merged.map(d => {
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

router.post('/manual', protect, async (req, res) => {
  try {
    const {
      order,
      orderNumber,
      salesperson,
      dealer,
      date,
      province,
      area,
      grandTotal,
      collectedAmount,
      paymentType,
      status = 'completed',
      items = [],
      remarks = '',
    } = req.body;

    if (!salesperson || !dealer || !province || !area) {
      return res.status(400).json({ success: false, message: 'salesperson, dealer, province, and area are required' });
    }

    // Build order items with correct amounts (fixed excise/vat × qty)
    const orderItems = (items || []).filter(it => it.product).map(it => {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const basic = qty * rate;
      const excise = (Number(it.exciseAmount) || 0) * qty;
      const vat = (Number(it.vatAmount) || 0) * qty;
      return {
        product: it.product,
        productName: it.productName,
        customerType: it.customerType || 'MM',
        ml: it.ml,
        up: it.up,
        quantity: qty,
        rate,
        basicAmount: basic,
        exciseAmount: excise,
        vatAmount: vat,
        grandTotal: basic + excise + vat,
      };
    });

    const computedGrandTotal = orderItems.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const finalGrandTotal = Number(grandTotal) || computedGrandTotal;
    const finalCollected = collectedAmount !== undefined && collectedAmount !== '' ? Number(collectedAmount) : finalGrandTotal;

    // Resolve salesperson to hierarchy field
    const User = require('../models/User');
    const sp = await User.findById(salesperson).lean();
    const hierarchyField = sp ? (sp.role === 'so' ? 'so' : sp.role === 'se' ? 'se' : sp.role === 'asm' ? 'asm' : sp.role === 'rsm' ? 'rsm' : sp.role === 'nsm' ? 'nsm' : 'se') : 'se';

    // Create Order record so it appears in All Orders table
    const newOrder = await Order.create({
      [hierarchyField]: salesperson,
      dealer,
      date: date ? new Date(date) : new Date(),
      province,
      area,
      items: orderItems,
      totalBasicAmount: orderItems.reduce((s, i) => s + (i.basicAmount || 0), 0),
      totalExciseAmount: orderItems.reduce((s, i) => s + (i.exciseAmount || 0), 0),
      totalVatAmount: orderItems.reduce((s, i) => s + (i.vatAmount || 0), 0),
      grandTotal: finalGrandTotal,
      collectedAmount: finalCollected,
      paymentType: paymentType || 'cash',
      status: 'completed',
      remarks,
      createdBy: req.user._id,
    });

    const normalizedItems = normalizeSaleItems(items);
    const saleData = {
      manualSaleId:   `MSALE-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      salesperson,
      dealer,
      date: date ? new Date(date) : new Date(),
      province,
      area,
      items: normalizedItems,
      grandTotal: finalGrandTotal,
      collectedAmount: finalCollected,
      paymentType:    paymentType || 'cash',
      status,
      staffId:        req.user._id,
      createdBy:      req.user._id,
      remarks,
      invoiceNumber: buildInvoiceNumber(),
      order: newOrder._id,
      orderNumber: newOrder.orderNumber,
    };

    const sale = await Sale.create(saleData);

    return res.status(201).json({ success: true, data: sale, order: newOrder });
  } catch (err) {
    console.error('manual sale failed:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/eligible-orders', protect, async (req, res) => {
  try {
    const { province } = req.query;
    const match = { status: 'delivered' };
    if (province) match.province = province;
    if (req.user.role === 'staff') match.staffId = req.user._id;

    const orders = await Order.find(match)
      .populate('dealer', 'dealerName area province')
      .populate('so se asm rsm nsm', 'name employeeId role')
      .populate('items.product', 'productName sku rate')
      .sort('-createdAt');

    const existingSales = await Sale.find({ order: { $in: orders.map(order => order._id) } }).select('order');
    const existingOrderIds = new Set(existingSales.map(sale => sale.order?.toString()).filter(Boolean));
    const eligibleOrders = orders.filter(order => !existingOrderIds.has(order._id.toString()));

    return res.json({ success: true, data: eligibleOrders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/from-order', protect, async (req, res) => {
  try {
    const {
      order,
      orderNumber,
      salesperson,
      dealer,
      date,
      province,
      area,
      grandTotal,
      collectedAmount,
      paymentType,
      status = 'completed',
      items = [],
      remarks = '',
    } = req.body;

    if (!order) {
      return res.status(400).json({ success: false, message: 'order is required' });
    }

    const sourceOrder = await Order.findById(order);
    if (!sourceOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const existingSale = await Sale.findOne({ order: sourceOrder._id });
    if (existingSale) {
      return res.status(409).json({ success: false, message: 'A sale already exists for this order' });
    }

    const normalizedItems = normalizeSaleItems(items);
    const computedGrandTotal = normalizedItems.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const finalGrandTotal = grandTotal ?? computedGrandTotal;

    const saleData = {
      order: sourceOrder._id,
      orderNumber: orderNumber || sourceOrder.orderNumber,
      invoiceNumber: buildInvoiceNumber(),
      salesperson: salesperson || sourceOrder.so || sourceOrder.se || sourceOrder.asm || sourceOrder.rsm || sourceOrder.nsm,
      dealer: dealer || sourceOrder.dealer,
      date: date ? new Date(date) : sourceOrder.date || new Date(),
      province: province || sourceOrder.province,
      area: area || sourceOrder.area,
      items: normalizedItems,
      grandTotal: finalGrandTotal,
      collectedAmount: collectedAmount ?? finalGrandTotal,
      paymentType: paymentType || sourceOrder.paymentType || 'cash',
      status,
      staffId: req.user._id,
      createdBy: req.user._id,
      remarks,
    };

    if (!saleData.salesperson) {
      return res.status(400).json({ success: false, message: 'No salesperson assigned to this order' });
    }
    const sale = await Sale.create(saleData);
    return res.status(201).json({ success: true, data: sale });
  } catch (err) {
    console.error('manual sale failed:', err);
    return res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/sales/orders
 * Paginated list of active orders, filterable by province
 */
router.get('/orders', protect, async (req, res) => {
  try {
    const { province, range = 'all', from, to, page = 1, limit = 20 } = req.query;
    const { scopeFilter } = require('../middleware/auth');
    const scope = scopeFilter(req);
    const match = { status: { $in: SALE_STATUSES }, ...scope };
    if (province) match.province = province;

    const dateFilter = buildDateFilter(range, from, to);
    if (dateFilter) match.createdAt = dateFilter;

    const total = await Order.countDocuments(match);
    const data  = await Order.find(match)
      .populate('dealer',      'dealerName area')
      .populate('so se asm rsm nsm', 'name employeeId')
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

    const User = require('../models/User');

    // Get all orders for this province to collect every staff ID
    const provinceOrders = await Order.find(
      { province, status: { $in: SALE_STATUSES } },
      'se so asm rsm nsm grandTotal collectedAmount'
    ).lean();

    // Collect unique staff IDs across all hierarchy fields
    const staffIdSet = new Set();
    const salesMap = {};
    provinceOrders.forEach(o => {
      ['se','so','asm','rsm','nsm'].forEach(field => {
        if (o[field]) {
          const id = String(o[field]);
          staffIdSet.add(id);
          if (!salesMap[id]) salesMap[id] = { totalSales: 0, collected: 0, orderCount: 0 };
          salesMap[id].totalSales += o.grandTotal || 0;
          salesMap[id].collected  += o.collectedAmount || 0;
          salesMap[id].orderCount += 1;
        }
      });
    });

    if (!staffIdSet.size) return res.json({ success: true, data: [] });

    const staff = await User.find({ _id: { $in: [...staffIdSet] } })
      .select('name role area province employeeId');

    const data = staff.map(sp => {
      const s = salesMap[String(sp._id)] || {};
      return {
        _id:        sp._id,
        fullName:   sp.name,
        designation: sp.role?.toUpperCase(),
        area:       sp.area || '—',
        employeeId: sp.employeeId || '—',
        status:     'active',
        totalSales: s.totalSales || 0,
        collected:  s.collected  || 0,
        orderCount: s.orderCount || 0,
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
    const { status, province, range = 'all', from, to, page = 1, limit = 20 } = req.query;
    const { scopeFilter } = require('../middleware/auth');
    const scope = scopeFilter(req);

    const match = {};
    if (status)   match.status   = status;
    if (province) match.province = province;

    const dateFilter = buildDateFilter(range, from, to);
    if (dateFilter) match.date = dateFilter;

    // Scope: find orders matching this user's hierarchy, then filter sales by those orders
    // For admin/nsm — no restriction
    const isUnrestricted = ['admin', 'nsm'].includes(req.user.role);
    if (!isUnrestricted && Object.keys(scope).length > 0) {
      const scopedOrders = await Order.find(scope).select('_id').lean();
      const orderIds = scopedOrders.map(o => o._id);
      match.$or = [
        { order: { $in: orderIds } },
        { salesperson: req.user._id },
      ];
    }

    const total = await Sale.countDocuments(match);
    const data  = await Sale.find(match)
      .populate('order',       'orderNumber date grandTotal paymentType')
      .populate('salesperson', 'name fullName role')
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
