const mongoose = require('mongoose');
const MonthlyPlanning = require('../models/MonthlyPlanning');
const Order = require('../models/Order');
const Collection = require('../models/Collection');
const { scopeFilter } = require('../middleware/auth');

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

async function getOrCreateCurrentMonthPlanning(user) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const planning = await MonthlyPlanning.findOneAndUpdate(
    { month, year },
    { $setOnInsert: { target: 5000000, schemeBudget: 120000, setBy: user?._id } },
    { upsert: true, new: true }
  );
  return planning;
}

exports.getCurrent = async (req, res) => {
  try {
    const planning = await getOrCreateCurrentMonthPlanning(req.user);
    const now = new Date();
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const rawScope = scopeFilter(req);
    const { role, _id } = req.user;

    // Use createdBy fallback so orders created before hierarchy was stamped are included
    const scope = role === 'admin' ? {} : {
      $or: [
        rawScope,
        { createdBy: _id },
      ]
    };

    const activeSaleMatch = { status: { $nin: ['cancelled', 'rejected'] } };

    const salesAgg = await Order.aggregate([
      { $match: { ...scope, date: { $gte: last30Days, $lte: today }, ...activeSaleMatch } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } },
    ]);
    const salesTillToday = salesAgg[0]?.total || 0;

    const collectionAgg = await Collection.aggregate([
      { $match: { date: { $gte: last30Days, $lte: today } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const collectedThisMonth = collectionAgg[0]?.total || 0;

    const outstandingAgg = await Order.aggregate([
      { $match: { ...scope, date: { $gte: last30Days }, ...activeSaleMatch } },
      { $group: { _id: null, expectedCollection: { $sum: '$grandTotal' } } },
    ]);
    const expectedCollection = outstandingAgg[0]?.expectedCollection || 0;

    const target = planning.target || 5000000;
    const achievement = target > 0 ? Math.round((salesTillToday / target) * 100) : 0;
    const balance = Math.max(0, target - salesTillToday);

    res.json({ success: true, data: {
      month: planning.month,
      year: planning.year,
      target,
      schemeBudget: planning.schemeBudget || 120000,
      salesTillToday,
      achievement,
      balance,
      expectedCollection,
      collectedThisMonth,
      planning,
    } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const data = await MonthlyPlanning.find().sort('-year -month');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const data = await MonthlyPlanning.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const now = new Date();
    const month = req.body.month || now.getMonth() + 1;
    const year = req.body.year || now.getFullYear();
    const data = await MonthlyPlanning.findOneAndUpdate(
      { month, year },
      { ...req.body, setBy: req.user._id },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
