const mongoose = require('mongoose');

const dealerSchema = new mongoose.Schema({
  dealerName:     { type: String, required: true },
  ownerName:      { type: String, required: true },
  phone:          { type: String, required: true },
  address:        String,
  area:           { type: String, required: true },
  province:       { type: String, default: '' },
  district:       String,
  vatNumber:      String,
  panNumber:      String,
  openingBalance: { type: Number, default: 0 },
  creditLimit:    { type: Number, default: 0 },
  status:         { type: String, enum: ['active', 'inactive'], default: 'active' },
  soleDealerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'SoleDealer', default: null },
  // SE assigned to manage this dealer
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // User account linked to this dealer (for dealer login portal)
  linkedUser:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Dealer', dealerSchema);
