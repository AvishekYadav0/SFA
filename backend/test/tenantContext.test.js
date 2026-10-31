const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const {
  tenantFilter,
  tenantPlugin,
  withTenantContext,
} = require('../src/utils/tenantContext');

const modelSuffix = `${process.pid}${Date.now()}`;
const companyId = new mongoose.Types.ObjectId();
const otherCompanyId = new mongoose.Types.ObjectId();
const context = { companyId: String(companyId), legacy: false };

function createScopedModel(name) {
  const schema = new mongoose.Schema({ label: String }, { tenantScoped: true });
  tenantPlugin(schema);
  return mongoose.model(`${name}${modelSuffix}`, schema);
}

function runPre(schema, hook, target, tenantContext = context) {
  return withTenantContext(tenantContext, () => new Promise((resolve, reject) => {
    schema.s.hooks.execPre(hook, target, error => error ? reject(error) : resolve());
  }));
}

test('tenant filters only match the active company, including legacy records when enabled', () => {
  assert.deepEqual(tenantFilter(context), { companyId });
  const legacyFilter = tenantFilter({ ...context, legacy: true });
  assert.deepEqual(legacyFilter.$or, [
    { companyId },
    { companyId: { $exists: false } },
    { companyId: null },
  ]);
});

test('tenant query middleware scopes reads and prevents companyId changes through update operators', async () => {
  const Model = createScopedModel('TenantQuery');
  const query = Model.updateOne(
    { label: 'record' },
    { $set: { label: 'updated', companyId: otherCompanyId, tenantId: 'other-tenant' }, $unset: { companyId: 1 } },
  );
  await runPre(Model.schema, 'updateOne', query);

  assert.deepEqual(query.getQuery().$and[1], { companyId });
  assert.equal(query.getUpdate().$set.companyId.toString(), companyId.toString());
  assert.equal(query.getUpdate().$set.tenantId, undefined);
  assert.equal(query.getUpdate().$unset.companyId, undefined);
});

test('tenant middleware constrains aggregation roots, nested lookups, and update pipelines', async () => {
  const Root = createScopedModel('TenantRoot');
  const Joined = createScopedModel('TenantJoined');
  const Nested = createScopedModel('TenantNested');

  const aggregate = Root.aggregate([{
    $lookup: {
      from: Joined.collection.collectionName,
      pipeline: [{
        $lookup: {
          from: Nested.collection.collectionName,
          pipeline: [{ $project: { label: 1 } }],
          as: 'nested',
        },
      }],
      as: 'joined',
    },
  }]);
  await runPre(Root.schema, 'aggregate', aggregate);

  assert.deepEqual(aggregate.pipeline()[0], { $match: { companyId } });
  const lookup = aggregate.pipeline()[1].$lookup;
  assert.deepEqual(lookup.pipeline[0], { $match: { companyId } });
  assert.deepEqual(lookup.pipeline[1].$lookup.pipeline[0], { $match: { companyId } });

  const update = Root.updateOne({ label: 'record' }, [
    { $set: { companyId: otherCompanyId, label: 'changed' } },
  ]);
  await runPre(Root.schema, 'updateOne', update);
  assert.deepEqual(update.getUpdate().at(-1), { $set: { companyId } });
});
