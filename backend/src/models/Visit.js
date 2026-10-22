const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  date:        { type: Date, default: Date.now },
  dealer:      { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  se:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  so:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  asm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rsm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nsm:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  checkInTime:  Date,
  checkOutTime: Date,
  checkInLat:   Number,
  checkInLng:   Number,
  checkInAccuracyMeters: Number,
  deviceCapturedAt: Date,
  checkInEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  checkOutEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  checkOutLat:  Number,
  checkOutLng:  Number,
  checkOutAccuracyMeters: Number,
  checkOutDistanceMeters: Number,
  checkOutLocationVerificationStatus: {
    type: String,
    enum: ['not_verified', 'within_geofence', 'outside_geofence'],
    default: 'not_verified',
  },
  checkOutDurationSeconds: Number,
  checkOutAttempts: [{
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    latitude: Number,
    longitude: Number,
    accuracyMeters: Number,
    distanceMeters: Number,
    attemptedAt: { type: Date, required: true },
    result: {
      type: String,
      enum: ['accepted', 'invalid_coordinates', 'invalid_accuracy', 'inaccurate', 'outside_geofence', 'dealer_location_unapproved', 'gps_unavailable'],
      required: true,
    },
    reason: String,
  }],
  checkOutReviewStatus: {
    type: String,
    enum: ['not_required', 'pending', 'resolved'],
    default: 'not_required',
  },
  checkOutReviewReason: String,
  checkOutReviewResolvedAt: Date,
  checkOutReviewResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  checkOutReviewHistory: [{
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedAt: { type: Date, required: true },
    outcome: { type: String, enum: ['suspicious', 'invalid'], required: true },
    notes: { type: String, default: '' },
    reason: { type: String, required: true },
  }],
  checkOutSecurityEvents: [{
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attemptedAt: { type: Date, required: true },
    reason: { type: String, required: true },
  }],
  verificationStatus: {
    type: String,
    enum: ['in_progress', 'verified', 'suspicious', 'invalid'],
    default: 'in_progress',
  },
  verificationReason: String,
  verificationHistory: [{
    status: { type: String, enum: ['in_progress', 'verified', 'suspicious', 'invalid'], required: true },
    reason: String,
    recordedAt: { type: Date, required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  }],
  dailyVisit:   { type: mongoose.Schema.Types.ObjectId, ref: 'DailyVisit', default: null },
  locationVerificationStatus: {
    type: String,
    enum: ['not_verified', 'within_geofence', 'outside_geofence'],
    default: 'not_verified',
  },
  locationDistanceMeters: Number,
  locationVerificationMessage: String,
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
visitSchema.index(
  { checkInEmployee: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'checked-in',
      checkInEmployee: { $type: 'objectId' },
    },
  },
);

module.exports = mongoose.model('Visit', visitSchema);
