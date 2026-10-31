const mongoose = require('mongoose');
const { getTenantContext } = require('./tenantContext');

const DATABASE_NAME_PATTERN = /^sfa_[a-z0-9_]{1,55}$/;

function databaseNameForCompany(name, tenantId) {
  const slug = String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'company';
  const suffix = String(tenantId).replace(/[^a-z0-9]/gi, '').slice(-8).toLowerCase();
  return `sfa_${slug}_${suffix}`;
}

function connectionForCompany(company) {
  const databaseName = company?.databaseName;
  if (databaseName == null || databaseName === '') {
    return mongoose.connection;
  }
  if (typeof databaseName !== 'string' || !DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error('Company database is not provisioned. Contact your platform administrator.');
  }
  return mongoose.connection.useDb(databaseName, { useCache: true });
}

function resolveTenantModel(baseModel) {
  const context = getTenantContext();
  if (!context?.connection || baseModel.modelName === 'Company') return baseModel;
  const connection = context.connection;
  return connection.models[baseModel.modelName]
    || connection.model(baseModel.modelName, baseModel.schema, baseModel.collection.collectionName);
}

function databaseModel(baseModel) {
  return new Proxy(baseModel, {
    get(target, property) {
      const model = resolveTenantModel(target);
      const value = Reflect.get(model, property, model);
      return typeof value === 'function' ? value.bind(model) : value;
    },
    construct(target, args) {
      const model = resolveTenantModel(target);
      return Reflect.construct(model, args);
    },
  });
}

async function initializeTenantDatabase(connection) {
  const models = mongoose.modelNames()
    .map(name => mongoose.model(name))
    .filter(model => model.modelName !== 'Company');
  for (const baseModel of models) {
    const model = connection.models[baseModel.modelName]
      || connection.model(baseModel.modelName, baseModel.schema, baseModel.collection.collectionName);
    await model.init();
  }
  return connection;
}

function tenantContextFor(company) {
  return {
    companyId: String(company._id),
    legacy: company.isLegacy === true,
    connection: connectionForCompany(company),
  };
}

module.exports = {
  DATABASE_NAME_PATTERN,
  connectionForCompany,
  databaseModel,
  databaseNameForCompany,
  initializeTenantDatabase,
  tenantContextFor,
};
