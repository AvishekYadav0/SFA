const mongoose = require('mongoose');

const dailyVisitSchema = new mongoose.Schema({
  date:        { type: String, required: true },          // 'YYYY-MM-DD'
  staff:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dealer:      { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  sequence:    { type: Number, required: true, min: 1 },
  status:      {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'verified', 'suspicious', 'invalid', 'missed'],
    default: 'pending',
  },
  workflowStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'missed'],
    default: 'pending',
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'verified', 'suspicious', 'invalid'],
    default: 'pending',
  },
  visitStatus: { type: String, enum: ['assigned', 'visited', 'skipped'], default: 'assigned' },
  visit:       { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', default: null },
  startedAt:   Date,
  completedAt: Date,
  requiresReview: { type: Boolean, default: false },
  statusHistory: [{
    from: String,
    to: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt: { type: Date, required: true },
    reason: String,
  }],
  verificationHistory: [{
    status: { type: String, enum: ['pending', 'in_progress', 'verified', 'suspicious', 'invalid'], required: true },
    reason: String,
    recordedAt: { type: Date, required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  }],
  reviewResolvedAt: Date,
  reviewResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewResolution: { type: String, enum: ['suspicious', 'invalid'] },
  reviewResolutionNote: String,
  reviewHistory: [{
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedAt: { type: Date, required: true },
    outcome: { type: String, enum: ['suspicious', 'invalid'], required: true },
    notes: { type: String, required: true },
    overrideReason: { type: String, required: true },
  }],
  checkInAttempts: [{
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attemptedAt: { type: Date, required: true },
    latitude: Number,
    longitude: Number,
    accuracyMeters: Number,
    distanceMeters: Number,
    result: { type: String, required: true },
    reason: { type: String, required: true },
  }],
  statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes:       { type: String, default: '' },
  assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// One dealer per employee per day; sequence defines the route order.
dailyVisitSchema.index({ date: 1, staff: 1, dealer: 1 }, { unique: true });
dailyVisitSchema.index(
  { date: 1, staff: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'in_progress' },
  },
);

module.exports = mongoose.model('DailyVisit', dailyVisitSchema);
