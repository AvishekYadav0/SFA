const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  date:        { type: Date, default: Date.now },
  dealer:      { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  se:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  so:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  asm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rsm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  checkInTime:  Date,
  checkOutTime: Date,
  checkInLat:   Number,
  checkInLng:   Number,
  checkOutLat:  Number,
  checkOutLng:  Number,
  photo:        String,
  remarks:      String,
  complaint:    String,
  marketSurvey: String,
  competitorInfo: String,

  province:    String,
  district:    String,
  area:        String,

  status:      { type: String, enum: ['checked-in', 'checked-out'], default: 'checked-in' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

visitSchema.index({ se: 1, date: -1 });
visitSchema.index({ dealer: 1 });

module.exports = mongoose.model('Visit', visitSchema);
