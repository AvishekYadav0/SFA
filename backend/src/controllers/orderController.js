const Order = require('../models/Order');
const Sale  = require('../models/Sale');

const buildItemTotals = (items = []) => items.map(item => {
  const basic  = (item.quantity || 0) * (item.rate || 0);
  const excise = basic * ((item.excisePercent || 0) / 100);
  const vat    = (basic + excise) * ((item.vatPercent || 0) / 100);
  return { ...item, basicAmount: basic, exciseAmount: excise, vatAmount: vat, grandTotal: basic + excise + vat };
});

const buildOrderTotals = (items = []) => {
  const normalizedItems = buildItemTotals(items);
  return normalizedItems.reduce((acc, item) => ({
    totalBasicAmount:  acc.totalBasicAmount  + (item.basicAmount || 0),
    totalExciseAmount: acc.totalExciseAmount + (item.exciseAmount || 0),
    totalVatAmount:    acc.totalVatAmount    + (item.vatAmount || 0),
    grandTotal:        acc.grandTotal        + (item.grandTotal || 0),
  }), { totalBasicAmount: 0, totalExciseAmount: 0, totalVatAmount: 0, grandTotal: 0 });
};

exports.getAll = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = {};

    if (req.query.status)     filter.status     = req.query.status;
    if (req.query.salesperson) filter.salesperson = req.query.salesperson;
    if (req.query.dealer)     filter.dealer     = req.query.dealer;
    if (req.query.province)   filter.province   = req.query.province;
    if (req.query.startDate && req.query.endDate)
      filter.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };

    // Staff: restrict to their own province and their own records
    if (req.user.role === 'staff') {
      filter.province = req.user.province;
      filter.staffId  = req.user._id;
    }

    const total = await Order.countDocuments(filter);
    const data  = await Order.find(filter)
      .populate('salesperson', 'fullName employeeId')
      .populate('dealer', 'dealerName province')
      .populate('items.product', 'productName')
      .populate('staffId', 'name province')
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
    const data = await Order.findById(req.params.id)
      .populate('salesperson').populate('dealer').populate('items.product').populate('staffId', 'name province');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });

    // Staff can only view their own province records
    if (req.user.role === 'staff' && data.province !== req.user.province)
      return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const items = buildItemTotals(req.body.items || []);
    const totals = buildOrderTotals(items);

    // Auto-assign province from staff; admin must provide it
    const province = req.user.role === 'staff' ? req.user.province : req.body.province;
    if (!province) return res.status(400).json({ success: false, message: 'Province is required' });

    const data = await Order.create({
      ...req.body, items, ...totals,
      province,
      staffId:   req.user._id,
      createdBy: req.user._id,
    });

    // Re-fetch to get orderNumber set by pre-save hook
    const saved = await Order.findById(data._id);

    // Auto-create linked Sale record
    await Sale.create({
      order:          saved._id,
      orderNumber:    saved.orderNumber,
      salesperson:    saved.salesperson,
      dealer:         saved.dealer,
      province:       saved.province,
      area:           saved.area,
      grandTotal:     saved.grandTotal,
      collectedAmount: saved.collectedAmount || 0,
      paymentType:    saved.paymentMethod || 'cash',
      status:         'pending',
      staffId:        req.user._id,
      createdBy:      req.user._id,
    });

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });

    if (req.user.role === 'staff') {
      if (order.staffId?.toString() !== req.user._id.toString())
        return res.status(403).json({ success: false, message: 'Access denied' });
      if (order.status !== 'pending')
        return res.status(403).json({ success: false, message: 'Can only edit pending orders' });
      // Staff cannot change province
      delete req.body.province;
    }

    if (req.body.items) {
      req.body.items = buildItemTotals(req.body.items);
      Object.assign(req.body, buildOrderTotals(req.body.items));
    }

    const data = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.review = async (req, res) => {
  try {
    const { action, remarks, items } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });

    const update = {};

    if (Array.isArray(items)) {
      const normalizedItems = buildItemTotals(items);
      Object.assign(update, { items: normalizedItems, ...buildOrderTotals(normalizedItems) });
    }

    if (typeof remarks === 'string') update.approvalRemarks = remarks;

    if (action === 'approve') {
      update.status = 'approved';
      update.approvedAt = new Date();
      update.approvedBy = req.user._id;
      update.reviewAction = 'approved';
    } else if (action === 'reject') {
      update.status = 'rejected';
      update.reviewAction = 'rejected';
    } else if (action === 'hold') {
      update.status = 'hold';
      update.reviewAction = 'hold';
    } else {
      update.reviewAction = 'saved';
    }

    const historyEntry = {
      action: action || 'saved',
      remarks: remarks || '',
      performedBy: req.user._id,
      performedAt: new Date(),
    };

    update.reviewHistory = [...(order.reviewHistory || []), historyEntry];

    const data = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    await Sale.findOneAndUpdate({ order: req.params.id }, { status: data.status });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, collectedAmount, paymentMethod } = req.body;
    const update = { status };

    if (status === 'approved')          { update.approvedAt = new Date(); update.approvedBy = req.user._id; }
    if (status === 'warehouse')         { update.warehouseAt = new Date(); }
    if (status === 'out_for_delivery')  { update.dispatchedAt = new Date(); }
    if (status === 'delivered')         { update.deliveredAt = new Date(); }
    if (status === 'completed') {
      update.paidAt = new Date();
      if (collectedAmount !== undefined) update.collectedAmount = collectedAmount;
      if (paymentMethod)                update.paymentMethod = paymentMethod;
    }

    const data = await Order.findByIdAndUpdate(req.params.id, update, { new: true });

    // Keep Sale status in sync with Order status
    await Sale.findOneAndUpdate({ order: req.params.id }, { status });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
