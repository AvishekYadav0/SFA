const Product = require('../models/Product');

exports.getAll = async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 10;
  const filter = {};
  if (req.query.search) filter.$or = [{ productName: new RegExp(req.query.search, 'i') }];
  if (req.query.status) filter.status = req.query.status;
  const total = await Product.countDocuments(filter);
  const data  = await Product.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit);
  res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
};

exports.getOne = async (req, res) => {
  const data = await Product.findById(req.params.id);
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data });
};

exports.create = async (req, res) => {
  const { productName, ml, up, amount, customerType, customerPrice, exciseAmount, vatAmount, status } = req.body;
  if (!productName) return res.status(400).json({ success: false, message: 'Product Name is required' });
  if (amount === undefined || amount === null) return res.status(400).json({ success: false, message: 'Amount is required' });
  const data = await Product.create({ productName, ml, up, amount, customerType, customerPrice, exciseAmount, vatAmount, status, createdBy: req.user._id });
  res.status(201).json({ success: true, data });
};

exports.update = async (req, res) => {
  const { productName, ml, up, amount, customerType, customerPrice, exciseAmount, vatAmount, status } = req.body;
  const data = await Product.findByIdAndUpdate(
    req.params.id,
    { productName, ml, up, amount, customerType, customerPrice, exciseAmount, vatAmount, status },
    { new: true }
  );
  if (!data) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, data });
};

exports.remove = async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Deleted' });
};

// shared upsert logic
const bulkUpsert = async (req, res, customerType) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0)
    return res.status(400).json({ success: false, message: 'products array is required' });

  const summary = { updated: 0, created: 0, skipped: [] };

  for (const row of products) {
    const { productName, ml, up, amount, customerPrice, exciseAmount, vatAmount } = row;
    if (!productName || !ml) {
      summary.skipped.push({ productName, reason: 'Missing productName or ml' });
      continue;
    }

    const filter = {
      productName:  { $regex: new RegExp(`^${productName.trim()}$`, 'i') },
      ml:           { $regex: new RegExp(`^${ml.trim()}$`, 'i') },
      customerType,
    };

    const updateFields = {
      productName:   productName.trim(),
      ml:            ml.trim(),
      up:            up != null ? String(up) : '',
      amount:        Number(amount)        || 0,
      customerType,
      customerPrice: Number(customerPrice) || 0,
      exciseAmount:  Number(exciseAmount)  || 0,
      vatAmount:     Number(vatAmount)     || 0,
      status:        'Active',
    };

    const result = await Product.findOneAndUpdate(
      filter,
      { $set: updateFields, $setOnInsert: { createdBy: req.user._id } },
      { upsert: true, new: false }
    );

    if (result) summary.updated++;
    else summary.created++;
  }

  res.json({ success: true, summary });
};

// POST /api/products/bulk-upsert-mm
exports.bulkUpsertMM   = (req, res) => bulkUpsert(req, res, 'MM');

// POST /api/products/bulk-upsert-adpl
exports.bulkUpsertADPL = (req, res) => bulkUpsert(req, res, 'ADPL');
