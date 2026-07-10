const mongoose = require('mongoose');

const PROVINCES = [
  'Koshi Province',
  'Madhesh Province',
  'Bagmati Province',
  'Gandaki Province',
  'Lumbini Province',
  'Karnali Province',
  'Sudurpashchim Province',
];

const salespersonSchema = new mongoose.Schema({
  employeeId:  { type: String, required: true, unique: true },
  fullName:    { type: String, required: true },
  phone:       { type: String, required: true },
  email:       { type: String, lowercase: true },
  province:    { type: String, enum: [...PROVINCES, ''], default: '' },
  area:        { type: String, required: true },
  designation: { type: String, required: true },
  status:      { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports.PROVINCES = PROVINCES;

module.exports = mongoose.model('Salesperson', salespersonSchema);
