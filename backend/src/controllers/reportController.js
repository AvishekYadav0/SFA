const Order = require('../models/Order');
const Collection = require('../models/Collection');
const Lifting = require('../models/Lifting');
const mongoose = require('mongoose');

const buildFilter = (q) => {
  const filter = {};
  if (q.province)   filter.province = q.province;
  if (q.staffId)    filter.staffId  = new mongoose.Types.ObjectId(q.staffId);
  if (q.dealer)     filter.dealer   = new mongoose.Types.ObjectId(q.dealer);
  if (q.status)     filter.status   = q.status;
  if (q.startDate && q.endDate)
    filter.date = { $gte: new Date(q.startDate), $lte: new Date(q.endDate) };
  return filter;
};

exports.salesReport = async (req, res) => {
  const filter = { ...buildFilter(req.query), status: req.query.status || 'approved' };
  if (req.query.product) filter['items.product'] = new mongoose.Types.ObjectId(req.query.product);
  const data = await Order.find(filter)
    .populate('staffId', 'name province').populate('dealer', 'dealerName area province')
    .populate('items.product', 'productName brand').sort('-date');
  res.json({ success: true, data });
};

exports.collectionReport = async (req, res) => {
  const filter = buildFilter(req.query);
  if (req.query.month) filter.month = req.query.month;
  const data = await Collection.find(filter)
    .populate('dealer', 'dealerName area province')
    .populate('staffId', 'name province').sort('-createdAt');
  res.json({ success: true, data });
};

exports.liftingReport = async (req, res) => {
  const filter = buildFilter(req.query);
  if (req.query.order) filter.order = new mongoose.Types.ObjectId(req.query.order);
  const data = await Lifting.find(filter)
    .populate('order', 'orderNumber').populate('dealer', 'dealerName')
    .populate('product', 'productName').populate('staffId', 'name province')
    .sort('-createdAt');
  res.json({ success: true, data });
};

exports.dealerOutstanding = async (req, res) => {
  const match = {};
  if (req.query.province) match.province = req.query.province;
  if (req.query.dealer)   match.dealer   = new mongoose.Types.ObjectId(req.query.dealer);
  const data = await Collection.aggregate([
    { $match: match },
    { $group: { _id: '$dealer', province: { $first: '$province' }, totalDue: { $sum: '$totalDue' }, totalCollection: { $sum: '$totalCollection' }, closingBalance: { $sum: '$closingBalance' } } },
    { $lookup: { from: 'dealers', localField: '_id', foreignField: '_id', as: 'dealer' } },
    { $unwind: '$dealer' },
    { $project: { dealerName: '$dealer.dealerName', area: '$dealer.area', province: 1, totalDue: 1, totalCollection: 1, closingBalance: 1 } },
    { $sort: { closingBalance: -1 } },
  ]);
  res.json({ success: true, data });
};

exports.salespersonPerformance = async (req, res) => {
  const match = { status: 'approved' };
  if (req.query.province) match.province = req.query.province;
  if (req.query.staffId)  match.staffId  = new mongoose.Types.ObjectId(req.query.staffId);
  if (req.query.startDate && req.query.endDate)
    match.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };
  const data = await Order.aggregate([
    { $match: match },
    { $group: { _id: '$staffId', totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staff' } },
    { $unwind: { path: '$staff', preserveNullAndEmpty: true } },
    { $project: { name: '$staff.name', province: '$staff.province', designation: '$staff.designation', totalSales: 1, orderCount: 1 } },
    { $sort: { totalSales: -1 } },
  ]);
  res.json({ success: true, data });
};

exports.productWiseSales = async (req, res) => {
  const match = { status: 'approved' };
  if (req.query.province) match.province = req.query.province;
  const data = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', productName: { $first: '$items.productName' }, totalQty: { $sum: '$items.quantity' }, totalAmount: { $sum: '$items.grandTotal' } } },
    { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmpty: true } },
    { $project: { productName: { $ifNull: ['$product.productName', '$productName'] }, brand: '$product.brand', category: '$product.category', totalQty: 1, totalAmount: 1 } },
    { $sort: { totalAmount: -1 } },
  ]);
  res.json({ success: true, data });
};

exports.provinceWiseSales = async (req, res) => {
  const data = await Order.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: '$province', totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 } } },
    { $sort: { totalSales: -1 } },
  ]);
  res.json({ success: true, data });
};

exports.monthlySalesReport = async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const match = { status: 'approved', date: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) } };
  if (req.query.province) match.province = req.query.province;
  const data = await Order.aggregate([
    { $match: match },
    { $group: { _id: { month: { $month: '$date' } }, totalSales: { $sum: '$grandTotal' }, orderCount: { $sum: 1 }, totalBasic: { $sum: '$totalBasicAmount' }, totalExcise: { $sum: '$totalExciseAmount' }, totalVat: { $sum: '$totalVatAmount' } } },
    { $sort: { '_id.month': 1 } },
  ]);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const result = months.map((name, i) => {
    const found = data.find(d => d._id.month === i + 1);
    return { month: name, totalSales: found?.totalSales || 0, orderCount: found?.orderCount || 0, totalBasic: found?.totalBasic || 0, totalExcise: found?.totalExcise || 0, totalVat: found?.totalVat || 0 };
  });
  res.json({ success: true, data: result });
};
