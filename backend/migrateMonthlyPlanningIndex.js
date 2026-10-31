require('dotenv').config();
const mongoose = require('mongoose');

const COLLECTION = 'monthlyplannings';
const OLD_INDEX_KEYS = { month: 1, year: 1 };
const NEW_INDEX_KEYS = { companyId: 1, month: 1, year: 1 };
const NEW_INDEX_NAME = 'companyId_1_month_1_year_1';

async function migrateMonthlyPlanningIndex(db) {
  const collection = db.collection(COLLECTION);
  const indexes = await collection.indexes();
  const oldIndex = indexes.find(index =>
    JSON.stringify(index.key) === JSON.stringify(OLD_INDEX_KEYS) && index.unique === true);
  const newIndex = indexes.find(index =>
    JSON.stringify(index.key) === JSON.stringify(NEW_INDEX_KEYS) && index.unique === true);

  const unassignedCount = await collection.countDocuments({
    $or: [{ companyId: { $exists: false } }, { companyId: null }],
  });
  if (unassignedCount) {
    throw new Error(`${unassignedCount} monthly planning records lack company ownership; refusing to alter indexes.`);
  }

  const duplicateKeys = await collection.aggregate([
    { $group: { _id: { companyId: '$companyId', month: '$month', year: '$year' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 5 },
  ]).toArray();
  if (duplicateKeys.length) {
    throw new Error('Duplicate company/month/year planning records exist; refusing to create the unique tenant index.');
  }

  if (!newIndex) {
    await collection.createIndex(NEW_INDEX_KEYS, { unique: true, name: NEW_INDEX_NAME });
  }
  if (oldIndex) {
    await collection.dropIndex(oldIndex.name);
  }

  return {
    tenantUniqueIndex: NEW_INDEX_NAME,
    removedGlobalUniqueIndex: oldIndex?.name || null,
    monthlyPlanningRecords: await collection.countDocuments(),
  };
}

if (require.main === module) {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required.');
    process.exitCode = 1;
  } else {
    mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
      .then(() => migrateMonthlyPlanningIndex(mongoose.connection.db))
      .then(result => console.log(JSON.stringify({ completed: true, ...result }, null, 2)))
      .catch(error => {
        console.error('Monthly planning index migration failed:', error.message);
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

module.exports = { migrateMonthlyPlanningIndex };
