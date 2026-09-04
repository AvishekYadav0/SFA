const Order      = require('../models/Order');
const Collection = require('../models/Collection');
const Dealer     = require('../models/Dealer');
const DealerStockTransaction  = require('../models/DealerStockTransaction');
const DealerProductStockSetting = require('../models/DealerProductStockSetting');

// All handlers require role === 'dealer' and req.user.linkedDealer to be set.
const getDealerId = (req) => req.user.linkedDealer;

const stockAccumulators = () => ({
  openingStock:    { $sum: { $cond: [{ $eq: ['$transactionType', 'OPENING']           }, '$quantity', 0] } },
  companyDispatch: { $sum: { $cond: [{ $eq: ['$transactionType', 'COMPANY_DISPATCH']  }, '$quantity', 0] } },
  transferIn:      { $sum: { $cond: [{ $eq: ['$transactionType', 'TRANSFER_IN']       }, '$quantity', 0] } },
  adjustmentIn:    { $sum: { $cond: [{ $eq: ['$transactionType', 'ADJUSTMENT_IN']     }, '$quantity', 0] } },
  dealerSales:     { $sum: { $cond: [{ $eq: ['$transactionType', 'DEALER_SALE']       }, '$quantity', 0] } },
  transferOut:     { $sum: { $cond: [{ $eq: ['$transactionType', 'TRANSFER_OUT']      }, '$quantity', 0] } },
  damage:          { $sum: { $cond: [{ $eq: ['$transactionType', 'DAMAGE']            }, '$quantity', 0] } },
  expired:         { $sum: { $cond: [{ $eq: ['$transactionType', 'EXPIRED']           }, '$quantity', 0] } },
  sample:          { $sum: { $cond: [{ $eq: ['$transactionType', 'SAMPLE']            }, '$quantity', 0] } },
  promotional:     { $sum: { $cond: [{ $eq: ['$transactionType', 'PROMOTIONAL']       }, '$quantity', 0] } },
  returnToCompany: { $sum: { $cond: [{ $eq: ['$transactionType', 'RETURN_TO_COMPANY'] }, '$quantity', 0] } },
  adjustmentOut:   { $sum: { $cond: [{ $eq: ['$transactionType', 'ADJUSTMENT_OUT']    }, '$quantity', 0] } },
});

const closingStockExpr = {
  $subtract: [
    { $add: ['$openingStock', '$companyDispatch', '$transferIn', '$adjustmentIn'] },
    { $add: ['$dealerSales', '$transferOut', '$damage', '$expired', '$sample', '$promotional', '$returnToCompany', '$adjustmentOut'] },
  ],
};

exports.getStockStatus = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const dealerId = getDealerId(req);
    const match = { dealer: new mongoose.Types.ObjectId(dealerId) };

    const data = await DealerStockTransaction.aggregate([
      { $match: match },
      { $group: { _id: '$product', ...stockAccumulators() } },
      { $addFields: { closingStock: closingStockExpr } },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: '_product' } },
      { $unwind: { path: '$_product', preserveNullAndEmptyArrays: true } },
      { $project: {
        _id: 0,
        productId:       '$_id',
        productName:     '$_product.productName',
        openingStock: 1, companyDispatch: 1, dealerSales: 1, closingStock: 1,
        transferIn: 1,  transferOut: 1,    damage: 1,     expired: 1,
      }},
      { $sort: { productName: 1 } },
    ]);

    const settings = await DealerProductStockSetting.find({ dealer: dealerId }).lean();
    const settingMap = {};
    settings.forEach(s => { settingMap[String(s.product)] = s.minimumStock; });

    const result = data.map(row => {
      const minStock = settingMap[String(row.productId)] ?? 0;
      const closing  = row.closingStock;
      const stockStatus = closing <= 0 ? 'Out of Stock' : closing <= minStock ? 'Low Stock' : 'Healthy';
      return { ...row, minimumStock: minStock, stockStatus };
    });

    res.json({ success: true, data: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

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
