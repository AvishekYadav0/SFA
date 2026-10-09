const mongoose = require('mongoose');

const backupLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  adminEmail: { type: String, default: null },
  action: { type: String, required: true },
  filename: { type: String, default: null },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
  ipAddress: { type: String, default: null },
  error: { type: String, default: null },
}, { timestamps: true });

backupLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BackupLog', backupLogSchema);
