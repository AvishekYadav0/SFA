const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  tenantId:    { type: String, required: true, unique: true },
  databaseName: { type: String, unique: true, sparse: true, match: /^sfa_[a-z0-9_]{1,55}$/ },
  plan:        { type: String, enum: ['trial', 'basic', 'pro'], default: 'trial' },
  status:      { type: String, enum: ['active', 'suspended', 'pending'], default: 'active' },
  adminCount:  { type: Number, min: 0 },
  // The admin user who owns this company
  adminUser:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // For existing legacy company onboarding
  isLegacy:    { type: Boolean, default: false },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true, tenantScoped: false });

module.exports = mongoose.model('Company', companySchema);
