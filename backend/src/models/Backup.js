const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  filename: { type: String, required: true, unique: true },
  size: { type: Number, default: 0 },
  status: { type: String, enum: ['SUCCESS', 'FAILED', 'IN_PROGRESS'], required: true },
  type: { type: String, enum: ['automatic', 'manual'], required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  error: { type: String, default: null },
}, { timestamps: true });

backupSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Backup', backupSchema);
