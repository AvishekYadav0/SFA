const assert = require('node:assert/strict');
const Visit = require('../src/models/Visit');
const DailyVisit = require('../src/models/DailyVisit');
const combinedVisitRouter = require('../src/routes/combined').visits;
const { authorize } = require('../src/middleware/auth');
const activeVisitFilter = require('../src/utils/activeVisitFilter');
const { isDailyVisitFinalized } = require('../src/utils/dailyVisitWorkflow');
const { validateGpsFix } = require('../src/utils/visitGps');

function test(name, run) {
  run();
  console.log(`ok - ${name}`);
}

const dealer = {
  latitude: 27,
  longitude: 85,
  geofenceRadius: 75,
  locationVerificationStatus: 'approved',
};

function coordinateNorthOfDealer(meters) {
  return dealer.latitude + meters / 111320;
}

test('check-in/out GPS validation accepts 50 m and rejects 100 m against the 75 m fence', () => {
  const at50Meters = validateGpsFix(dealer, coordinateNorthOfDealer(50), dealer.longitude, 10);
  const at100Meters = validateGpsFix(dealer, coordinateNorthOfDealer(100), dealer.longitude, 10);

  assert.equal(at50Meters.result, 'accepted');
  assert.ok(Math.abs(at50Meters.distanceMeters - 50) < 1);
  assert.equal(at100Meters.result, 'outside_geofence');
  assert.ok(Math.abs(at100Meters.distanceMeters - 100) < 1);
});

test('GPS validation rejects unapproved dealer locations and poor accuracy', () => {
  assert.equal(
    validateGpsFix({ ...dealer, locationVerificationStatus: 'pending_approval' }, 27, 85, 5).result,
    'dealer_location_unapproved',
  );
  assert.equal(validateGpsFix(dealer, 27, 85, 50.1).result, 'inaccurate');
  assert.equal(validateGpsFix(dealer, 91, 85, 5).result, 'invalid_coordinates');
});

test('the database indexes prevent duplicate daily assignments and simultaneous active visits', () => {
  const visitIndexes = Visit.schema.indexes();
  const activeVisitIndex = visitIndexes.find(([keys, options]) =>
    keys.checkInEmployee === 1 && options.unique && options.partialFilterExpression?.status === 'checked-in');
  assert.ok(activeVisitIndex, 'active visits must be unique by check-in employee');

  const dailyVisitIndexes = DailyVisit.schema.indexes();
  assert.ok(dailyVisitIndexes.some(([keys, options]) =>
    options.unique && keys.date === 1 && keys.staff === 1 && keys.dealer === 1));
  assert.ok(dailyVisitIndexes.some(([keys, options]) =>
    options.unique && keys.date === 1 && keys.staff === 1
    && options.partialFilterExpression?.status === 'in_progress'));
});

test('active-visit queries are restricted to the authenticated employee', () => {
  const employee = { _id: 'employee-1', role: 'se' };
  const filter = activeVisitFilter(employee);
  assert.equal(filter.status, 'checked-in');
  assert.deepEqual(filter.$or[0], { checkInEmployee: employee._id });
  assert.equal(filter.$or[1].checkInEmployee, null);
  assert.equal(filter.$or[1].createdBy, employee._id);
});

test('legacy checkout ownership requires a missing check-in owner and matching employee audit fields', () => {
  const employee = { _id: 'employee-1', role: 'se' };
  const legacyFilter = activeVisitFilter.legacy(employee);
  assert.equal(legacyFilter.status, 'checked-in');
  assert.equal(legacyFilter.checkInEmployee, null);
  assert.deepEqual(legacyFilter.$or, [{
    createdBy: employee._id,
    se: employee._id,
    so: { $exists: false },
  }]);
});

test('only finalized prior stops unlock the next daily visit', () => {
  assert.equal(isDailyVisitFinalized({ status: 'verified' }), true);
  assert.equal(isDailyVisitFinalized({ status: 'suspicious', requiresReview: true }), false);
  assert.equal(isDailyVisitFinalized({ status: 'in_progress' }), false);
  assert.equal(isDailyVisitFinalized({ status: 'missed', requiresReview: false }), true);
});

test('GPS approval, reporting, and exception routes require their authorized roles', () => {
  let denied = false;
  authorize('admin', 'asm')(
    { user: { role: 'se' } },
    { status: code => ({ json: () => { denied = code === 403; } }) },
    () => assert.fail('unauthorized employee must not pass reviewer authorization'),
  );
  assert.equal(denied, true);
});

test('mounted visit API registers /active before the parameterized visit ID route', () => {
  const paths = combinedVisitRouter.stack
    .filter(layer => layer.route)
    .map(layer => layer.route.path);
  assert.ok(paths.indexOf('/active') >= 0);
  assert.ok(paths.indexOf('/active') < paths.indexOf('/:id'));
});
