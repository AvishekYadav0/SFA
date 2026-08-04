const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const PROVINCES = [
  'Koshi Province',
  'Madhesh Province',
  'Bagmati Province',
  'Gandaki Province',
  'Lumbini Province',
  'Karnali Province',
  'Sudurpashchim Province',
];

// Role hierarchy (index = power level, higher = more access)
const ROLES = ['dealer', 'se', 'asm', 'rsm', 'nsm', 'admin'];

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, minlength: 8 },
  role:         { type: String, enum: ROLES, default: 'se' },
  phone:        { type: String, trim: true },
  companyName:  { type: String, trim: true },
  employeeId:   { type: String, trim: true },
  // RSM & above: province scoping
  province:     { type: String, enum: [...PROVINCES, null, ''], default: null },
  // ASM & SE: area scoping
  area:         { type: String, trim: true, default: null },
  district:     { type: String, trim: true },
  isActive:     { type: Boolean, default: true },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
module.exports.PROVINCES = PROVINCES;
module.exports.ROLES = ROLES;
