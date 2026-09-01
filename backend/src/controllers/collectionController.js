const mongoose = require('mongoose');
const Collection = require('../models/Collection');
const Dealer = require('../models/Dealer');
const Sale = require('../models/Sale');
const DealerLedger = require('../models/DealerLedger');
const { scopeFilter, hierarchyFields } = require('../middleware/auth');

const ACTIVE_SALE_STATUSES = ['pending', 'approved', 'hold', 'warehouse', 'out_for_delivery', 'delivered', 'completed'];

// Recalculate dealer outstanding from actual order remaining balances
async function syncDealerOutstanding(dealerId, session) {
  const Order = require('../models/Order');
  const orders = await Order.find({ dealer: dealerId, status: { $in: ACTIVE_SALE_STATUSES } })
    .select('grandTotal collectedAmount').session(session);
  const dealer = await Dealer.findById(dealerId).select('openingBalance creditLimit creditNotes').session(session);
  if (!dealer) return;
  const invoiceRemaining = orders.reduce((sum, o) => sum + Math.max(0, (o.grandTotal || 0) - (o.collectedAmount || 0)), 0);
  const outstandingAmount = Math.max(0, Number(dealer.openingBalance || 0) + invoiceRemaining - Number(dealer.creditNotes || 0));
  await Dealer.findByIdAndUpdate(dealerId, { outstandingAmount }, { session });
  return outstandingAmount;
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = startOfDay(value);
  date.setDate(date.getDate() + 1);
  return date;
}

async function recalculateDealer(dealerId, session) {
  const today = startOfDay();
  const [dealer, salesAgg, collectionAgg, dueTodayAgg, overdueAgg] = await Promise.all([
    Dealer.findById(dealerId).session(session),
    Sale.aggregate([
      { $match: { dealer: new mongoose.Types.ObjectId(dealerId), status: { $in: ACTIVE_SALE_STATUSES } } },
      { $group: { _id: null, totalSales: { $sum: '$grandTotal' } } },
    ]).session(session),
    Collection.aggregate([
      { $match: { dealer: new mongoose.Types.ObjectId(dealerId) } },
      { $group: { _id: null, totalCollections: { $sum: '$amount' } } },
    ]).session(session),
    Sale.aggregate([
      { $match: { dealer: new mongoose.Types.ObjectId(dealerId), status: { $in: ACTIVE_SALE_STATUSES }, remainingBalance: { $gt: 0 }, dueDate: { $gte: today, $lt: endOfDay(today) } } },
      { $group: { _id: null, total: { $sum: '$remainingBalance' } } },
    ]).session(session),
    Sale.aggregate([
      { $match: { dealer: new mongoose.Types.ObjectId(dealerId), status: { $in: ACTIVE_SALE_STATUSES }, remainingBalance: { $gt: 0 }, dueDate: { $lt: today } } },
      { $group: { _id: null, total: { $sum: '$remainingBalance' } } },
    ]).session(session),
  ]);

  if (!dealer) throw new Error('Dealer not found');
  const totalSales = salesAgg[0]?.totalSales || 0;
  const totalCollections = collectionAgg[0]?.totalCollections || 0;
  const outstandingAmount = Math.max(0, Number(dealer.openingBalance || 0) + totalSales - totalCollections - Number(dealer.creditNotes || 0));
  dealer.outstandingAmount = outstandingAmount;
  dealer.dueAmount = (dueTodayAgg[0]?.total || 0) + (overdueAgg[0]?.total || 0);
  dealer.overdueAmount = overdueAgg[0]?.total || 0;
  await dealer.save({ session });
  return { dealer, dueToday: dueTodayAgg[0]?.total || 0, overdueAmount: overdueAgg[0]?.total || 0 };
}

exports.getAll = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const filter = { ...scopeFilter(req) };
    if (req.query.dealer) filter.dealer = req.query.dealer;
    if (req.query.sale) filter['allocations.sale'] = req.query.sale;
    if (req.query.startDate || req.query.endDate) filter.date = {};
    if (req.query.startDate) filter.date.$gte = startOfDay(req.query.startDate);
    if (req.query.endDate) filter.date.$lt = endOfDay(req.query.endDate);

    const total = await Collection.countDocuments(filter);
    const data = await Collection.find(filter)
      .populate('dealer', 'dealerName dealerCode distributor province district creditLimit')
      .populate('allocations.sale', 'invoiceNumber date dueDate grandTotal paidAmount remainingBalance paymentStatus')
      .sort('-date')
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const data = await Collection.findById(req.params.id)
      .populate('dealer', 'dealerName dealerCode distributor province district creditLimit')
      .populate('allocations.sale', 'invoiceNumber date dueDate grandTotal paidAmount remainingBalance paymentStatus');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.dashboard = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const today = startOfDay();
    const month = new Date(today.getFullYear(), today.getMonth(), 1);
    const [todayCollection, monthlyCollection, dealers] = await Promise.all([
      Collection.aggregate([{ $match: { ...scope, date: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Collection.aggregate([{ $match: { ...scope, date: { $gte: month } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Dealer.find(scope).select('outstandingAmount dueAmount overdueAmount'),
    ]);

    res.json({ success: true, data: {
      todayCollection: todayCollection[0]?.total || 0,
      monthlyCollection: monthlyCollection[0]?.total || 0,
      totalOutstanding: dealers.reduce((sum, d) => sum + Number(d.outstandingAmount || 0), 0),
      dueToday: dealers.reduce((sum, d) => sum + Number(d.dueAmount || 0), 0),
      overdueAmount: dealers.reduce((sum, d) => sum + Number(d.overdueAmount || 0), 0),
    } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.invoices = async (req, res) => {
  try {
    const dealerId = req.params.dealerId;
    const Order = require('../models/Order');

    // Try Sale model first
    let invoices = await Sale.find({ dealer: dealerId, status: { $in: ACTIVE_SALE_STATUSES }, remainingBalance: { $gt: 0 } })
      .select('invoiceNumber date dueDate grandTotal paidAmount remainingBalance paymentStatus')
      .sort({ dueDate: 1, date: 1 });

    // Fallback: use Orders if no Sale records exist
    if (!invoices.length) {
      const orders = await Order.find({ dealer: dealerId, status: { $in: ['approved', 'pending', 'warehouse', 'out_for_delivery', 'delivered', 'completed'] } })
        .select('orderNumber date grandTotal collectedAmount status')
        .sort({ date: 1 });
      invoices = orders.map(o => ({
        _id: o._id,
        invoiceNumber: o.orderNumber,
        date: o.date,
        dueDate: o.date,
        grandTotal: o.grandTotal,
        paidAmount: o.collectedAmount || 0,
        remainingBalance: Math.max(0, (o.grandTotal || 0) - (o.collectedAmount || 0)),
        paymentStatus: (o.collectedAmount >= o.grandTotal) ? 'PAID' : (o.collectedAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
      })).filter(o => o.remainingBalance > 0);
    }

    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const dealerId = req.body.dealer;
    const totalAmount = Number(req.body.collectionAmount || req.body.amount || 0);
    if (!dealerId || !totalAmount || totalAmount <= 0) throw new Error('Dealer and positive collection amount are required');
    const dealer = await Dealer.findById(dealerId).populate('se so asm rsm nsm').session(session);
    if (!dealer) throw new Error('Dealer not found');

    const Order = require('../models/Order');
    let invoices = await Sale.find({ dealer: dealerId, status: { $in: ACTIVE_SALE_STATUSES }, remainingBalance: { $gt: 0 } }).sort({ dueDate: 1, date: 1 }).session(session);

    // Fallback to Orders if no Sale records
    let usingOrders = false;
    if (!invoices.length) {
      const orders = await Order.find({ dealer: dealerId, status: { $in: ['approved', 'pending', 'warehouse', 'out_for_delivery', 'delivered', 'completed'] } })
        .sort({ date: 1 }).session(session);
      invoices = orders.map(o => ({
        _id: o._id,
        invoiceNumber: o.orderNumber,
        date: o.date,
        dueDate: o.date,
        grandTotal: o.grandTotal || 0,
        paidAmount: o.collectedAmount || 0,
        remainingBalance: Math.max(0, (o.grandTotal || 0) - (o.collectedAmount || 0)),
        save: async (opts) => {
          await Order.findByIdAndUpdate(o._id, { collectedAmount: o.paidAmount }, opts);
        },
      })).filter(o => o.remainingBalance > 0);
      usingOrders = true;
    }
    if (!invoices.length) throw new Error('No unpaid invoices available for this dealer');

    const useFifo = req.body.fifo === true || req.body.fifo === 'true';
    const requested = useFifo ? invoices.map((invoice) => ({ sale: invoice._id })) : (Array.isArray(req.body.allocations) ? req.body.allocations : []);
    let remaining = totalAmount;
    const allocations = [];

    if (useFifo) {
      for (const invoice of invoices) {
        if (remaining <= 0) break;
        const allocationAmount = Math.min(invoice.remainingBalance, remaining);
        if (allocationAmount > 0) {
          allocations.push({ sale: invoice._id, invoiceNumber: invoice.invoiceNumber, amount: allocationAmount });
          remaining -= allocationAmount;
        }
      }
    } else {
      for (const item of requested) {
        const invoice = invoices.find((inv) => String(inv._id) === String(item.sale));
        if (!invoice) throw new Error('Invalid invoice selection');
        const amount = Number(item.amount || 0);
        if (!amount || amount <= 0 || amount > invoice.remainingBalance) throw new Error(`Allocation for ${invoice.invoiceNumber} is invalid`);
        allocations.push({ sale: invoice._id, invoiceNumber: invoice.invoiceNumber, amount });
        remaining -= amount;
      }
    }

    if (remaining > 0.01) throw new Error('Collection amount exceeds available invoice balances');

    session.startTransaction();
    const hierarchy = await hierarchyFields(req.user);
    const collectionDoc = await Collection.create([{
      dealer: dealerId,
      ...hierarchy,
      amount: totalAmount,
      date: req.body.collectionDate ? new Date(req.body.collectionDate) : new Date(),
      collectionDate: req.body.collectionDate ? new Date(req.body.collectionDate) : new Date(),
      paymentType: req.body.paymentMode || 'cash',
      reference: req.body.reference,
      chequeNumber: req.body.chequeNumber,
      bankName: req.body.bankName,
      transactionId: req.body.transactionId,
      remarks: req.body.remarks,
      allocations,
      province: dealer.province,
      district: dealer.district,
      area: dealer.area,
      region: dealer.region,
      status: 'verified',
      createdBy: req.user._id,
    }], { session });
    const collection = collectionDoc[0];

    for (const allocation of allocations) {
      if (usingOrders) {
        const Order = require('../models/Order');
        await Order.findByIdAndUpdate(allocation.sale, {
          $inc: { collectedAmount: allocation.amount }
        }, { session });
      } else {
        const sale = await Sale.findById(allocation.sale).session(session);
        sale.paidAmount = Number(sale.paidAmount || sale.collectedAmount || 0) + allocation.amount;
        sale.remainingBalance = Math.max(0, Number(sale.grandTotal || 0) - sale.paidAmount);
        sale.paymentStatus = sale.remainingBalance === 0 ? 'PAID' : (sale.paidAmount > 0 ? 'PARTIALLY_PAID' : (sale.dueDate < new Date() ? 'OVERDUE' : 'UNPAID'));
        await sale.save({ session });
      }
    }

    const outstandingAmount = await syncDealerOutstanding(dealerId, session);
    await DealerLedger.create([{
      dealer: dealerId,
      collection: collection._id,
      date: collection.date,
      type: 'collection',
      credit: totalAmount,
      balance: outstandingAmount || 0,
      reference: collection.collectionNumber,
      remarks: `Receipt against invoices: ${allocations.map((a) => a.invoiceNumber).join(', ')}`,
      createdBy: req.user._id,
    }], { session });

    await session.commitTransaction();
    res.status(201).json({ success: true, data: collection });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    res.status(400).json({ success: false, message: err.message });
  } finally {
    session.endSession();
  }
};

exports.update = (_req, res) => res.status(405).json({ success: false, message: 'Financial transactions cannot be edited; create a reversal or cancellation record' });
exports.remove = (_req, res) => res.status(405).json({ success: false, message: 'Financial transactions cannot be deleted; create a reversal or cancellation record' });
