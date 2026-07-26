const mongoose = require('mongoose');

const dailyVisitSchema = new mongoose.Schema({
  date:        { type: String, required: true },          // 'YYYY-MM-DD'
  staff:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dealer:      { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  visitStatus: { type: String, enum: ['assigned', 'visited', 'skipped'], default: 'assigned' },
  notes:       { type: String, default: '' },
  assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// one dealer per staff per day
dailyVisitSchema.index({ date: 1, staff: 1, dealer: 1 }, { unique: true });

module.exports = mongoose.model('DailyVisit', dailyVisitSchema);
