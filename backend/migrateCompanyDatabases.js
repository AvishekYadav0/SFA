require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Writable } = require('stream');
const { pipeline } = require('stream/promises');
const { createReadStream } = require('fs');
const zlib = require('zlib');
const { tenantPlugin } = require('./src/utils/tenantContext');
const {
  connectionForCompany,
  databaseNameForCompany,
  initializeTenantDatabase,
} = require('./src/utils/tenantModels');

mongoose.plugin(tenantPlugin);
for (const filename of fs.readdirSync(path.join(__dirname, 'src/models'))) {
  if (filename.endsWith('.js') && filename !== 'Company.js') {
    require(path.join(__dirname, 'src/models', filename));
  }
}

const Company = require('./src/models/Company');
const { createBackup, getBackupFilePath } = require('./src/services/backupService');

function sourceFilter(company) {
  const companyId = new mongoose.Types.ObjectId(company._id);
  return company.isLegacy
    ? { $or: [{ companyId }, { companyId: null }, { companyId: { $exists: false } }] }
    : { companyId };
}

async function verifyBackup(backup) {
  const backupPath = getBackupFilePath(backup);
  const discard = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  await pipeline(createReadStream(backupPath), zlib.createGunzip(), discard);
  return backupPath;
}

async function copyCompanyData(company, targetConnection, sourceDb, models) {
  const summary = [];
  const filter = sourceFilter(company);

  for (const model of models) {
    const collectionName = model.collection.collectionName;
    const sourceCollection = sourceDb.collection(collectionName);
    const targetModel = targetConnection.models[model.modelName];
    const documents = await sourceCollection.find(filter).toArray();
    if (documents.length) {
      await targetModel.bulkWrite(documents.map(document => ({
        updateOne: {
          filter: { _id: document._id },
          update: { $setOnInsert: document },
          upsert: true,
        },
      })), { ordered: true });
    }

    for (let offset = 0; offset < documents.length; offset += 500) {
      const ids = documents.slice(offset, offset + 500).map(document => document._id);
      const copiedCount = await targetModel.countDocuments({
        $and: [{ _id: { $in: ids } }, filter],
      });
      if (copiedCount !== ids.length) {
        throw new Error(`Migration verification failed for ${company.name}.${collectionName}.`);
      }
    }
    if (documents.length) summary.push({ collection: collectionName, count: documents.length });
  }
  return summary;
}

async function migrateCompanyDatabases({ apply = process.argv.includes('--apply') } = {}) {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be configured.');
  await mongoose.connect(process.env.MONGO_URI);
  const sourceDb = mongoose.connection.db;
  const companies = await Company.find().sort({ createdAt: 1 });
  if (!companies.length) throw new Error('No registered companies were found.');

  const models = mongoose.modelNames()
    .map(name => mongoose.model(name))
    .filter(model => model.schema.options.tenantScoped === true);
  if (!apply) {
    const plan = [];
    for (const company of companies) {
      const collections = [];
      for (const model of models) {
        const count = await sourceDb.collection(model.collection.collectionName)
          .countDocuments(sourceFilter(company));
        if (count) collections.push({ collection: model.collection.collectionName, count });
      }
      plan.push({
        company: company.name,
        databaseName: company.databaseName || databaseNameForCompany(company.name, company.tenantId),
        collections,
      });
    }
    console.log(JSON.stringify({ migration: 'dry-run', companies: plan }, null, 2));
    return;
  }

  console.warn('Stop the application server before applying this migration.');
  const backup = await createBackup({ type: 'manual', cleanupRetention: false });
  if (backup.status !== 'SUCCESS' || !backup.size) {
    throw new Error('A successful non-empty source database backup is required before migration.');
  }
  const verifiedBackupPath = await verifyBackup(backup);
  console.log(JSON.stringify({
    backup: { filename: backup.filename, path: verifiedBackupPath, bytes: backup.size, verified: true },
    companyCount: companies.length,
    migration: 'started',
  }, null, 2));

  const results = [];

  for (const company of companies) {
    const databaseName = company.databaseName || databaseNameForCompany(company.name, company.tenantId);
    const migrationCompany = { ...company.toObject(), databaseName };
    const targetConnection = connectionForCompany(migrationCompany);
    await initializeTenantDatabase(targetConnection);
    const copied = await copyCompanyData(migrationCompany, targetConnection, sourceDb, models);
    results.push({ company: company.name, databaseName, collections: copied });
  }

  for (let index = 0; index < companies.length; index += 1) {
    companies[index].databaseName = results[index].databaseName;
    await companies[index].save();
  }

  console.log(JSON.stringify({ migration: 'completed', companies: results }, null, 2));
}

if (require.main === module) {
  migrateCompanyDatabases()
    .catch(error => {
      console.error('Company database migration failed:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(error => {
        console.error('Failed to disconnect from MongoDB:', error.message);
        process.exitCode = 1;
      });
    });
}

module.exports = { copyCompanyData, migrateCompanyDatabases, sourceFilter, verifyBackup };
