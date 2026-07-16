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

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, minlength: 8 },
  role:         { type: String, enum: ['admin', 'staff'], default: 'staff' },
  phone:        { type: String, trim: true },
  companyName:  { type: String, trim: true },
  employeeId:   { type: String, trim: true },
  province:     { type: String, enum: [...PROVINCES, null, ''], default: null },
  district:     { type: String, trim: true },
  assignedArea: { type: String, trim: true },
  designation:  { type: String, enum: ['Marketing Staff', 'Sales Executive', 'Supervisor'], default: 'Marketing Staff' },
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
