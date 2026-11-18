const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const platformAdminSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  accountType: { type: String, default: 'platform_admin', enum: ['platform_admin'] },
  permissions: { type: [String], default: ['dashboard','companies','plans','subscriptions','payments','audit_logs'] },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },
}, { timestamps: true });

platformAdminSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();
  if (this.passwordHash.startsWith('$2a$') || this.passwordHash.startsWith('$2b$')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  next();
});

platformAdminSchema.methods.matchPassword = function matchPassword(inputPassword) {
  return bcrypt.compare(inputPassword, this.passwordHash);
};

module.exports = mongoose.model('PlatformAdmin', platformAdminSchema);
