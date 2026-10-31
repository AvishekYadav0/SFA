require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createReadStream } = require('fs');
const { createGunzip } = require('zlib');
const mongoose = require('mongoose');
const { tenantPlugin } = require('./src/utils/tenantContext');

const COMPANY_NAME = 'Mega Marketing';
const COMPANY_EMAIL = 'megamarketing@gmail.com';
const EXCLUDED_COLLECTIONS = new Set(['backups', 'backuplogs', 'backupruns']);
const UNASSIGNED_FILTER = {
  $or: [{ companyId: { $exists: false } }, { companyId: null }],
};

mongoose.plugin(tenantPlugin);

function loadModels() {
  const modelsPath = path.resolve(__dirname, 'src/models');
  for (const file of fs.readdirSync(modelsPath).filter(name => name.endsWith('.js'))) {
    require(path.join(modelsPath, file));
  }
}

function getScopedModels() {
  return mongoose.modelNames()
    .map(name => mongoose.model(name))
    .filter(model => model.schema.options.tenantScoped === true
      && !EXCLUDED_COLLECTIONS.has(model.collection.collectionName));
}

async function getMigrationPlan(db, scopedModels, company, user) {
  const collections = [];
  for (const model of scopedModels) {
    const count = await db.collection(model.collection.collectionName)
      .countDocuments(UNASSIGNED_FILTER, { maxTimeMS: 10000 });
    if (count) collections.push({ name: model.collection.collectionName, count });
  }

  const companyAdminCount = company
    ? await db.collection('users').countDocuments({ role: 'admin', companyId: company._id })
    : 0;
  const unassignedAdminCount = await db.collection('users').countDocuments({
    role: 'admin',
    ...UNASSIGNED_FILTER,
  });
  const adminWillBeCreated = !user;

  return {
    company: company
      ? { id: String(company._id), name: company.name, status: company.status }
      : { id: null, name: COMPANY_NAME, status: 'will be created' },
    admin: user
      ? { id: String(user._id), role: user.role, status: user.status, companyId: user.companyId ? String(user.companyId) : null }
      : { id: null, email: COMPANY_EMAIL, status: 'will be created' },
    unassignedAdminCount,
    companyAdminCount,
    adminCountAfterMigration: companyAdminCount + unassignedAdminCount + (adminWillBeCreated ? 1 : 0),
    recordsToAssign: collections.reduce((sum, item) => sum + item.count, 0),
    collections,
  };
}

function validateCurrentMapping(company, user) {
  if (company && company.name !== COMPANY_NAME) {
    throw new Error(`The company email ${COMPANY_EMAIL} is already registered to another company name.`);
  }
  if (company && company.status !== 'active') {
    throw new Error('The existing Mega Marketing company is not active; no records were changed.');
  }
  if (company?.adminUser && user && String(company.adminUser) !== String(user._id)) {
    throw new Error('Mega Marketing references a different administrator; refusing to replace the mapping.');
  }
  if (user && user.role !== 'admin') {
    throw new Error('The Mega Marketing email belongs to a non-admin account; refusing to change it.');
  }
  if (user && user.status !== 'active') {
    throw new Error('The Mega Marketing admin account is inactive; refusing to reactivate it automatically.');
  }
  if (user?.companyId && company && String(user.companyId) !== String(company._id)) {
    throw new Error('The Mega Marketing email is already assigned to another company; refusing to move it.');
  }
  if (user?.companyId && !company) {
    throw new Error('The Mega Marketing admin is assigned to an existing company; refusing to reassign it.');
  }
  if (user?.tenantId && company && user.tenantId !== company.tenantId) {
    throw new Error('The Mega Marketing admin has a conflicting tenant ID; refusing to overwrite it.');
  }
}

async function verifyBackup(backup, getBackupFilePath) {
  if (!backup || backup.status !== 'SUCCESS' || !backup.size) {
    throw new Error('A successful full backup is required before migration.');
  }
  const filename = getBackupFilePath(backup);
  const stat = await fs.promises.stat(filename);
  if (!stat.isFile() || stat.size !== backup.size || stat.size === 0) {
    throw new Error('The backup file is missing or its size does not match the recorded backup.');
  }

  let uncompressedBytes = 0;
  for await (const chunk of createReadStream(filename).pipe(createGunzip())) {
    uncompressedBytes += chunk.length;
  }
  if (uncompressedBytes === 0) throw new Error('The backup archive contains no readable data.');
  return { filename: path.basename(filename), size: stat.size, verifiedBytes: uncompressedBytes };
}

async function migrate({ dryRun = true } = {}) {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI);
  loadModels();

  const db = mongoose.connection.db;
  const Company = mongoose.model('Company');
  const User = mongoose.model('User');
  const scopedModels = getScopedModels();
  let company = await Company.findOne({ email: COMPANY_EMAIL });
  let user = await User.findOne({ email: COMPANY_EMAIL }).select('role status companyId tenantId');
  validateCurrentMapping(company, user);
  const plan = await getMigrationPlan(db, scopedModels, company, user);

  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'apply', plan }, null, 2));
  if (dryRun) return;

  if (!user && (typeof process.env.MEGA_ADMIN_PASSWORD !== 'string'
    || process.env.MEGA_ADMIN_PASSWORD.length < 8)) {
    throw new Error('Set MEGA_ADMIN_PASSWORD to at least 8 characters before creating the Mega Admin account.');
  }
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required for company verification and login.');

  const { createBackup, getBackupFilePath } = require('./src/services/backupService');
  const backup = await createBackup({ type: 'manual', cleanupRetention: false });
  const verifiedBackup = await verifyBackup(backup, getBackupFilePath);
  console.log(JSON.stringify({ backup: verifiedBackup }));

  const tenantId = company?.tenantId || crypto.randomUUID();
  if (!company) {
    company = await Company.create({
      name: COMPANY_NAME,
      email: COMPANY_EMAIL,
      tenantId,
      adminCount: 0,
      isLegacy: true,
      status: 'active',
    });
  } else {
    company.isLegacy = true;
    await company.save();
  }

  if (!user) {
    user = await User.create({
      name: `${COMPANY_NAME} Admin`,
      email: COMPANY_EMAIL,
      password: process.env.MEGA_ADMIN_PASSWORD,
      role: 'admin',
      companyId: company._id,
      tenantId: company.tenantId,
      status: 'active',
    });
  } else {
    user.companyId = company._id;
    user.tenantId = company.tenantId;
    await user.save({ validateBeforeSave: false });
  }
  company.adminUser = user._id;
  await company.save();

  const assigned = [];
  for (const model of scopedModels) {
    const update = { $set: { companyId: company._id } };
    if (model.modelName === 'User') update.$set.tenantId = company.tenantId;
    const result = await db.collection(model.collection.collectionName)
      .updateMany(UNASSIGNED_FILTER, update);
    if (result.modifiedCount) {
      assigned.push({ collection: model.collection.collectionName, count: result.modifiedCount });
    }
  }

  const adminCount = await User.countDocuments({ role: 'admin', companyId: company._id });
  await Company.updateOne(
    { _id: company._id },
    { $set: { adminCount, isLegacy: false, adminUser: user._id } },
  );
  console.log(JSON.stringify({
    completed: true,
    companyId: String(company._id),
    assignedRecords: assigned.reduce((sum, item) => sum + item.count, 0),
    assigned,
    adminCount,
    note: adminCount > 8
      ? 'Existing Admin accounts were preserved. The application will block additional Admin creation at the configured limit.'
      : undefined,
  }, null, 2));
}

if (require.main === module) {
  const dryRun = !process.argv.includes('--apply');
  migrate({ dryRun })
    .catch(error => {
      console.error('Mega Marketing migration failed:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(error => {
        console.error('Failed to disconnect from MongoDB:', error.message);
        process.exitCode = 1;
      });
    });
}

module.exports = { getMigrationPlan, migrate, validateCurrentMapping, verifyBackup };
