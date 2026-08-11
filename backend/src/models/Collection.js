const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  collectionNumber: { type: String, unique: true },
  date:        { type: Date, default: Date.now },
  collectionDate: { type: Date },

  dealer:      { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  se:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  so:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  asm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rsm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nsm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  amount:      { type: Number, required: true, min: 0.01 },
  paymentType: { type: String, enum: ['cash', 'cheque', 'bank', 'online'], default: 'cash' },
  allocations: [{
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    invoiceNumber: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
  }],
  reference: String,
  chequeNumber: String,
  bankName: String,
  transactionId: String,
  referenceNo: String,
  remarks:     String,

  province:    String,
  district:    String,
  area:        String,
  region:      String,

  status:      { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  verifiedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt:  Date,

  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

collectionSchema.index({ se: 1, date: -1 });
collectionSchema.index({ dealer: 1 });
collectionSchema.index({ 'allocations.sale': 1, date: -1 });

collectionSchema.pre('save', async function (next) {
  if (!this.collectionNumber) {
    const count = await mongoose.model('Collection').countDocuments();
    this.collectionNumber = `COL-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Collection', collectionSchema);
