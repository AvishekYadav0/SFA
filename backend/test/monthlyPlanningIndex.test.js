const assert = require('node:assert/strict');
const test = require('node:test');
const { migrateMonthlyPlanningIndex } = require('../migrateMonthlyPlanningIndex');

function createCollection({ indexes = [], unassigned = 0, duplicates = [] } = {}) {
  const operations = [];
  return {
    operations,
    indexes: async () => indexes,
    countDocuments: async filter => filter ? unassigned : 3,
    aggregate: () => ({ toArray: async () => duplicates }),
    createIndex: async (keys, options) => {
      operations.push({ type: 'createIndex', keys, options });
      return options.name;
    },
    dropIndex: async name => operations.push({ type: 'dropIndex', name }),
  };
}

test('monthly planning index migration creates tenant uniqueness before removing global uniqueness', async () => {
  const collection = createCollection({
    indexes: [{ name: 'month_1_year_1', key: { month: 1, year: 1 }, unique: true }],
  });
  const result = await migrateMonthlyPlanningIndex({ collection: () => collection });

  assert.deepEqual(collection.operations.map(operation => operation.type), ['createIndex', 'dropIndex']);
  assert.equal(collection.operations[0].options.unique, true);
  assert.deepEqual(collection.operations[0].keys, { companyId: 1, month: 1, year: 1 });
  assert.equal(result.removedGlobalUniqueIndex, 'month_1_year_1');
});

test('monthly planning index migration refuses unassigned or duplicate records before changing indexes', async () => {
  const unassigned = createCollection({ unassigned: 1 });
  await assert.rejects(
    migrateMonthlyPlanningIndex({ collection: () => unassigned }),
    /lack company ownership/,
  );
  assert.deepEqual(unassigned.operations, []);

  const duplicates = createCollection({ duplicates: [{ _id: { month: 1, year: 2026 }, count: 2 }] });
  await assert.rejects(
    migrateMonthlyPlanningIndex({ collection: () => duplicates }),
    /Duplicate company\/month\/year/,
  );
  assert.deepEqual(duplicates.operations, []);
});
