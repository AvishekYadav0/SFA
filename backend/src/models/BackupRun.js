const mongoose = require('mongoose');

const backupRunSchema = new mongoose.Schema({
  executionKey: { type: String, required: true, unique: true },
  status: { type: String, enum: ['SUCCESS', 'FAILED', 'IN_PROGRESS'], required: true },
  backup: { type: mongoose.Schema.Types.ObjectId, ref: 'Backup', default: null },
  error: { type: String, default: null },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('BackupRun', backupRunSchema);
