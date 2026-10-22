const mongoose = require('mongoose');

const dealerSchema = new mongoose.Schema({
  dealerName:      { type: String, required: true },
  dealerCode:      { type: String, unique: true, sparse: true },
  distributor:     String,
  ownerName:       String,
  phone:           String,
  email:           String,
  address:         String,
  panNumber:       String,
  nidNumber:       String,
  vatNumber:       String,
  province:        String,
  district:        String,
  area:            String,
  region:          String,
  latitude:        Number,
  longitude:       Number,
  geofenceRadius:  { type: Number, default: 75, min: 1 },
  locationVerificationStatus: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected'],
    default: 'pending_approval',
  },
  locationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  locationReviewedAt: Date,
  locationRejectionReason: String,
  locationAudit: [{
    action: { type: String, enum: ['submitted', 'changed', 'approved', 'rejected'], required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending_approval', 'approved', 'rejected'] },
    previousLocation: {
      latitude: Number,
      longitude: Number,
      geofenceRadius: Number,
    },
    newLocation: {
      latitude: Number,
      longitude: Number,
      geofenceRadius: Number,
    },
    reason: String,
  }],

  // Hierarchy
  se:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  so:              [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  asm:             { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rsm:             { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nsm:             { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedRole:    { type: String, enum: ['so', 'se', 'asm', 'rsm', 'nsm'], default: null },

  creditLimit:     { type: Number, default: 0, min: 0 },
  openingBalance:  { type: Number, default: 0, min: 0 },
  originalOpeningOutstanding: { type: Number, default: 0, min: 0 },
  remainingOpeningOutstanding: { type: Number, default: 0, min: 0 },
  creditNotes:     { type: Number, default: 0, min: 0 },
  outstandingAmount: { type: Number, default: 0 },
  dueAmount:       { type: Number, default: 0 },
  overdueAmount:   { type: Number, default: 0 },
  paymentType:     { type: String, enum: ['cash', 'credit'], default: 'cash' },
  creditDays:      { type: Number, default: 0, min: 0 },
  openingBalanceDate: Date,
  creditStatus:    { type: String, enum: ['allowed', 'blocked'], default: 'allowed' },

  status:          { type: String, enum: ['active', 'inactive'], default: 'active' },
  performanceScore: { type: Number, default: 0 },
  growthPercent:   { type: Number, default: 0 },

  lastOrderDate:   Date,
  lastVisitDate:   Date,
  totalOrders:     { type: Number, default: 0 },
  monthlyPurchase: { type: Number, default: 0 },
  yearlyPurchase:  { type: Number, default: 0 },

  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  linkedUser:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

dealerSchema.virtual('availableCredit').get(function () {
  return this.creditLimit - this.outstandingAmount;
});

module.exports = mongoose.model('Dealer', dealerSchema);
