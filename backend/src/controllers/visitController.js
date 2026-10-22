const mongoose = require('mongoose');
const Visit  = require('../models/Visit');
const Dealer = require('../models/Dealer');
const DailyVisit = require('../models/DailyVisit');
const { scopeFilter, hierarchyFields } = require('../middleware/auth');
const activeVisitFilter = require('../utils/activeVisitFilter');
const { isDailyVisitFinalized } = require('../utils/dailyVisitWorkflow');
const User = require('../models/User');
const Notification = require('../models/Notification');
const {
  distanceInMeters,
  getDealerGeofenceRadius,
  isValidCoordinatePair,
  validateGpsFix,
} = require('../utils/visitGps');
const configuredMinimumDurationValue = process.env.VISIT_MIN_DURATION_MINUTES;
const configuredMinimumDuration = Number(configuredMinimumDurationValue);
const MIN_VISIT_DURATION_MINUTES = configuredMinimumDurationValue?.trim() !== ''
  && Number.isFinite(configuredMinimumDuration) && configuredMinimumDuration >= 0
  ? configuredMinimumDuration
  : 10;
const CHECKOUT_FAILURE_REASONS = new Set(['permission_denied', 'position_unavailable', 'timeout', 'unsupported']);
const MAX_LOCATION_CHANGE_METERS = Math.max(1, Number(process.env.VISIT_MAX_LOCATION_CHANGE_METERS) || 75);

function getLocationVerification(dealer, latitude, longitude) {
  const hasApprovedDealerLocation = dealer?.locationVerificationStatus === 'approved'
    && Number.isFinite(dealer.latitude)
    && Number.isFinite(dealer.longitude);
  if (!hasApprovedDealerLocation) {
    return {
      locationVerificationStatus: 'not_verified',
      locationDistanceMeters: null,
      locationVerificationMessage: 'Dealer location is not approved; GPS geofence verification was not performed.',
    };
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      locationVerificationStatus: 'not_verified',
      locationDistanceMeters: null,
      locationVerificationMessage: 'GPS coordinates were not provided; geofence verification was not performed.',
    };
  }

  const distance = distanceInMeters(latitude, longitude, dealer.latitude, dealer.longitude);
  const radius = getDealerGeofenceRadius(dealer);
  const withinGeofence = distance <= radius;
  return {
    locationVerificationStatus: withinGeofence ? 'within_geofence' : 'outside_geofence',
    locationDistanceMeters: distance,
    locationVerificationMessage: withinGeofence
      ? `GPS is within the approved ${radius} metre dealer geofence.`
      : `GPS is ${Math.round(distance)} metres away, outside the approved ${radius} metre geofence.`,
  };
}

async function notifyVisitReview(visit, message) {
  const recipients = await User.find({
    status: 'active',
    $or: [
      { role: 'admin' },
      ...(visit.asm ? [{ role: 'asm', _id: visit.asm }] : []),
    ],
  }).select('_id');
  if (!recipients.length) return;
  try {
    await Notification.insertMany(recipients.map(recipient => ({
      user: recipient._id,
      title: 'Dealer visit requires review',
      message,
      type: 'general',
      link: '/daily-visits',
    })), { ordered: false });
  } catch (error) {
    console.error(`Failed to notify reviewers for visit ${visit._id}:`, error.message);
  }
}

async function recordCheckInFailure(assignment, actor, reason, result, gps = {}) {
  const attemptedAt = new Date();
  const verificationStatus = result === 'inaccurate' ? 'suspicious' : 'invalid';
  const updated = await DailyVisit.findOneAndUpdate(
    { _id: assignment._id, staff: actor._id, status: 'in_progress', visit: null },
    {
      $push: {
        checkInAttempts: {
          actor: actor._id,
          attemptedAt,
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracyMeters: gps.accuracyMeters,
          distanceMeters: gps.distanceMeters,
          result,
          reason,
        },
        verificationHistory: {
          status: verificationStatus,
          reason,
          recordedAt: attemptedAt,
          recordedBy: actor._id,
        },
      },
      $set: { requiresReview: true, verificationStatus, verificationReason: reason },
    },
  );
  if (!updated) {
    throw new Error('The daily visit changed before the GPS failure could be recorded. Reload the plan.');
  }
  const actorRecord = await User.findById(actor._id).select('asm role');
  const reviewerAsm = actorRecord?.role === 'asm' ? actor._id : actorRecord?.asm;
  await notifyVisitReview({ _id: assignment._id, asm: reviewerAsm }, reason);
}

async function updateDailyVisitAfterCheckout(data, status, requiresReview, actorId) {
  if (!data.dailyVisit) return true;
  const finalizedAt = data.checkOutTime || new Date();
  const updated = await DailyVisit.findOneAndUpdate(
    { _id: data.dailyVisit, visit: data._id, status: 'in_progress' },
    {
      $set: {
        status,
        workflowStatus: 'completed',
        verificationStatus: status,
        visitStatus: 'visited',
        requiresReview,
        completedAt: finalizedAt,
        statusUpdatedBy: actorId,
      },
      $push: {
        statusHistory: {
          from: 'in_progress',
          to: status,
          changedBy: actorId,
          changedAt: finalizedAt,
          reason: data.verificationReason,
        },
      },
    },
    { new: true },
  );
  return Boolean(updated);
}

async function finalizeResolvedDailyVisit(data) {
  if (!data.dailyVisit || data.checkOutReviewStatus !== 'resolved') return true;
  const resolution = data.checkOutReviewHistory?.[data.checkOutReviewHistory.length - 1];
  if (!resolution) return false;
  const existingPlan = await DailyVisit.findOne({
    _id: data.dailyVisit,
    visit: data._id,
    requiresReview: true,
  }).select('status');
  if (!existingPlan) {
    const alreadyFinalized = await DailyVisit.findOne({ _id: data.dailyVisit, visit: data._id })
      .select('requiresReview status reviewResolvedAt');
    return Boolean(alreadyFinalized && alreadyFinalized.requiresReview !== true
      && alreadyFinalized.status === resolution.outcome && alreadyFinalized.reviewResolvedAt);
  }
  const updated = await DailyVisit.findOneAndUpdate(
    {
      _id: data.dailyVisit,
      visit: data._id,
      requiresReview: true,
      status: existingPlan.status,
    },
    {
      $set: {
        status: resolution.outcome,
        workflowStatus: 'completed',
        verificationStatus: resolution.outcome,
        requiresReview: false,
        completedAt: data.checkOutTime,
        reviewResolvedAt: data.checkOutReviewResolvedAt,
        reviewResolvedBy: data.checkOutReviewResolvedBy,
        reviewResolution: resolution.outcome,
        reviewResolutionNote: resolution.reason,
        statusUpdatedBy: data.checkOutReviewResolvedBy,
      },
      $push: {
        statusHistory: {
          from: existingPlan.status || 'completed',
          to: resolution.outcome,
          changedBy: data.checkOutReviewResolvedBy,
          changedAt: data.checkOutReviewResolvedAt,
          reason: resolution.reason,
        },
      },
    },
    { new: true },
  );
  if (updated) return true;
  const existing = await DailyVisit.findOne({ _id: data.dailyVisit, visit: data._id })
    .select('requiresReview status reviewResolvedAt');
  return Boolean(existing && existing.requiresReview !== true
    && existing.status === resolution.outcome && existing.reviewResolvedAt);
}

exports.getAll = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const filter = { ...scopeFilter(req) };
    if (req.query.dealer) filter.dealer = req.query.dealer;
    if (req.query.se)     filter.se     = req.query.se;
    if (req.query.so)     filter.so     = req.query.so;
    if (req.query.startDate && req.query.endDate)
      filter.date = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };

    const total = await Visit.countDocuments(filter);
    const data  = await Visit.find(filter)
      .populate('dealer', 'dealerName area province')
      .populate('se', 'name employeeId')
      .populate('so', 'name employeeId')
      .sort('-createdAt').skip((page - 1) * limit).limit(limit);

    res.json({ success: true, data, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const data = await Visit.findOne({ _id: req.params.id, ...scopeFilter(req) })
      .populate('dealer', 'dealerName area province')
      .populate('se so asm', 'name employeeId phone');
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getStats = async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [todayCount, monthCount, total] = await Promise.all([
      Visit.countDocuments({ ...scope, date: { $gte: today } }),
      Visit.countDocuments({ ...scope, date: { $gte: monthStart } }),
      Visit.countDocuments(scope),
    ]);
    res.json({ success: true, data: { todayCount, monthCount, total } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getActive = async (req, res) => {
  try {
    const data = await Visit.findOne(activeVisitFilter(req.user))
      .select('_id dealer dailyVisit checkInTime checkInAccuracyMeters locationDistanceMeters status checkOutReviewStatus checkOutReviewReason')
      .populate('dealer', 'dealerName province district area')
      .populate('dailyVisit', 'date sequence dealer');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const User   = require('../models/User');
    const dealer = await Dealer.findById(req.body.dealer);
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });

    const dailyVisitId = req.body.dailyVisitId;
    if (!dailyVisitId || !mongoose.isValidObjectId(dailyVisitId)) {
      return res.status(400).json({ success: false, message: 'Check-in is only available for a dealer assigned in your daily visit plan.' });
    }
    let dailyAssignment = await DailyVisit.findOne({
      _id: dailyVisitId,
      staff: req.user._id,
      dealer: dealer._id,
      date: new Date().toISOString().slice(0, 10),
      status: 'in_progress',
      visit: null,
    });
    if (!dailyAssignment) {
      return res.status(409).json({
        success: false,
        message: 'Start your current assigned dealer visit before checking in.',
      });
    }
    const plannedStops = await DailyVisit.find({
      date: dailyAssignment.date,
      staff: req.user._id,
    }).sort({ sequence: 1, createdAt: 1 });
    const plannedSequences = plannedStops.map(stop => Number(stop.sequence));
    if (plannedSequences.some(sequence => !sequence) || new Set(plannedSequences).size !== plannedStops.length) {
      plannedStops.sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));
      await Promise.all(plannedStops.map((stop, index) => {
        stop.sequence = index + 1;
        return DailyVisit.updateOne({ _id: stop._id }, { $set: { sequence: stop.sequence } });
      }));
      dailyAssignment = plannedStops.find(stop => stop._id.toString() === dailyAssignment._id.toString());
    }
    const unresolvedEarlierStop = plannedStops.find(stop =>
      stop._id.toString() !== dailyAssignment._id.toString()
      && Number(stop.sequence) < Number(dailyAssignment.sequence)
      && !isDailyVisitFinalized(stop)
    );
    if (unresolvedEarlierStop) {
      return res.status(409).json({ success: false, message: 'Complete the earlier assigned dealer visit before checking in here.' });
    }
    const anotherStartedStop = plannedStops.find(stop =>
      stop._id.toString() !== dailyAssignment._id.toString()
      && stop.status === 'in_progress'
    );
    if (anotherStartedStop) {
      return res.status(409).json({ success: false, message: 'Complete the current dealer visit before checking in to another.' });
    }

    const roleAssignment = {
      so: (dealer.so || []).some(id => String(id) === String(req.user._id)),
      se: String(dealer.se || '') === String(req.user._id),
      asm: String(dealer.asm || '') === String(req.user._id),
      rsm: String(dealer.rsm || '') === String(req.user._id),
      nsm: String(dealer.nsm || '') === String(req.user._id),
    };
    if (!roleAssignment[req.user.role]) {
      const message = 'The authenticated employee is not assigned to this dealer.';
      await recordCheckInFailure(dailyAssignment, req.user, message, 'unauthorized_assignment');
      return res.status(403).json({ success: false, message });
    }

    const activeVisit = await Visit.findOne(activeVisitFilter(req.user)).select('_id');
    if (activeVisit) {
      const message = 'A second simultaneous active check-in was blocked.';
      await recordCheckInFailure(dailyAssignment, req.user, message, 'simultaneous_check_in');
      return res.status(409).json({ success: false, message: 'You already have an active visit. Check out before starting another check-in.' });
    }

    if (dealer.locationVerificationStatus !== 'approved'
      || !Number.isFinite(dealer.latitude)
      || !Number.isFinite(dealer.longitude)
      || !isValidCoordinatePair(dealer.latitude, dealer.longitude)) {
      const message = 'Dealer GPS coordinates are missing or not approved.';
      await recordCheckInFailure(dailyAssignment, req.user, message, 'dealer_location_unapproved');
      return res.status(409).json({ success: false, message: 'This dealer does not have approved GPS coordinates. Ask an Admin to approve its location.' });
    }
    if (dealer.status !== 'active') {
      await recordCheckInFailure(dailyAssignment, req.user, 'Inactive dealer check-in was blocked.', 'inactive_dealer');
      return res.status(409).json({ success: false, message: 'This dealer is inactive and cannot be checked in.' });
    }

    if (typeof req.body.checkInLat !== 'number'
      || typeof req.body.checkInLng !== 'number'
      || typeof req.body.checkInAccuracyMeters !== 'number'
      || typeof req.body.deviceCapturedAt !== 'string') {
      const message = 'Check-in requires numeric GPS coordinates, accuracy, and device capture time.';
      await recordCheckInFailure(dailyAssignment, req.user, message, 'missing_gps_data', {
        latitude: req.body.checkInLat,
        longitude: req.body.checkInLng,
        accuracyMeters: req.body.checkInAccuracyMeters,
      });
      return res.status(400).json({ success: false, message });
    }
    const checkInLatitude = req.body.checkInLat;
    const checkInLongitude = req.body.checkInLng;
    const checkInAccuracyMeters = req.body.checkInAccuracyMeters;
    const deviceCapturedAt = new Date(req.body.deviceCapturedAt);
    if (!req.body.deviceCapturedAt || Number.isNaN(deviceCapturedAt.getTime())) {
      const message = 'A valid device GPS capture time is required.';
      await recordCheckInFailure(dailyAssignment, req.user, message, 'invalid_capture_time', { latitude: checkInLatitude, longitude: checkInLongitude, accuracyMeters: checkInAccuracyMeters });
      return res.status(400).json({ success: false, message });
    }

    const gpsFix = validateGpsFix(dealer, checkInLatitude, checkInLongitude, checkInAccuracyMeters);
    if (gpsFix.result !== 'accepted') {
      await recordCheckInFailure(dailyAssignment, req.user, gpsFix.reason, gpsFix.result, {
        latitude: checkInLatitude,
        longitude: checkInLongitude,
        accuracyMeters: checkInAccuracyMeters,
        distanceMeters: gpsFix.distanceMeters,
      });
      const statusCode = gpsFix.result === 'inaccurate' ? 422
        : gpsFix.result === 'outside_geofence' ? 403 : 400;
      return res.status(statusCode).json({
        success: false,
        distanceMeters: Number.isFinite(gpsFix.distanceMeters) ? Math.round(gpsFix.distanceMeters) : undefined,
        message: gpsFix.result === 'outside_geofence'
          ? `Check-in denied: you are ${Math.round(gpsFix.distanceMeters)} m from the approved dealer location. You must be within ${getDealerGeofenceRadius(dealer)} m.`
          : gpsFix.reason,
      });
    }

    const distanceMeters = gpsFix.distanceMeters;
    const locationVerification = getLocationVerification(dealer, checkInLatitude, checkInLongitude);

    const creator = await User.findById(req.user._id).lean();
    if (!creator || creator.status !== 'active' || !['se', 'so', 'asm', 'rsm', 'nsm'].includes(creator.role)) {
      return res.status(403).json({ success: false, message: 'Only active field employees can check in.' });
    }
    const hierarchy = await hierarchyFields(creator);

    // Visits always require a staff owner. Keep SO visits linked to their SE,
    // while allowing managers/admins to record a visit for the selected staff.
    if (!hierarchy.se) {
      hierarchy.se = creator.role === 'so' ? creator.reportsTo : creator._id;
    }

    // Preserve the selected manager's scope when hierarchyFields has no
    // manager-specific branch.
    if (creator.role === 'nsm') hierarchy.nsm = creator._id;
    if (creator.role === 'rsm') {
      hierarchy.rsm = creator._id;
      hierarchy.nsm = creator.nsm || null;
    }
    if (creator.role === 'asm') {
      hierarchy.asm = creator._id;
      hierarchy.rsm = creator.rsm || null;
      hierarchy.nsm = creator.nsm || null;
    }

    const bodyRest = {
      remarks: req.body.remarks,
      complaint: req.body.complaint,
      marketSurvey: req.body.marketSurvey,
      competitorInfo: req.body.competitorInfo,
    };

    const data = await Visit.create({
      ...bodyRest,
      ...hierarchy,
      checkInLat: checkInLatitude,
      checkInLng: checkInLongitude,
      checkInAccuracyMeters,
      deviceCapturedAt,
      checkInEmployee: req.user._id,
      dailyVisit: dailyAssignment._id,
      verificationStatus: 'in_progress',
      verificationHistory: [{
        status: 'in_progress',
        reason: 'Check-in passed server-side GPS accuracy and approved dealer geofence validation.',
        recordedAt: new Date(),
        recordedBy: req.user._id,
      }],
      ...locationVerification,
      checkInTime: new Date(),
      status: 'checked-in',
      province: dealer?.province,
      district: dealer?.district,
      area:     dealer?.area,
      createdBy: req.user._id,
    });

    const updatedAssignment = await DailyVisit.findOneAndUpdate(
      {
        _id: dailyAssignment._id,
        staff: req.user._id,
        status: 'in_progress',
        visit: null,
      },
      { $set: {
        visit: data._id,
        notes: req.body.remarks || '',
        verificationStatus: 'in_progress',
        workflowStatus: 'in_progress',
      } },
      { new: true },
    );
    if (!updatedAssignment) {
      await Visit.findByIdAndDelete(data._id);
      return res.status(409).json({
        success: false,
        message: 'This daily visit was already checked in or changed. Reload your plan.',
      });
    }

    await Dealer.findByIdAndUpdate(req.body.dealer, { lastVisitDate: data.checkInTime });
    res.status(201).json({
      success: true,
      message: 'GPS check-in accepted.',
      data: {
        checkInTime: data.checkInTime,
        checkInAccuracyMeters,
        locationDistanceMeters: Math.round(distanceMeters),
        ...locationVerification,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'You already have an active visit. Check out before starting another check-in.' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.recordCheckInGpsFailure = async (req, res) => {
  try {
    const reasons = {
      permission_denied: 'The employee denied browser location permission.',
      position_unavailable: 'The browser could not determine the employee location.',
      timeout: 'The browser GPS request timed out.',
      unsupported: 'The browser does not provide GPS access in a secure context.',
    };
    const reason = reasons[req.body?.reason];
    if (!reason) return res.status(400).json({ success: false, message: 'Provide a supported GPS failure reason.' });
    const assignment = await DailyVisit.findOne({
      _id: req.params.id,
      staff: req.user._id,
      status: 'in_progress',
      visit: null,
    });
    if (!assignment) {
      return res.status(409).json({ success: false, message: 'This employee has no active, unchecked-in daily stop to record a GPS failure against.' });
    }
    await recordCheckInFailure(assignment, req.user, reason, req.body.reason);
    res.status(422).json({
      success: false,
      reviewRequired: true,
      message: `${reason} The failed GPS attempt was recorded and the next assigned dealer remains locked pending review.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const visit = await Visit.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found.' });
    const isRecordedCheckInOwner = String(visit.checkInEmployee || '') === String(req.user._id);
    const isLegacyOwner = !visit.checkInEmployee
      && await Visit.exists({ _id: visit._id, ...activeVisitFilter.legacy(req.user) });
    if (!isRecordedCheckInOwner && !isLegacyOwner) {
      return res.status(403).json({ success: false, message: 'Only the employee who checked in can check out this visit. Ask an Admin/ASM to resolve an incorrectly assigned legacy visit.' });
    }
    const checkOutOwnerFilter = isRecordedCheckInOwner
      ? { checkInEmployee: req.user._id }
      : activeVisitFilter.legacy(req.user);
    if (visit.status !== 'checked-in') {
      return res.status(409).json({ success: false, message: 'This visit has already been checked out.' });
    }
    if (visit.checkOutReviewStatus === 'pending') {
      return res.status(409).json({ success: false, message: 'This check-out is awaiting an authorized Admin/ASM review.' });
    }

    const attemptedAt = new Date();
    const latitude = typeof req.body?.lat === 'number' ? req.body.lat : null;
    const longitude = typeof req.body?.lng === 'number' ? req.body.lng : null;
    const accuracyMeters = typeof req.body?.accuracyMeters === 'number' ? req.body.accuracyMeters : null;
    let distanceMeters = null;
    let result = 'accepted';
    let reason = '';
    const dealer = await Dealer.findById(visit.dealer);

    if (req.body?.failureReason && CHECKOUT_FAILURE_REASONS.has(req.body.failureReason)) {
      result = 'gps_unavailable';
      reason = `GPS check-out could not be captured: ${req.body.failureReason.replaceAll('_', ' ')}.`;
    } else {
      const gpsFix = validateGpsFix(dealer, latitude, longitude, accuracyMeters);
      distanceMeters = gpsFix.distanceMeters;
      if (!visit.checkInTime || Number.isNaN(new Date(visit.checkInTime).getTime())) {
        result = 'invalid_coordinates';
        reason = 'This visit has no valid server check-in time and requires Admin review.';
      } else if (gpsFix.result !== 'accepted') {
        result = gpsFix.result;
        reason = gpsFix.reason;
      }
    }

    const attempt = {
      latitude,
      longitude,
      accuracyMeters,
      distanceMeters,
      attemptedAt,
      result,
      reason: reason || undefined,
      actor: req.user._id,
    };

    if (result !== 'accepted') {
      const verificationStatus = result === 'inaccurate' ? 'suspicious' : 'invalid';
      const heldVisit = await Visit.findOneAndUpdate(
        {
          _id: visit._id,
          status: 'checked-in',
          checkOutReviewStatus: { $ne: 'pending' },
          ...checkOutOwnerFilter,
        },
        {
          $set: {
            checkOutReviewStatus: 'pending',
            checkOutReviewReason: reason,
            verificationStatus,
            verificationReason: reason,
          },
          $push: {
            checkOutAttempts: attempt,
            verificationHistory: {
              status: verificationStatus,
              reason,
              recordedAt: attemptedAt,
              recordedBy: req.user._id,
            },
          },
        },
        { new: true },
      );
      if (!heldVisit) {
        return res.status(409).json({ success: false, message: 'This visit changed during check-out. Reload to see its current status.' });
      }
      if (heldVisit.dailyVisit) {
        await DailyVisit.findOneAndUpdate(
          { _id: heldVisit.dailyVisit, visit: heldVisit._id, status: 'in_progress' },
          { $set: { requiresReview: true, verificationStatus } },
        );
      }
      await notifyVisitReview(heldVisit, reason);
      return res.status(422).json({
        success: false,
        reviewRequired: true,
        data: { checkOutReviewStatus: 'pending', checkOutReviewReason: reason, attempt },
        message: `${reason} Evidence was saved and the next dealer remains locked pending authorized Admin/ASM review.`,
      });
    }

    const checkOutTime = attemptedAt;
    const checkOutDurationSeconds = Math.max(0, Math.floor((checkOutTime - new Date(visit.checkInTime)) / 1000));
    const minimumDurationSeconds = MIN_VISIT_DURATION_MINUTES * 60;
    const locationChangeMeters = isValidCoordinatePair(visit.checkInLat, visit.checkInLng)
      ? distanceInMeters(visit.checkInLat, visit.checkInLng, latitude, longitude)
      : null;
    const anomalies = [];
    if (checkOutDurationSeconds < minimumDurationSeconds) {
      anomalies.push(`Visit duration was ${Math.floor(checkOutDurationSeconds / 60)} minutes; minimum required is ${MIN_VISIT_DURATION_MINUTES} minutes.`);
    }
    if (locationChangeMeters !== null && locationChangeMeters > MAX_LOCATION_CHANGE_METERS) {
      anomalies.push(`Check-in and check-out locations differ by ${Math.round(locationChangeMeters)} metres, exceeding the ${MAX_LOCATION_CHANGE_METERS} metre anomaly threshold.`);
    }
    const requiresReview = anomalies.length > 0;
    const status = requiresReview ? 'suspicious' : 'verified';
    const reviewReason = anomalies.join(' ');
    const data = await Visit.findOneAndUpdate(
      {
        _id: visit._id,
        ...scopeFilter(req),
        status: 'checked-in',
        checkOutReviewStatus: { $ne: 'pending' },
        ...checkOutOwnerFilter,
      },
      {
        $set: {
          status: 'checked-out',
          checkOutEmployee: req.user._id,
          checkOutTime,
          checkOutLat: latitude,
          checkOutLng: longitude,
          checkOutAccuracyMeters: accuracyMeters,
          checkOutDistanceMeters: distanceMeters,
          checkOutLocationVerificationStatus: 'within_geofence',
          checkOutDurationSeconds,
          checkOutReviewStatus: requiresReview ? 'pending' : 'not_required',
          checkOutReviewReason: reviewReason || undefined,
          verificationStatus: status,
          verificationReason: reviewReason || 'Check-in and check-out GPS, accuracy, geofence, and minimum duration checks passed.',
        },
        $push: {
          checkOutAttempts: attempt,
          verificationHistory: {
            status,
            reason: reviewReason || 'All configured GPS and duration checks passed.',
            recordedAt: checkOutTime,
            recordedBy: req.user._id,
          },
        },
      },
      { new: true },
    );
    if (!data) {
      return res.status(409).json({ success: false, message: 'This visit was checked out by another request or now requires review.' });
    }

    const finalized = await updateDailyVisitAfterCheckout(data, status, requiresReview, req.user._id);
    if (requiresReview) await notifyVisitReview(data, reviewReason);
    if (!finalized) {
      const reviewReason = 'Check-out was recorded, but the linked daily plan could not be finalized automatically.';
      await Visit.findOneAndUpdate(
        { _id: data._id, checkOutReviewStatus: { $ne: 'resolved' } },
        { $set: { checkOutReviewStatus: 'pending', checkOutReviewReason: reviewReason } },
      );
      await DailyVisit.findOneAndUpdate(
        { _id: data.dailyVisit, visit: data._id },
        { $set: { requiresReview: true } },
      );
      return res.status(409).json({
        success: false,
        reviewRequired: true,
        message: `${reviewReason} The next dealer remains locked; ask an authorized Admin/ASM to resolve the visit.`,
      });
    }
    res.json({
      success: true,
      message: requiresReview
        ? 'Check-out recorded as Suspicious because the visit was shorter than the minimum duration. Authorized Admin/ASM review is required before continuing.'
        : 'GPS check-out verified.',
      data,
      minimumDurationMinutes: MIN_VISIT_DURATION_MINUTES,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.resolveCheckOut = async (req, res) => {
  try {
    if (!['admin', 'asm'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only an Admin or authorized ASM can resolve a GPS check-out review.' });
    }
    const { outcome, notes, overrideReason } = req.body || {};
    if (!['suspicious', 'invalid'].includes(outcome)
      || typeof notes !== 'string' || notes.trim().length < 3 || notes.trim().length > 500
      || typeof overrideReason !== 'string' || overrideReason.trim().length < 10 || overrideReason.trim().length > 500) {
      return res.status(400).json({ success: false, message: 'Choose Suspicious or Invalid, enter review notes, and provide an override reason of 10 to 500 characters.' });
    }
    const visit = await Visit.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found.' });
    if (req.user.role === 'asm') {
      const assignment = visit.dailyVisit ? await DailyVisit.findById(visit.dailyVisit) : null;
      if (!assignment || !await require('./dailyVisitController').managerOwnsPlan(req.user, assignment)) {
        return res.status(403).json({ success: false, message: 'This visit is outside your ASM review scope.' });
      }
    }

    if (visit.checkOutReviewStatus === 'resolved') {
      const finalized = await finalizeResolvedDailyVisit(visit);
      if (!finalized) {
        return res.status(409).json({ success: false, message: 'The visit was resolved, but its daily plan could not be finalized. Retry this resolution to repair the plan.' });
      }
      return res.json({ success: true, message: 'The existing audited resolution was applied to the daily plan.', data: visit });
    }
    if (visit.checkOutReviewStatus !== 'pending') {
      return res.status(409).json({ success: false, message: 'This visit has no pending check-out review.' });
    }

    const resolvedAt = new Date();
    const latestAttempt = visit.checkOutAttempts?.[visit.checkOutAttempts.length - 1];
    const checkOutTime = latestAttempt?.attemptedAt || resolvedAt;
    const checkOutDurationSeconds = visit.checkInTime
      ? Math.max(0, Math.floor((checkOutTime - new Date(visit.checkInTime)) / 1000))
      : 0;
    const attemptLocationStatus = latestAttempt?.result === 'outside_geofence'
      ? 'outside_geofence'
      : latestAttempt?.result === 'accepted'
        ? 'within_geofence'
        : 'not_verified';
    const data = await Visit.findOneAndUpdate(
      {
        _id: visit._id,
        status: { $in: ['checked-in', 'checked-out'] },
        checkOutReviewStatus: 'pending',
      },
      {
        $set: {
          status: 'checked-out',
          checkOutTime,
          checkOutLat: latestAttempt?.latitude ?? null,
          checkOutLng: latestAttempt?.longitude ?? null,
          checkOutAccuracyMeters: latestAttempt?.accuracyMeters ?? null,
          checkOutDistanceMeters: latestAttempt?.distanceMeters ?? null,
          checkOutLocationVerificationStatus: attemptLocationStatus,
          checkOutDurationSeconds,
          checkOutReviewStatus: 'resolved',
          checkOutReviewResolvedAt: resolvedAt,
          checkOutReviewResolvedBy: req.user._id,
          checkOutReviewReason: visit.checkOutReviewReason || latestAttempt?.reason || 'An authorized Admin/ASM reviewed the check-out evidence.',
          verificationStatus: outcome,
          verificationReason: `${notes.trim()} Override: ${overrideReason.trim()}`,
        },
        $push: {
          checkOutReviewHistory: {
            resolvedBy: req.user._id,
            resolvedAt,
            outcome,
            notes: notes.trim(),
            reason: overrideReason.trim(),
          },
          verificationHistory: {
            status: outcome,
            reason: `${notes.trim()} Override: ${overrideReason.trim()}`,
            recordedAt: resolvedAt,
            recordedBy: req.user._id,
          },
        },
      },
      { new: true },
    );
    if (!data) return res.status(409).json({ success: false, message: 'This review was resolved by another request. Reload the visit.' });

    const finalized = await finalizeResolvedDailyVisit(data);
    if (!finalized) {
      return res.status(409).json({ success: false, message: 'The resolution was audited, but the daily plan could not be finalized. Retry this resolution to repair the plan.' });
    }
    res.json({
      success: true,
      message: `Visit review resolved as ${outcome}. The next dealer is now available.`,
      data,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: 'Not found' });
    const updateData = { ...req.body };
    delete updateData.dailyVisitId;
    delete updateData.dailyVisit;
    delete updateData.checkInEmployee;
    delete updateData.checkInAccuracyMeters;
    delete updateData.deviceCapturedAt;
    delete updateData.checkInTime;
    delete updateData.checkOutTime;
    delete updateData.checkOutLat;
    delete updateData.checkOutLng;
    delete updateData.checkOutAccuracyMeters;
    delete updateData.checkOutDistanceMeters;
    delete updateData.checkOutLocationVerificationStatus;
    delete updateData.checkOutDurationSeconds;
    delete updateData.checkOutEmployee;
    delete updateData.checkOutAttempts;
    delete updateData.checkOutSecurityEvents;
    delete updateData.checkOutReviewStatus;
    delete updateData.checkOutReviewReason;
    delete updateData.checkOutReviewResolvedAt;
    delete updateData.checkOutReviewResolvedBy;
    delete updateData.checkOutReviewHistory;
    delete updateData.verificationStatus;
    delete updateData.verificationReason;
    delete updateData.verificationHistory;
    delete updateData.checkInAttempts;
    delete updateData.locationVerificationStatus;
    delete updateData.locationDistanceMeters;
    delete updateData.locationVerificationMessage;
    delete updateData.status;
    if (visit.checkInEmployee) {
      const dealerChanged = req.body.dealer !== undefined
        && String(req.body.dealer) !== String(visit.dealer);
      const latitudeChanged = req.body.checkInLat !== undefined
        && Number(req.body.checkInLat) !== visit.checkInLat;
      const longitudeChanged = req.body.checkInLng !== undefined
        && Number(req.body.checkInLng) !== visit.checkInLng;
      if (dealerChanged || latitudeChanged || longitudeChanged) {
        return res.status(400).json({ success: false, message: 'GPS check-in evidence cannot be edited after check-in.' });
      }
      delete updateData.dealer;
      delete updateData.checkInLat;
      delete updateData.checkInLng;
    }
    const dealerId = visit.checkInEmployee ? visit.dealer : req.body.dealer || visit.dealer;
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });
    const hasLatitude = req.body.checkInLat !== undefined;
    const hasLongitude = req.body.checkInLng !== undefined;
    const latitudeValue = hasLatitude ? req.body.checkInLat : visit.checkInLat;
    const longitudeValue = hasLongitude ? req.body.checkInLng : visit.checkInLng;
    const hasLatitudeValue = latitudeValue !== undefined && latitudeValue !== null && latitudeValue !== '';
    const hasLongitudeValue = longitudeValue !== undefined && longitudeValue !== null && longitudeValue !== '';
    if (hasLatitudeValue !== hasLongitudeValue) {
      return res.status(400).json({ success: false, message: 'Provide both GPS latitude and longitude.' });
    }
    let latitude;
    let longitude;
    if (hasLatitudeValue) {
      latitude = Number(latitudeValue);
      longitude = Number(longitudeValue);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return res.status(400).json({ success: false, message: 'GPS latitude must be between -90 and 90.' });
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return res.status(400).json({ success: false, message: 'GPS longitude must be between -180 and 180.' });
      }
      updateData.checkInLat = latitude;
      updateData.checkInLng = longitude;
    }
    Object.assign(updateData, getLocationVerification(dealer, latitude, longitude));
    const data = await Visit.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found.' });
    if (visit.checkInEmployee || visit.dailyVisit || visit.checkOutAttempts?.length) {
      return res.status(409).json({ success: false, message: 'Recorded GPS visit history cannot be deleted.' });
    }
    await visit.deleteOne();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
