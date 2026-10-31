const Visit = require('../models/Visit');
const DailyVisit = require('../models/DailyVisit');
const activeVisitFilter = require('./activeVisitFilter');

const configuredHours = Number(process.env.VISIT_MAX_ACTIVE_HOURS);
const MAX_ACTIVE_VISIT_HOURS = Math.max(1, configuredHours || 12);

function utcDateString(date) {
  return date.toISOString().slice(0, 10);
}

function shouldArchiveStaleVisit(checkInDate, assignmentDate, now, maxActiveHours) {
  const checkedInAt = new Date(checkInDate);
  if (Number.isNaN(checkedInAt.getTime())) return false;
  const cutoff = new Date(now.getTime() - maxActiveHours * 60 * 60 * 1000);
  return checkedInAt <= cutoff
    && (!assignmentDate || assignmentDate < utcDateString(now));
}

async function recoverStaleActiveVisits(user) {
  if (!['so', 'se', 'asm', 'rsm', 'nsm'].includes(user.role)) return;

  const now = new Date();
  const activeVisits = await Visit.find(activeVisitFilter(user))
    .select('_id dailyVisit checkInTime createdAt status')
    .sort({ checkInTime: 1, createdAt: 1 });

  for (const visit of activeVisits) {
    const checkedInAt = visit.checkInTime || visit.createdAt;

    const assignment = visit.dailyVisit
      ? await DailyVisit.findById(visit.dailyVisit).select('_id date visit status')
      : null;
    if (!shouldArchiveStaleVisit(checkedInAt, assignment?.date, now, MAX_ACTIVE_VISIT_HOURS)) continue;

    const reason = assignment
      ? 'A prior-day visit exceeded the configured active-visit limit and was archived to release the employee’s active visit lock.'
      : 'An orphaned active visit exceeded the configured active-visit limit and was archived to release the employee’s active visit lock.';
    const durationSeconds = Math.max(0, Math.floor((now - new Date(checkedInAt)) / 1000));
    const archived = await Visit.findOneAndUpdate(
      { _id: visit._id, ...activeVisitFilter(user) },
      {
        $set: {
          status: 'checked-out',
          checkOutTime: now,
          checkOutDurationSeconds: durationSeconds,
          checkOutLocationVerificationStatus: 'not_verified',
          checkOutReviewStatus: 'not_required',
          verificationStatus: 'suspicious',
          verificationReason: reason,
        },
        $push: {
          checkOutSecurityEvents: {
            actor: user._id,
            attemptedAt: now,
            reason,
          },
          verificationHistory: {
            status: 'suspicious',
            reason,
            recordedAt: now,
            recordedBy: user._id,
          },
        },
      },
      { new: true },
    );

    if (archived?.dailyVisit) {
      await DailyVisit.findOneAndUpdate(
        { _id: archived.dailyVisit, visit: archived._id, status: 'in_progress' },
        {
          $set: {
            status: 'suspicious',
            workflowStatus: 'completed',
            verificationStatus: 'suspicious',
            visitStatus: 'visited',
            requiresReview: false,
            completedAt: now,
            statusUpdatedBy: user._id,
          },
          $push: {
            statusHistory: {
              from: 'in_progress',
              to: 'suspicious',
              changedBy: user._id,
              changedAt: now,
              reason,
            },
          },
        },
      );
    }
  }
}

recoverStaleActiveVisits.shouldArchiveStaleVisit = shouldArchiveStaleVisit;

module.exports = recoverStaleActiveVisits;
