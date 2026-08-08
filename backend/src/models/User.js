const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  email:       { type: String, required: true, unique: true, lowercase: true },
  password:    { type: String, required: true, select: false },
  role:        { type: String, enum: ['nsm', 'rsm', 'asm', 'se', 'so', 'dealer', 'admin'], required: true },
  employeeId:  { type: String, unique: true, sparse: true },
  phone:       String,
  photo:       String,
  province:    String,
  district:    String,
  region:      String,
  area:        String,

  // Dealer portal link (only for role === 'dealer')
  linkedDealer: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },

  // Hierarchy references
  reportsTo:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // parent in hierarchy
  nsm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rsm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  asm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  target:      { type: Number, default: 0 },
  status:      { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastLogin:   Date,
  deviceToken: String, // for push notifications
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
