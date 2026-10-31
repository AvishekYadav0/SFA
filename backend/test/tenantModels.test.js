const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const {
  connectionForCompany,
  databaseModel,
  databaseNameForCompany,
} = require('../src/utils/tenantModels');
const { withTenantContext } = require('../src/utils/tenantContext');

test('company database names are readable, normalized, and tenant-specific', () => {
  const first = databaseNameForCompany('Mega Marketing', 'tenant-00000001');
  const second = databaseNameForCompany('Mega Marketing', 'tenant-00000002');
  assert.equal(first, 'sfa_mega_marketing_00000001');
  assert.notEqual(first, second);
  assert.match(first, /^sfa_[a-z0-9_]+$/);
});

test('companies without a database name retain the shared database connection', () => {
  assert.equal(connectionForCompany({ _id: 'company-id' }), mongoose.connection);
  assert.equal(connectionForCompany({ _id: 'company-id', databaseName: '' }), mongoose.connection);
});

test('database model delegates model operations and construction to the active tenant connection', () => {
  function BaseModel(value) {
    this.value = value;
  }
  BaseModel.modelName = 'ProxyTestModel';
  BaseModel.schema = {};
  BaseModel.collection = { collectionName: 'proxytestmodels' };
  BaseModel.find = () => 'base';

  function TenantModel(value) {
    this.value = `tenant:${value}`;
  }
  TenantModel.find = () => 'tenant';

  const model = databaseModel(BaseModel);
  assert.equal(model.find(), 'base');

  withTenantContext({ connection: { models: { ProxyTestModel: TenantModel } } }, () => {
    assert.equal(model.find(), 'tenant');
    assert.equal(new model('document').value, 'tenant:document');
  });
});
