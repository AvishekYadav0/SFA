const assert = require('node:assert/strict');
const recoverStaleActiveVisits = require('../src/utils/staleActiveVisit');

const { shouldArchiveStaleVisit } = recoverStaleActiveVisits;
const now = new Date('2026-10-25T12:00:00.000Z');

assert.equal(
  shouldArchiveStaleVisit(new Date('2026-10-25T00:00:00.000Z'), '2026-10-24', now, 12),
  true,
  'old prior-day visit is eligible for archival recovery',
);
assert.equal(
  shouldArchiveStaleVisit(new Date('2026-10-25T00:00:00.000Z'), '2026-10-25', now, 12),
  false,
  'same-day active assignment is preserved',
);
assert.equal(
  shouldArchiveStaleVisit(new Date('2026-10-25T01:00:00.000Z'), null, now, 12),
  false,
  'a recent orphan is preserved',
);
assert.equal(
  shouldArchiveStaleVisit(new Date('invalid'), null, now, 12),
  false,
  'records without a valid stale timestamp are preserved',
);

console.log('ok - stale active visit recovery uses narrow, idempotent criteria');
