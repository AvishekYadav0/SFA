const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  actorType: { type: String, default: 'platform_admin', enum: ['platform_admin', 'company_admin', 'system', 'user'] },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  action: { type: String, required: true, trim: true },
  module: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  ipAddress: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('AuditLog', auditLogSchema);
