const Order  = require('../models/Order');
const Dealer = require('../models/Dealer');
const { scopeFilter, hierarchyFields } = require('../middleware/auth');

const calcItems = (items = []) => items.map(item => {
  const qty    = item.quantity || 0;
  const basic  = qty * (item.rate || 0);
  const excise = (item.exciseAmount || 0) * qty;
  const vat    = (item.vatAmount    || 0) * qty;
  return { ...item, basicAmount: basic, exciseAmount: excise, vatAmount: vat, grandTotal: basic + excise + vat };
});

const calcTotals = (items) => items.reduce((a, i) => ({
  totalBasicAmount:  a.totalBasicAmount  + (i.basicAmount  || 0),
  totalExciseAmount: a.totalExciseAmount + (i.exciseAmount || 0),
  totalVatAmount:    a.totalVatAmount    + (i.vatAmount    || 0),
  grandTotal:        a.grandTotal        + (i.grandTotal   || 0),
}), { totalBasicAmount: 0, totalExciseAmount: 0, totalVatAmount: 0, grandTotal: 0 });

exports.getAll = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const filter = { ...scopeFilter(req) };
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.dealer)   filter.dealer   = req.query.dealer;
    if (req.query.se)       filter.se       = req.query.se;
    if (req.query.so)       filter.so       = req.query.so;
    if (req.query.asm)      filter.asm      = req.query.asm;
    if (req.query.province) filter.province = req.query.province;
    if (req.query.startDate && req.query.endDate)
      filter.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };

    const total = await Order.countDocuments(filter);
    const data  = await Order.find(filter)
      .populate('se',  'name employeeId')
      .populate('so',  'name employeeId')
      .populate('asm', 'name')
      .populate('rsm', 'name')
      .populate('nsm', 'name')
      .populate('dealer', 'dealerName area province')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit);

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const { scopeFilter } = require('../middleware/auth');
    const scope = scopeFilter(req);
    const data = await Order.findOne({ _id: req.params.id, ...scope })
      .populate('se so asm rsm nsm', 'name phone')
      .populate('dealer', 'dealerName phone address')
      .populate('items.product', 'productName ml up');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.create = async (req, res) => {
  try {
    const User   = require('../models/User');
    const dealer = await Dealer.findById(req.body.dealer);
    const items  = calcItems(req.body.items || []);
    const totals = calcTotals(items);

    // Use the dealer-selected User as the order owner when an admin creates it.
    let creator = req.user;
    const selectedSalesperson = req.body.salesperson || req.body.se || req.body.so;
    if (['admin', 'nsm', 'rsm', 'asm'].includes(req.user.role) && selectedSalesperson) {
      creator = await User.findById(selectedSalesperson);
    }
    let hierarchy = await hierarchyFields(creator);
    if (creator && ['nsm', 'rsm', 'asm'].includes(creator.role)) {
      hierarchy = {
        se:  null,
        so:  null,
        asm: creator.role === 'asm' ? creator._id : (creator.asm || null),
        rsm: creator.role === 'rsm' ? creator._id : (creator.rsm || null),
        nsm: creator.role === 'nsm' ? creator._id : (creator.nsm || null),
      };
    }

    const data = await Order.create({
      ...req.body,
      items,
      ...totals,
      ...hierarchy,
      province: dealer?.province || req.body.province,
      district: dealer?.district || req.body.district,
      area:     dealer?.area     || req.body.area,
      region:   dealer?.region   || req.body.region,
      createdBy: req.user._id,
    });

    await Dealer.findByIdAndUpdate(req.body.dealer, { lastOrderDate: new Date() });
    const saved = await Order.findById(data._id)
      .populate('se so asm rsm nsm dealer', 'name dealerName area');
    res.status(201).json({ success: true, data: saved });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.update = async (req, res) => {
  try {
    if (req.body.items) {
      req.body.items = calcItems(req.body.items);
      Object.assign(req.body, calcTotals(req.body.items));
    }
    const data = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (req.body.collectedAmount !== undefined) update.collectedAmount = Number(req.body.collectedAmount) || 0;
    if (req.body.paymentMethod) update.paymentType = req.body.paymentMethod;
    const now = new Date();
    if (status === 'approved')        { update.approvedAt = now; update.approvedBy = req.user._id; }
    if (status === 'warehouse')         update.warehouseAt    = now;
    if (status === 'out_for_delivery')  update.dispatchedAt   = now;
    if (status === 'delivered')         update.deliveredAt    = now;
    if (status === 'completed')         update.completedAt    = now;
    const data = await Order.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!data) return res.status(404).json({ success: false, message: 'Order not found' });

    // ── DELIVERED → create COMPANY_DISPATCH stock transactions ────────────────
    if (status === 'delivered') {
      const DealerStockTransaction = require('../models/DealerStockTransaction');
      for (const item of data.items) {
        const exists = await DealerStockTransaction.findOne({
          dealer:          data.dealer,
          product:         item.product,
          transactionType: 'COMPANY_DISPATCH',
          referenceType:   'Order',
          referenceId:     data._id,
        }).select('_id').lean();
        if (!exists) {
          await DealerStockTransaction.create({
            dealer:          data.dealer,
            product:         item.product,
            transactionDate: new Date(),
            transactionType: 'COMPANY_DISPATCH',
            quantity:        item.quantity,
            referenceType:   'Order',
            referenceId:     data._id,
            remarks:         `Auto: Order ${data.orderNumber} delivered`,
            createdBy:       req.user._id,
          });
        }
      }
    }

    // ── REVERSAL → create RETURN_TO_COMPANY to offset COMPANY_DISPATCH ────────
    if ((status === 'cancelled' || status === 'rejected') && data.deliveredAt) {
      const DealerStockTransaction = require('../models/DealerStockTransaction');
      for (const item of data.items) {
        const reversalExists = await DealerStockTransaction.findOne({
          dealer:          data.dealer,
          product:         item.product,
          transactionType: 'RETURN_TO_COMPANY',
          referenceType:   'Order',
          referenceId:     data._id,
        }).select('_id').lean();
        if (!reversalExists) {
          await DealerStockTransaction.create({
            dealer:          data.dealer,
            product:         item.product,
            transactionDate: new Date(),
            transactionType: 'RETURN_TO_COMPANY',
            quantity:        item.quantity,
            referenceType:   'Order',
            referenceId:     data._id,
            remarks:         `Reversal: Order ${data.orderNumber} ${status} after delivery`,
            createdBy:       req.user._id,
          });
        }
      }
    }

    if (status === 'completed') {
      const Sale = require('../models/Sale');
      const existingSale = await Sale.findOne({ order: data._id }).select('_id');
      if (!existingSale) {
        const assignedUser = data.so || data.se || data.asm || data.rsm || data.nsm;
        await Sale.create({
          order: data._id,
          orderNumber: data.orderNumber,
          dealer: data.dealer,
          salesperson: assignedUser,
          province: data.province,
          area: data.area,
          date: data.date,
          items: data.items,
          grandTotal: data.grandTotal,
          collectedAmount: data.collectedAmount || 0,
          paymentType: data.paymentType || 'cash',
          status: 'completed',
          staffId: req.user._id,
          createdBy: req.user._id,
        });
      }
    }
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.reviewOrder = async (req, res) => {
  try {
    const { action, remarks, items } = req.body;
    const update = {};
    if (remarks) update.approvalRemarks = remarks;
    if (action === 'approve') {
      update.status = 'approved';
      update.approvedAt = new Date();
      update.approvedBy = req.user._id;
    } else if (action === 'reject') {
      update.status = 'rejected';
    } else if (action === 'hold') {
      update.status = 'hold';
    } else if (action === 'save' && items) {
      const recalcItems = calcItems(items);
      update.items = recalcItems;
      Object.assign(update, calcTotals(recalcItems));
    }
    const data = await Order.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('se so asm rsm nsm dealer', 'name dealerName area');
    if (!data) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
