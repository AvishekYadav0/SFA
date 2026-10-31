const assert = require('node:assert/strict');
const test = require('node:test');
const { migrateTenantBusinessIndexes } = require('../migrateTenantBusinessIndexes');

function createDb({ duplicates = [] } = {}) {
  const operations = [];
  const collections = new Map();
  const db = {
    collection(name) {
      if (!collections.has(name)) {
        collections.set(name, {
          async indexes() {
            return [
              { name: '_id_', key: { _id: 1 } },
              ...(name === 'sales'
                ? [
                    { name: 'orderNumber_1', key: { orderNumber: 1 }, unique: true },
                    { name: 'invoiceNumber_1', key: { invoiceNumber: 1 }, unique: true },
                    { name: 'manualSaleId_1', key: { manualSaleId: 1 }, unique: true },
                    {
                      name: 'sale_order_unique_partial',
                      key: { order: 1 },
                      unique: true,
                      partialFilterExpression: { order: { $type: 'objectId' } },
                    },
                  ]
                : [{ name: 'orderNumber_1', key: { orderNumber: 1 }, unique: true }]),
            ];
          },
          aggregate(pipeline) {
            const field = Object.keys(pipeline[0].$match)[0];
            const duplicate = duplicates.includes(`${name}.${field}`);
            return { toArray: async () => (duplicate ? [{ _id: { value: 'ORD-1' }, count: 2 }] : []) };
          },
          async createIndex(key, options) {
            operations.push({ type: 'createIndex', collection: name, key, options });
          },
          async dropIndex(indexName) {
            operations.push({ type: 'dropIndex', collection: name, indexName });
          },
        });
      }
      return collections.get(name);
    },
  };
  return { db, operations };
}

test('tenant index migration creates company-scoped indexes before dropping global unique indexes', async () => {
  const { db, operations } = createDb();
  const result = await migrateTenantBusinessIndexes(db, { apply: true });

  assert.equal(result.mode, 'apply');
  for (const collectionName of ['orders', 'sales']) {
    const collectionOps = operations.filter(operation => operation.collection === collectionName);
    const firstDrop = collectionOps.findIndex(operation => operation.type === 'dropIndex');
    const lastCreate = collectionOps.map(operation => operation.type).lastIndexOf('createIndex');
    assert.ok(firstDrop > lastCreate, `${collectionName} drops global indexes only after creating tenant indexes`);
  }
  assert.ok(operations.some(operation =>
    operation.collection === 'sales'
    && operation.type === 'createIndex'
    && operation.key.companyId === 1
    && operation.key.orderNumber === 1
  ));
});

test('tenant index migration refuses same-company duplicate identifiers without modifying indexes', async () => {
  const { db, operations } = createDb({ duplicates: ['sales.orderNumber'] });
  await assert.rejects(
    migrateTenantBusinessIndexes(db, { apply: true }),
    /duplicate identifiers within a company/
  );
  assert.deepEqual(operations, []);
});
