const mongoose = require('mongoose');
const DailyVisit = require('../models/DailyVisit');
const Dealer = require('../models/Dealer');
const User = require('../models/User');
const Visit = require('../models/Visit');
const activeVisitFilter = require('../utils/activeVisitFilter');
const { isDailyVisitFinalized } = require('../utils/dailyVisitWorkflow');
const { getDealerGeofenceRadius } = require('../utils/visitGps');
const Notification = require('../models/Notification');

const today = () => new Date().toISOString().slice(0, 10);
const configuredDeadlineHour = Number(process.env.VISIT_PLAN_DEADLINE_HOUR);
const VISIT_PLAN_DEADLINE_HOUR = Number.isInteger(configuredDeadlineHour) && configuredDeadlineHour >= 0 && configuredDeadlineHour <= 23
  ? configuredDeadlineHour
  : 23;
const MAX_ACTIVE_VISIT_HOURS = Math.max(1, Number(process.env.VISIT_MAX_ACTIVE_HOURS) || 12);
function normalizeStatus(visit) {
  if (visit.status) return visit.status;
  if (visit.visitStatus === 'visited') return 'completed';
  if (visit.visitStatus === 'skipped') return 'missed';
  return 'pending';
}

function serializeVisit(visit) {
  const data = visit.toObject ? visit.toObject() : { ...visit };
  data.status = normalizeStatus(data);
  data.workflowStatus = data.workflowStatus || (
    ['verified', 'suspicious', 'invalid'].includes(data.status) ? 'completed' : data.status
  );
  data.verificationStatus = data.verificationStatus || (
    ['verified', 'suspicious', 'invalid'].includes(data.status)
      ? data.status
      : data.visit?.verificationStatus || (data.visit?.status === 'checked-in' ? 'in_progress' : 'pending')
  );
  if (data.dealer?.dealerName) {
    data.dealer.geofenceRadius = getDealerGeofenceRadius(data.dealer);
  }
  data.sequence = Number(data.sequence) || 1;
  return data;
}

async function normalizeLegacySequence(visits) {
  const groups = new Map();
  for (const visit of visits) {
    const key = `${visit.date}:${String(visit.staff?._id || visit.staff)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(visit);
  }
  for (const group of groups.values()) {
    const sequences = group.map(visit => Number(visit.sequence));
    if (sequences.every(sequence => sequence > 0) && new Set(sequences).size === group.length) continue;
    group.sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));
    await Promise.all(group.map((visit, index) => {
      visit.sequence = index + 1;
      return DailyVisit.updateOne({ _id: visit._id }, { $set: { sequence: visit.sequence } });
    }));
  }
}

async function expirePastAssignments(date) {
  const now = new Date();
  const pastDateFilter = now.getUTCHours() >= VISIT_PLAN_DEADLINE_HOUR
    ? { $lte: date }
    : { $lt: date };
  const filter = {
    date: pastDateFilter,
    visit: null,
    requiresReview: { $ne: true },
    $or: [
      { status: { $in: ['pending', 'in_progress'] } },
      { status: { $exists: false }, visitStatus: 'assigned' },
    ],
  };
  const overdue = await DailyVisit.find(filter).select('_id status visitStatus').lean();
  await Promise.all(overdue.map(assignment => {
    const currentStatusFilter = assignment.status
      ? { status: assignment.status }
      : { status: { $exists: false }, visitStatus: 'assigned' };
    return DailyVisit.findOneAndUpdate(
      { _id: assignment._id, visit: null, requiresReview: { $ne: true }, ...currentStatusFilter },
      {
      $set: { status: 'missed', workflowStatus: 'missed', verificationStatus: 'pending', visitStatus: 'skipped' },
      $push: {
        statusHistory: {
          from: assignment.status || 'pending',
          to: 'missed',
          changedAt: now,
          reason: 'The planned visit deadline passed without a check-in.',
        },
      },
      },
    );
  }));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function workflowStatusOf(plan) {
  if (plan.workflowStatus) return plan.workflowStatus;
  const status = normalizeStatus(plan);
  if (['verified', 'suspicious', 'invalid'].includes(status)) return 'completed';
  return status;
}

function verificationStatusOf(plan) {
  if (plan.verificationStatus) return plan.verificationStatus;
  if (['verified', 'suspicious', 'invalid'].includes(plan.status)) return plan.status;
  return plan.visit?.verificationStatus || (plan.visit?.status === 'checked-in' ? 'in_progress' : 'pending');
}

async function getManagedStaffIds(user) {
  if (user.role === 'admin') {
    const employees = await User.find({ role: { $in: ['so', 'se', 'asm', 'rsm', 'nsm'] } }).select('_id');
    return employees.map(employee => employee._id);
  }
  if (user.role !== 'asm') return [user._id];

  const employees = await User.find({
    role: { $in: ['so', 'se'] },
    $or: [{ asm: user._id }, { reportsTo: user._id }],
  }).select('_id');
  return [user._id, ...employees.map(employee => employee._id)];
}

async function managerOwnsPlan(user, plan) {
  if (user.role === 'admin') return true;
  if (String(plan.staff) === String(user._id) && ['asm', 'rsm', 'nsm'].includes(user.role)) return true;
  if (user.role !== 'asm') return false;
  const employee = await User.findOne({
    _id: plan.staff,
    role: { $in: ['so', 'se'] },
    $or: [{ asm: user._id }, { reportsTo: user._id }],
  }).select('_id');
  return Boolean(employee);
}

exports.assign = async (req, res) => {
  try {
    const { date, staff, dealers } = req.body;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
      return res.status(400).json({ success: false, message: 'Enter a valid planned date.' });
    }
    if (!mongoose.isValidObjectId(staff)) {
      return res.status(400).json({ success: false, message: 'Select a valid employee.' });
    }
    if (!Array.isArray(dealers) || dealers.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one dealer.' });
    }
    const dealerIds = dealers.map(id => String(id));
    if (dealerIds.some(id => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: 'One or more selected dealers are invalid.' });
    }
    if (new Set(dealerIds).size !== dealerIds.length) {
      return res.status(400).json({ success: false, message: 'A dealer can only appear once in a daily plan.' });
    }

    const employee = await User.findOne({
      _id: staff,
      role: { $in: ['so', 'se', 'asm', 'rsm', 'nsm'] },
      status: 'active',
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Active field employee not found.' });
    if (req.user.role === 'asm'
      && String(employee._id) !== String(req.user._id)
      && (!['so', 'se'].includes(employee.role)
        || (String(employee.asm || '') !== String(req.user._id)
          && String(employee.reportsTo || '') !== String(req.user._id)))) {
      return res.status(403).json({ success: false, message: 'You can only plan visits for employees in your ASM hierarchy.' });
    }

    const selectedDealers = await Dealer.find({ _id: { $in: dealerIds } }).select('dealerName so se asm rsm nsm');
    if (selectedDealers.length !== dealerIds.length) {
      return res.status(404).json({ success: false, message: 'One or more selected dealers were not found.' });
    }
    const notAssignedToEmployee = selectedDealers.filter(dealer => {
      if (employee.role === 'so') return !(dealer.so || []).some(id => String(id) === String(employee._id));
      if (employee.role === 'se') return String(dealer.se || '') !== String(employee._id);
      return String(dealer[employee.role] || '') !== String(employee._id);
    });
    if (notAssignedToEmployee.length) {
      return res.status(403).json({
        success: false,
        message: `Dealers must already be assigned to ${employee.name} in the dealer hierarchy: ${notAssignedToEmployee.map(d => d.dealerName).join(', ')}.`,
      });
    }

    const existing = await DailyVisit.find({
      date,
      staff,
      dealer: { $in: dealerIds },
    }).populate('dealer', 'dealerName');
    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: `Already assigned for this employee and date: ${existing.map(item => item.dealer?.dealerName || 'dealer').join(', ')}.`,
      });
    }

    const existingAssignments = await DailyVisit.find({ date, staff }).sort({ sequence: 1, createdAt: 1 });
    await normalizeLegacySequence(existingAssignments);
    const lastAssignment = await DailyVisit.findOne({ date, staff }).sort({ sequence: -1, createdAt: -1 }).select('sequence');
    const startingSequence = lastAssignment ? Number(lastAssignment.sequence || 0) + 1 : 1;
    const docs = await DailyVisit.insertMany(dealerIds.map((dealer, index) => ({
      date,
      staff,
      dealer,
      sequence: startingSequence + index,
      status: 'pending',
      workflowStatus: 'pending',
      verificationStatus: 'pending',
      visitStatus: 'assigned',
      assignedBy: req.user._id,
      statusHistory: [{
        from: 'unassigned',
        to: 'pending',
        changedBy: req.user._id,
        changedAt: new Date(),
        reason: 'Dealer added to the daily visit plan.',
      }],
    })));
    res.status(201).json({ success: true, message: 'Daily visit plan created.', data: docs });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A selected dealer is already assigned to this employee for the planned date.' });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const date = req.query.date || today();
    await expirePastAssignments(today());
    const managedIds = req.user.role === 'admin' ? null : await getManagedStaffIds(req.user);
    const filter = { date };
    if (managedIds) filter.staff = { $in: managedIds };
    if (req.query.staff) {
      if (managedIds && !managedIds.some(id => String(id) === String(req.query.staff))) {
        return res.status(403).json({ success: false, message: 'Employee is outside your assignment scope.' });
      }
      filter.staff = req.query.staff;
    }

    const visits = await DailyVisit.find(filter)
      .populate('staff', 'name email employeeId role asm reportsTo')
      .populate('dealer', 'dealerName distributor area province district phone address locationVerificationStatus status latitude longitude geofenceRadius')
      .populate('assignedBy', 'name')
      .populate('visit', 'checkInTime checkOutTime checkInLat checkInLng checkInAccuracyMeters locationVerificationStatus locationDistanceMeters locationVerificationMessage status verificationStatus verificationReason verificationHistory checkOutLat checkOutLng checkOutAccuracyMeters checkOutDistanceMeters checkOutLocationVerificationStatus checkOutDurationSeconds checkOutReviewStatus checkOutReviewReason checkOutReviewHistory checkOutAttempts checkOutSecurityEvents')
      .sort({ staff: 1, sequence: 1, createdAt: 1 });
    await normalizeLegacySequence(visits);
    res.json({ success: true, data: visits.map(serializeVisit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getReport = async (req, res) => {
  try {
    const { startDate = req.query.date || today(), endDate = req.query.date || today() } = req.query;
    const validDate = value => typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
      && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
      return res.status(400).json({ success: false, message: 'Provide a valid date range.' });
    }

    const managedIds = await getManagedStaffIds(req.user);
    const staffCriteria = { _id: { $in: managedIds } };
    const staffConditions = [];
    for (const field of ['rsm', 'asm', 'so', 'se']) {
      const id = req.query[field];
      if (!id) continue;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: `Invalid ${field.toUpperCase()} filter.` });
      }
      if (field === 'so' || field === 'se') {
        const inScope = managedIds.some(item => String(item) === String(id));
        if (!inScope) return res.status(403).json({ success: false, message: 'Employee is outside your reporting scope.' });
        staffConditions.push({ _id: id });
      } else {
        staffConditions.push({ $or: [{ [field]: id }, { _id: id }] });
      }
    }
    if (req.query.staff) {
      if (!mongoose.isValidObjectId(req.query.staff)
        || !managedIds.some(item => String(item) === String(req.query.staff))) {
        return res.status(403).json({ success: false, message: 'Employee is outside your reporting scope.' });
      }
      staffConditions.push({ _id: req.query.staff });
    }
    if (staffConditions.length) staffCriteria.$and = staffConditions;
    const matchingStaff = await User.find(staffCriteria).select('_id');
    const staffIds = matchingStaff.map(item => item._id);
    const filter = { date: { $gte: startDate, $lte: endDate }, staff: { $in: staffIds } };

    const dealerFilter = {};
    if (req.query.dealer) {
      if (!mongoose.isValidObjectId(req.query.dealer)) {
        return res.status(400).json({ success: false, message: 'Invalid dealer filter.' });
      }
      dealerFilter._id = req.query.dealer;
    }
    if (req.query.distributor) dealerFilter.distributor = new RegExp(escapeRegex(req.query.distributor), 'i');
    if (req.query.province) dealerFilter.province = req.query.province;
    if (req.query.district) dealerFilter.district = req.query.district;
    if (Object.keys(dealerFilter).length) {
      const dealers = await Dealer.find(dealerFilter).select('_id');
      filter.dealer = { $in: dealers.map(item => item._id) };
    }

    const workflowStatus = req.query.workflowStatus;
    if (workflowStatus) {
      if (!['pending', 'in_progress', 'completed', 'missed'].includes(workflowStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid workflow status filter.' });
      }
      filter.$and ||= [];
      const legacyStatuses = workflowStatus === 'completed'
        ? ['completed', 'verified', 'suspicious', 'invalid']
        : [workflowStatus];
      filter.$and.push({
        $or: [
          { workflowStatus },
          { workflowStatus: { $exists: false }, status: { $in: legacyStatuses } },
        ],
      });
    }
    const verificationStatus = req.query.verificationStatus;
    if (verificationStatus) {
      if (!['pending', 'in_progress', 'verified', 'suspicious', 'invalid'].includes(verificationStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid verification status filter.' });
      }
      filter.$and ||= [];
      const legacyStatuses = ['verified', 'suspicious', 'invalid'].includes(verificationStatus) ? [verificationStatus] : [];
      filter.$and.push({
        $or: [
          { verificationStatus },
          { verificationStatus: { $exists: false }, status: { $in: legacyStatuses.length ? legacyStatuses : [verificationStatus] } },
        ],
      });
    }

    await expirePastAssignments(today());
    const plans = await DailyVisit.find(filter)
      .populate('staff', 'name email employeeId role asm rsm so se reportsTo')
      .populate('dealer', 'dealerName distributor area province district phone address locationVerificationStatus status latitude longitude geofenceRadius')
      .populate('visit', 'checkInTime checkOutTime checkInLat checkInLng checkInAccuracyMeters locationVerificationStatus locationDistanceMeters locationVerificationMessage status verificationStatus verificationReason verificationHistory checkOutLat checkOutLng checkOutAccuracyMeters checkOutDistanceMeters checkOutLocationVerificationStatus checkOutDurationSeconds checkOutReviewStatus checkOutReviewReason checkOutReviewHistory checkOutAttempts checkOutSecurityEvents')
      .sort({ date: -1, staff: 1, sequence: 1, createdAt: 1 })
      .lean();
    const rows = plans.map(plan => ({
      ...serializeVisit(plan),
      workflowStatus: workflowStatusOf(plan),
      verificationStatus: verificationStatusOf(plan),
      gpsValidationFailures: (plan.checkInAttempts || []).length
        + (plan.visit?.checkOutAttempts || []).filter(attempt => attempt.result !== 'accepted').length
        + (plan.visit?.checkOutSecurityEvents || []).length,
      awaitingReview: plan.requiresReview === true || plan.visit?.checkOutReviewStatus === 'pending',
      activeTooLong: plan.visit?.status === 'checked-in'
        && plan.visit.checkInTime
        && Date.now() - new Date(plan.visit.checkInTime).getTime() > MAX_ACTIVE_VISIT_HOURS * 60 * 60 * 1000,
      failureReason: plan.visit?.verificationReason
        || plan.visit?.checkOutReviewReason
        || plan.visit?.checkOutSecurityEvents?.at(-1)?.reason
        || plan.visit?.checkOutAttempts?.at(-1)?.reason
        || plan.checkInAttempts?.at(-1)?.reason
        || plan.reviewResolutionNote
        || '',
    }));
    const summary = rows.reduce((counts, row) => {
      counts.totalAssigned += 1;
      const workflow = row.workflowStatus;
      const verification = row.verificationStatus;
      if (workflow === 'completed') counts.completed += 1;
      if (verification === 'verified') counts.verified += 1;
      if (workflow === 'pending') counts.pending += 1;
      if (workflow === 'in_progress') counts.inProgress += 1;
      if (verification === 'suspicious') counts.suspicious += 1;
      if (verification === 'invalid') counts.invalid += 1;
      if (workflow === 'missed') counts.missed += 1;
      counts.gpsValidationFailures += row.gpsValidationFailures;
      if (row.awaitingReview) counts.awaitingReview += 1;
      if (row.activeTooLong) counts.activeTooLong += 1;
      return counts;
    }, {
      totalAssigned: 0,
      completed: 0,
      verified: 0,
      pending: 0,
      inProgress: 0,
      suspicious: 0,
      invalid: 0,
      missed: 0,
      gpsValidationFailures: 0,
      awaitingReview: 0,
      activeTooLong: 0,
    });
    summary.dealersWithoutApprovedGps = new Set(
      rows.filter(row => row.dealer?.locationVerificationStatus !== 'approved').map(row => String(row.dealer?._id)),
    ).size;
    res.json({
      success: true,
      data: rows.slice(0, Math.min(1000, Math.max(1, Number(req.query.limit) || 500))),
      total: rows.length,
      summary,
      settings: {
        visitPlanDeadlineHourUtc: VISIT_PLAN_DEADLINE_HOUR,
        maximumActiveVisitHours: MAX_ACTIVE_VISIT_HOURS,
      },
      pageInfo: { truncated: rows.length > 1000 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMine = async (req, res) => {
  try {
    const date = req.query.date || today();
    await expirePastAssignments(today());
    const visits = await DailyVisit.find({ staff: req.user._id, date })
      .populate('dealer', 'dealerName area province phone address locationVerificationStatus status latitude longitude geofenceRadius')
      .populate('visit', 'checkInTime checkOutTime checkInLat checkInLng checkInAccuracyMeters locationVerificationStatus locationDistanceMeters locationVerificationMessage status verificationStatus verificationReason verificationHistory checkOutLat checkOutLng checkOutAccuracyMeters checkOutDistanceMeters checkOutLocationVerificationStatus checkOutDurationSeconds checkOutReviewStatus checkOutReviewReason checkOutReviewHistory checkOutAttempts checkOutSecurityEvents')
      .sort({ sequence: 1, createdAt: 1 });
    await normalizeLegacySequence(visits);
    res.json({ success: true, data: visits.map(serializeVisit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.start = async (req, res) => {
  try {
    await expirePastAssignments(today());
    let assignment = await DailyVisit.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Daily visit assignment not found.' });
    if (String(assignment.staff) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the assigned employee can start this visit.' });
    }
    if (assignment.date !== today()) {
      return res.status(400).json({ success: false, message: 'Only visits planned for today can be started.' });
    }
    if (new Date().getUTCHours() >= VISIT_PLAN_DEADLINE_HOUR) {
      return res.status(409).json({ success: false, message: 'The daily visit-plan deadline has passed; this stop can no longer be started.' });
    }
    const activeCheckIn = await Visit.findOne(activeVisitFilter(req.user)).select('_id');
    if (activeCheckIn) {
      return res.status(409).json({ success: false, message: 'Check out of your active visit before starting another dealer.' });
    }
    const sameDayAssignments = await DailyVisit.find({
      date: assignment.date,
      staff: assignment.staff,
    }).sort({ sequence: 1, createdAt: 1 });
    await normalizeLegacySequence(sameDayAssignments);
    assignment = await DailyVisit.findById(assignment._id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Daily visit assignment not found.' });
    const status = normalizeStatus(assignment);
    if (status !== 'pending') {
      return res.status(409).json({ success: false, message: 'This visit is not pending.' });
    }

    const earlierVisits = await DailyVisit.find({
      date: assignment.date,
      staff: assignment.staff,
      sequence: { $lt: assignment.sequence },
    }).sort({ sequence: 1 });
    const unresolved = earlierVisits.find(item => !isDailyVisitFinalized(item));
    if (unresolved) {
      return res.status(409).json({
        success: false,
        message: unresolved.requiresReview
          ? 'The previous visit is awaiting an authorized review. It must be resolved before starting the next dealer.'
          : 'Complete the current dealer visit before starting the next one.',
      });
    }
    const activeVisit = await DailyVisit.findOne({
      date: assignment.date,
      staff: assignment.staff,
      status: 'in_progress',
      _id: { $ne: assignment._id },
    });
    if (activeVisit) {
      return res.status(409).json({ success: false, message: 'Complete the in-progress dealer visit before starting another.' });
    }

    const updated = await DailyVisit.findOneAndUpdate(
      {
        _id: assignment._id,
        staff: req.user._id,
        $or: [{ status: 'pending' }, { status: { $exists: false }, visitStatus: 'assigned' }],
      },
      { $set: {
        status: 'in_progress',
        workflowStatus: 'in_progress',
        verificationStatus: 'in_progress',
        startedAt: new Date(),
        statusUpdatedBy: req.user._id,
      },
      $push: {
        statusHistory: {
          from: 'pending',
          to: 'in_progress',
          changedBy: req.user._id,
          changedAt: new Date(),
          reason: 'Assigned employee started the visit.',
        },
      } },
      { new: true },
    ).populate('dealer', 'dealerName area province phone address locationVerificationStatus status latitude longitude geofenceRadius');
    if (!updated) return res.status(409).json({ success: false, message: 'This visit was updated by another request. Reload the plan.' });
    res.json({ success: true, data: serializeVisit(updated) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, notes, overrideReason } = req.body;
    if (!['invalid', 'missed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Managers may mark a visit Invalid or Missed only.' });
    }
    const assignment = await DailyVisit.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Visit not found.' });
    if (!await managerOwnsPlan(req.user, assignment)) {
      return res.status(403).json({ success: false, message: 'This assignment is outside your management scope.' });
    }
    if (assignment.requiresReview) {
      return res.status(409).json({ success: false, message: 'This visit is awaiting an authorized checkout review and cannot be manually skipped or changed.' });
    }
    if (normalizeStatus(assignment) === status) {
      return res.status(409).json({ success: false, message: `This visit is already marked ${status}.` });
    }
    if (status === 'missed' && assignment.date >= today()) {
      return res.status(400).json({ success: false, message: 'A visit can be marked Missed only after its planned date.' });
    }
    if (status === 'missed' && assignment.visit) {
      return res.status(409).json({ success: false, message: 'A stop with a recorded check-in cannot be marked Missed.' });
    }
    if (status === 'invalid' && assignment.visit) {
      return res.status(409).json({ success: false, message: 'GPS-linked visits must be marked Invalid through the audited review workflow.' });
    }
    if (status === 'invalid' && !['completed', 'verified', 'suspicious'].includes(normalizeStatus(assignment))) {
      return res.status(400).json({ success: false, message: 'Only a recorded visit can be marked Invalid.' });
    }
    if (status === 'invalid'
      && (typeof notes !== 'string' || notes.trim().length < 3
        || notes.trim().length > 500
        || typeof overrideReason !== 'string' || overrideReason.trim().length < 10
        || overrideReason.trim().length > 500)) {
      return res.status(400).json({ success: false, message: 'Invalid resolutions require review notes and an override reason of at least 10 characters.' });
    }
    const resolvedAt = new Date();
    const statusFilter = {
      $or: [
        { status: assignment.status },
        { status: { $exists: false }, visitStatus: assignment.visitStatus },
      ],
    };
    const updated = await DailyVisit.findOneAndUpdate(
      { _id: assignment._id, requiresReview: { $ne: true }, ...statusFilter },
      {
        $set: {
          status,
          workflowStatus: status === 'missed' ? 'missed' : 'completed',
          verificationStatus: status === 'invalid' ? 'invalid' : 'pending',
          visitStatus: status === 'missed' ? 'skipped' : assignment.visitStatus,
          notes: typeof notes === 'string' ? notes : assignment.notes,
          statusUpdatedBy: req.user._id,
          ...(status === 'invalid' ? {
            requiresReview: false,
            reviewResolvedAt: resolvedAt,
            reviewResolvedBy: req.user._id,
            reviewResolution: 'invalid',
            reviewResolutionNote: `${notes.trim()} Override reason: ${overrideReason.trim()}`,
          } : {}),
        },
        $push: {
          statusHistory: {
            from: normalizeStatus(assignment),
            to: status,
            changedBy: req.user._id,
            changedAt: resolvedAt,
            reason: status === 'missed'
              ? 'Manager marked the incomplete stop as missed.'
              : `${notes.trim()} Override reason: ${overrideReason.trim()}`,
          },
          ...(status === 'invalid' ? {
            reviewHistory: {
              resolvedBy: req.user._id,
              resolvedAt,
              outcome: 'invalid',
              notes: notes.trim(),
              overrideReason: overrideReason.trim(),
            },
          } : {}),
        },
      },
      { new: true },
    ).populate('dealer', 'dealerName area province phone address');
    if (!updated) {
      return res.status(409).json({ success: false, message: 'This visit status changed during the update. Reload the plan.' });
    }
    res.json({ success: true, data: serializeVisit(updated) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.resolveCheckInReview = async (req, res) => {
  try {
    if (!['admin', 'asm'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only an Admin or authorized ASM can resolve a GPS check-in review.' });
    }
    const { outcome, notes, overrideReason } = req.body || {};
    if (!['suspicious', 'invalid'].includes(outcome)
      || typeof notes !== 'string' || notes.trim().length < 3 || notes.trim().length > 500
      || typeof overrideReason !== 'string' || overrideReason.trim().length < 10 || overrideReason.trim().length > 500) {
      return res.status(400).json({ success: false, message: 'Choose Suspicious or Invalid, enter review notes, and provide an override reason of 10 to 500 characters.' });
    }
    const assignment = await DailyVisit.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Daily visit assignment not found.' });
    if (!await managerOwnsPlan(req.user, assignment)) {
      return res.status(403).json({ success: false, message: 'This assignment is outside your review scope.' });
    }
    if (!assignment.requiresReview || assignment.visit || !assignment.checkInAttempts?.length) {
      return res.status(409).json({ success: false, message: 'This assignment has no unresolved check-in GPS review.' });
    }
    const resolvedAt = new Date();
    const resolutionNote = `${notes.trim()} Override reason: ${overrideReason.trim()}`;
    const updated = await DailyVisit.findOneAndUpdate(
      { _id: assignment._id, requiresReview: true, visit: null },
      {
        $set: {
          status: outcome,
          workflowStatus: 'completed',
          verificationStatus: outcome,
          requiresReview: false,
          visitStatus: 'skipped',
          completedAt: resolvedAt,
          reviewResolvedAt: resolvedAt,
          reviewResolvedBy: req.user._id,
          reviewResolution: outcome,
          reviewResolutionNote: resolutionNote,
          statusUpdatedBy: req.user._id,
        },
        $push: {
          statusHistory: {
            from: normalizeStatus(assignment),
            to: outcome,
            changedBy: req.user._id,
            changedAt: resolvedAt,
            reason: resolutionNote,
          },
          reviewHistory: {
            resolvedBy: req.user._id,
            resolvedAt,
            outcome,
            notes: notes.trim(),
            overrideReason: overrideReason.trim(),
          },
        },
      },
      { new: true },
    );
    if (!updated) return res.status(409).json({ success: false, message: 'This review was resolved by another request. Reload the plan.' });
    res.json({ success: true, message: `GPS check-in review resolved as ${outcome}. The next assigned stop is now available.`, data: serializeVisit(updated) });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const assignment = await DailyVisit.findById(req.params.id);
    if (!assignment) return res.status(404).json({ success: false, message: 'Visit assignment not found.' });
    if (!await managerOwnsPlan(req.user, assignment)) {
      return res.status(403).json({ success: false, message: 'This assignment is outside your management scope.' });
    }
    if (normalizeStatus(assignment) !== 'pending') {
      return res.status(409).json({ success: false, message: 'Only pending visits can be removed.' });
    }
    await assignment.deleteOne();
    res.json({ success: true, message: 'Assignment removed.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.managerOwnsPlan = managerOwnsPlan;
