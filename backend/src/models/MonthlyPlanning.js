const mongoose = require('mongoose');

const monthlyPlanningSchema = new mongoose.Schema({
  month:        { type: Number, required: true }, // 1-12
  year:         { type: Number, required: true },
  target:       { type: Number, default: 5000000 },
  schemeBudget: { type: Number, default: 120000 },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  setBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes:        String,
}, { timestamps: true });

monthlyPlanningSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyPlanning', monthlyPlanningSchema);
