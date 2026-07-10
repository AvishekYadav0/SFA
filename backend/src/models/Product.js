const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  brand: { type: String, required: true },
  category: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  unit: { type: String, required: true },
  rate: { type: Number, required: true },
  excisePercent: { type: Number, default: 0 },
  vatPercent: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
