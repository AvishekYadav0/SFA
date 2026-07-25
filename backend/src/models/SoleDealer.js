const mongoose = require('mongoose');

const soleDealerSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  region:      { type: String },
  province:    { type: String },
  phone:       { type: String },
  email:       { type: String },
  address:     { type: String },
  status:      { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('SoleDealer', soleDealerSchema);
