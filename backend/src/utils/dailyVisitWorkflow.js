const TERMINAL_STATUSES = new Set(['completed', 'verified', 'suspicious', 'invalid', 'missed']);

function isDailyVisitFinalized(visit) {
  const status = visit.status || (
    visit.visitStatus === 'visited' ? 'completed'
      : visit.visitStatus === 'skipped' ? 'missed' : 'pending'
  );
  const hasRecordedCheckout = visit.visitStatus === 'visited';
  return TERMINAL_STATUSES.has(status) && (visit.requiresReview !== true || hasRecordedCheckout);
}

module.exports = { isDailyVisitFinalized };
