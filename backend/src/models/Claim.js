const mongoose = require('mongoose');
require('./Counter'); // ensure Counter model is registered before pre-save hook uses it

const CLAIM_TYPES = [
  'Primary Scheme', 'Secondary Scheme', 'SLSB', 'RD', 'Transportation',
  'Sampling', 'Leakage', 'Breakage', 'Display', 'Others'
];

const APPROVAL_STATUSES = [
  'Draft', 'Pending ASM Approval', 'Pending RSM Approval', 'Pending NSM Approval',
  'Pending Accounts Approval', 'Approved', 'Paid', 'Rejected'
];

const approvalHistorySchema = new mongoose.Schema({
  approver:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action:      { type: String, enum: ['Submitted', 'Approved', 'Rejected', 'Paid'], required: true },
  statusAtTime: { type: String, required: true },
  remarks:     String,
}, { timestamps: true });

const claimSchema = new mongoose.Schema({
  claimId:      { type: String, unique: true },
  claimType:    { type: String, enum: CLAIM_TYPES, required: true },
  submittedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dealer:       { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  details:      { type: String, required: true },
  attachments: {
    vatBill:       String,
    invoice:       String,
    transportBill: String,
    photos:        [String],
  },
  // Raw inputs used for calculation — stored so approvers can verify
  calcInputs:       { type: mongoose.Schema.Types.Mixed, default: {} },
  calculatedAmount: { type: Number, required: true, default: 0 },
  status:           { type: String, enum: APPROVAL_STATUSES, default: 'Draft' },
  rejectionReason:  String,
  approvalHistory:  [approvalHistorySchema],
  // Hierarchy for approval routing
  asmApprover:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rsmApprover:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nsmApprover:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Final approver
  accountApprover:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt:           Date,
  paidBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

claimSchema.pre('save', async function(next) {
  if (!this.isNew) return next();
  try {
    const Counter = mongoose.model('Counter');
    const seq = await Counter.getNext('claim');
    this.claimId = `CLM-${String(seq).padStart(6, '0')}`;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Claim', claimSchema);
module.exports.CLAIM_TYPES = CLAIM_TYPES;
module.exports.APPROVAL_STATUSES = APPROVAL_STATUSES;