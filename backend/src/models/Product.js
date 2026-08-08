const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productName:  { type: String, required: true },
  ml:           { type: String, default: '' },
  up:           { type: String, default: '' },
  amount:        { type: Number, required: true, default: 0 },
  customerType:  { type: String, enum: ['MM', 'ADPL'] },
  customerPrice: { type: Number, default: 0 },
  exciseAmount:  { type: Number, default: 0 },
  vatAmount:     { type: Number, default: 0 },
  status:        { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
