const Order = require('../models/Order');

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
    const items = req.body.items.map(item => {
      const basic  = item.quantity * item.rate;
      const excise = basic * (item.excisePercent / 100);
      const vat    = (basic + excise) * (item.vatPercent / 100);
      return { ...item, basicAmount: basic, exciseAmount: excise, vatAmount: vat, grandTotal: basic + excise + vat };
    });

    const totals = items.reduce((acc, i) => ({
      totalBasicAmount:  acc.totalBasicAmount  + i.basicAmount,
      totalExciseAmount: acc.totalExciseAmount + i.exciseAmount,
      totalVatAmount:    acc.totalVatAmount    + i.vatAmount,
      grandTotal:        acc.grandTotal        + i.grandTotal,
    }), { totalBasicAmount: 0, totalExciseAmount: 0, totalVatAmount: 0, grandTotal: 0 });

    // Auto-assign province from staff; admin must provide it
    const province = req.user.role === 'staff' ? req.user.province : req.body.province;
    if (!province) return res.status(400).json({ success: false, message: 'Province is required' });

    const data = await Order.create({
      ...req.body, items, ...totals,
      province,
      staffId:   req.user._id,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data });
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
      req.body.items = req.body.items.map(item => {
        const basic  = item.quantity * item.rate;
        const excise = basic * (item.excisePercent / 100);
        const vat    = (basic + excise) * (item.vatPercent / 100);
        return { ...item, basicAmount: basic, exciseAmount: excise, vatAmount: vat, grandTotal: basic + excise + vat };
      });
      const totals = req.body.items.reduce((acc, i) => ({
        totalBasicAmount:  acc.totalBasicAmount  + i.basicAmount,
        totalExciseAmount: acc.totalExciseAmount + i.exciseAmount,
        totalVatAmount:    acc.totalVatAmount    + i.vatAmount,
        grandTotal:        acc.grandTotal        + i.grandTotal,
      }), { totalBasicAmount: 0, totalExciseAmount: 0, totalVatAmount: 0, grandTotal: 0 });
      Object.assign(req.body, totals);
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

exports.updateStatus = async (req, res) => {
  try {
    const data = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
