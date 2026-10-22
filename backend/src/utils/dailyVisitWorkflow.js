const TERMINAL_STATUSES = new Set(['completed', 'verified', 'suspicious', 'invalid', 'missed']);

function isDailyVisitFinalized(visit) {
  const status = visit.status || (
    visit.visitStatus === 'visited' ? 'completed'
      : visit.visitStatus === 'skipped' ? 'missed' : 'pending'
  );
  return TERMINAL_STATUSES.has(status) && visit.requiresReview !== true;
}

module.exports = { isDailyVisitFinalized };
