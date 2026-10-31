require('dotenv').config();
const mongoose = require('mongoose');

const MIGRATIONS = [
  {
    collection: 'orders',
    fields: ['orderNumber'],
    indexes: [{
      key: { companyId: 1, orderNumber: 1 },
      name: 'company_order_number_unique',
      options: {
        unique: true,
        partialFilterExpression: { orderNumber: { $type: 'string' } },
      },
    }],
  },
  {
    collection: 'sales',
    fields: ['orderNumber', 'invoiceNumber', 'manualSaleId'],
    indexes: [
      {
        key: { companyId: 1, orderNumber: 1 },
        name: 'company_sale_order_number_unique',
        options: {
          unique: true,
          partialFilterExpression: { orderNumber: { $type: 'string' } },
        },
      },
      {
        key: { companyId: 1, invoiceNumber: 1 },
        name: 'company_sale_invoice_number_unique',
        options: {
          unique: true,
          partialFilterExpression: { invoiceNumber: { $type: 'string' } },
        },
      },
      {
        key: { companyId: 1, manualSaleId: 1 },
        name: 'company_sale_manual_id_unique',
        options: {
          unique: true,
          partialFilterExpression: { manualSaleId: { $type: 'string' } },
        },
      },
      {
        key: { companyId: 1, order: 1 },
        name: 'company_sale_order_unique_partial',
        options: {
          unique: true,
          partialFilterExpression: { order: { $type: 'objectId' } },
        },
      },
    ],
  },
];

function sameKey(first, second) {
  const left = Object.entries(first || {});
  const right = Object.entries(second || {});
  return left.length === right.length
    && left.every(([field, direction], index) =>
      right[index]?.[0] === field && right[index]?.[1] === direction
    );
}

function samePartialFilter(first, second) {
  return JSON.stringify(first || {}) === JSON.stringify(second || {});
}

async function findTenantDuplicates(collection, fields) {
  const duplicates = [];
  for (const field of fields) {
    const matches = await collection.aggregate([
      { $match: { [field]: { $type: 'string', $ne: '' } } },
      {
        $group: {
          _id: { companyId: '$companyId', value: `$${field}` },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 },
    ]).toArray();
    if (matches.length) duplicates.push({ field, examples: matches });
  }
  if (fields.includes('order')) {
    const matches = await collection.aggregate([
      { $match: { order: { $type: 'objectId' } } },
      {
        $group: {
          _id: { companyId: '$companyId', value: '$order' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 },
    ]).toArray();
    if (matches.length) duplicates.push({ field: 'order', examples: matches });
  }
  return duplicates;
}

async function migrateTenantBusinessIndexes(db, { apply = false } = {}) {
  const plans = [];
  for (const migration of MIGRATIONS) {
    const collection = db.collection(migration.collection);
    const indexes = await collection.indexes();
    const duplicates = await findTenantDuplicates(
      collection,
      migration.collection === 'sales' && migration.fields.includes('manualSaleId')
        ? [...migration.fields, 'order']
        : migration.fields
    );
    if (duplicates.length) {
      throw new Error(
        `Cannot migrate ${migration.collection}: duplicate identifiers within a company exist (${duplicates.map(item => item.field).join(', ')}).`
      );
    }

    const create = [];
    for (const index of migration.indexes) {
      const current = indexes.find(candidate => candidate.name === index.name);
      if (current) {
        if (!sameKey(current.key, index.key)
          || current.unique !== true
          || !samePartialFilter(current.partialFilterExpression, index.options.partialFilterExpression)) {
          throw new Error(`Index ${migration.collection}.${index.name} exists with unexpected options.`);
        }
      } else {
        create.push(index);
      }
    }
    const remove = indexes.filter(index =>
      index.unique === true
      && !Object.keys(index.key).includes('companyId')
      && (
        (migration.collection === 'orders' && sameKey(index.key, { orderNumber: 1 }))
        || (migration.collection === 'sales' && (
          ['orderNumber', 'invoiceNumber', 'manualSaleId'].some(field => sameKey(index.key, { [field]: 1 }))
          || sameKey(index.key, { order: 1 })
        ))
      )
    );

    plans.push({
      collection: migration.collection,
      create,
      remove,
    });
  }

  if (apply) {
    for (const plan of plans) {
      const collection = db.collection(plan.collection);
      for (const index of plan.create) {
        await collection.createIndex(index.key, { ...index.options, name: index.name });
      }
      for (const index of plan.remove) {
        await collection.dropIndex(index.name);
      }
    }
  }

  return {
    mode: apply ? 'apply' : 'dry-run',
    collections: plans.map(plan => ({
      collection: plan.collection,
      indexesToCreate: plan.create.map(index => index.name),
      indexesToRemove: plan.remove.map(index => index.name),
    })),
  };
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required.');
    process.exitCode = 1;
  } else {
    mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
      .then(() => migrateTenantBusinessIndexes(mongoose.connection.db, { apply }))
      .then(result => console.log(JSON.stringify(result, null, 2)))
      .catch(error => {
        console.error('Tenant business index migration failed:', error.message);
        process.exitCode = 1;
      })
      .finally(async () => {
        await mongoose.disconnect().catch(error => {
          console.error('Failed to disconnect from MongoDB:', error.message);
          process.exitCode = 1;
        });
      });
  }
}

module.exports = { findTenantDuplicates, migrateTenantBusinessIndexes, sameKey, samePartialFilter };
