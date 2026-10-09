const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { createWriteStream } = require('fs');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const Backup = require('../src/models/Backup');
const BackupLog = require('../src/models/BackupLog');
const {
  cleanupExpiredBackups,
  createBackup,
  getBackupDirectory,
  isSafeBackupFilename,
  redactSensitiveFields,
  readableRecord,
  writeBackupPdf,
} = require('../src/services/backupService');

assert.strictEqual(
  isSafeBackupFilename('sfa-backup-2026-10-08-02-00-00-a1b2c3d4.json.gz'),
  true,
  'a generated backup filename should be accepted'
);
assert.strictEqual(isSafeBackupFilename('../../etc/passwd'), false, 'path traversal should be rejected');
assert.strictEqual(isSafeBackupFilename('backup.zip'), false, 'arbitrary filenames should be rejected');

const sanitized = redactSensitiveFields({
  name: 'Admin',
  password: 'hash',
  nested: { accessToken: 'secret', keep: 'value' },
  devices: [{ deviceToken: 'push-secret', id: 1 }],
});
assert.deepStrictEqual(sanitized, {
  name: 'Admin',
  nested: { keep: 'value' },
  devices: [{ id: 1 }],
}, 'credential fields should be removed recursively');
const readableOrder = readableRecord('orders', {
  _id: '6aa133d16e935af5ac7468eb',
  date: new Date('2026-09-09T00:00:00.000Z'),
  se: '6a8bdab42d718282f42eee54',
  dealer: '6a8556bce80c7d0506356faf',
  province: 'Sudurpashchim Province',
  internalDebug: 'should not appear',
  items: [
    { productName: 'Swift White 180ML', ml: '180 ML', quantity: 200, rate: 2403.57, _id: '6aa133d16e935af5ac7468ec' },
  ],
}, {
  users: new Map([['6a8bdab42d718282f42eee54', 'Sales Executive Name']]),
  dealers: new Map([['6a8556bce80c7d0506356faf', 'Sukhad Dealer']]),
  products: new Map(),
});
assert.strictEqual(readableOrder.title, null);
assert(readableOrder.details.some(detail => detail.value === 'Sales Executive Name'));
assert(readableOrder.details.some(detail => detail.value === 'Sukhad Dealer'));
assert(readableOrder.details.some(detail => detail.value.includes('Swift White 180ML')));
assert.strictEqual(readableOrder.details.some(detail => detail.value.includes('6aa133d16e935af5ac7468eb')), false);
assert.strictEqual(readableOrder.details.some(detail => detail.label === 'Internal Debug'), false);
const readableDailyVisit = readableRecord('dailyvisits', {
  date: '2026-10-09',
  staff: '6a8bdab42d718282f42eee54',
  dealer: '6a8556bce80c7d0506356faf',
  visitStatus: 'visited',
  notes: 'Discussed next order',
  assignedBy: '6a73472c9daf390ac6adf549',
}, {
  users: new Map([
    ['6a8bdab42d718282f42eee54', 'Sales Executive Name'],
    ['6a73472c9daf390ac6adf549', 'Area Manager Name'],
  ]),
  dealers: new Map([['6a8556bce80c7d0506356faf', 'Sukhad Dealer']]),
  products: new Map(),
});
assert(readableDailyVisit.details.some(detail => detail.value === 'Sales Executive Name'));
assert(readableDailyVisit.details.some(detail => detail.value === 'Sukhad Dealer'));
assert(readableDailyVisit.details.some(detail => detail.value === 'Area Manager Name'));

const originalDirectory = process.env.BACKUP_DIRECTORY;
process.env.BACKUP_DIRECTORY = '../frontend/public/backups';
assert.throws(
  () => getBackupDirectory(),
  /publicly served directory/,
  'backup storage must not be configured inside the public frontend'
);
if (originalDirectory === undefined) delete process.env.BACKUP_DIRECTORY;
else process.env.BACKUP_DIRECTORY = originalDirectory;

const originalEnabled = process.env.BACKUP_ENABLED;
const originalRetentionDays = process.env.BACKUP_RETENTION_DAYS;
const originalDb = mongoose.connection.db;
const originalCreate = Backup.create;
const originalFind = Backup.find;
const originalDeleteOne = Backup.deleteOne;
const originalLogCreate = BackupLog.create;

const runBackupTests = async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sfa-backup-test-'));
  const records = [];
  const deletedRecords = [];
  const logEntries = [];
  process.env.BACKUP_DIRECTORY = directory;
  process.env.BACKUP_ENABLED = 'true';
  process.env.BACKUP_RETENTION_DAYS = '30';

  Backup.create = async values => {
    const record = {
      ...values,
      _id: `backup-${records.length}`,
      save: async () => {},
    };
    records.push(record);
    return record;
  };
  Backup.find = () => ({
    sort: () => ({ lean: async () => [] }),
  });
  Backup.deleteOne = async query => { deletedRecords.push(query._id); };
  BackupLog.create = async value => { logEntries.push(value); };

  const makeDatabase = (documentsByCollection, failingCollection = null) => ({
    listCollections: () => ({
      toArray: async () => Object.keys(documentsByCollection).map(name => ({ name })),
    }),
    collection: name => ({
      find: () => ({
        batchSize() { return this; },
        async *[Symbol.asyncIterator]() {
          if (name === failingCollection) throw new Error('synthetic cursor failure');
          for (const document of documentsByCollection[name]) yield document;
        },
        close: async () => {},
      }),
    }),
  });

  try {
    mongoose.connection.db = makeDatabase({
      users: [{ email: 'admin@example.test', password: 'hash', deviceToken: 'push-token', name: 'प्रशासक' }],
      orders: [{ orderNo: 'SFA-1', total: 10 }],
    });
    const backup = await createBackup({ type: 'manual' });
    assert.strictEqual(backup.status, 'SUCCESS');
    assert.strictEqual(backup.size > 0, true);

    const files = await fs.readdir(directory);
    assert.strictEqual(files.length, 1, 'a successful run should produce one completed backup file');
    assert.match(files[0], /^sfa-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-[a-f0-9]{8}\.json\.gz$/);
    const filePath = path.join(directory, files[0]);
    const fileStats = await fs.lstat(filePath);
    assert.strictEqual(fileStats.mode & 0o777, 0o600, 'backup files must be owner-readable only');

    const exported = JSON.parse(zlib.gunzipSync(await fs.readFile(filePath)).toString('utf8'));
    assert.deepStrictEqual(Object.keys(exported.collections).sort(), ['orders', 'users']);
    assert.strictEqual(exported.collections.users[0].password, 'hash');
    assert.strictEqual(exported.collections.users[0].deviceToken, 'push-token');
    assert.strictEqual(exported.collections.orders[0].orderNo, 'SFA-1');

    const pdfPath = path.join(directory, 'readable-backup.pdf');
    const pdf = new PDFDocument();
    const pdfOutput = createWriteStream(pdfPath);
    const pdfWritten = new Promise((resolve, reject) => {
      pdfOutput.once('finish', resolve);
      pdfOutput.once('error', reject);
      pdf.once('error', reject);
    });
    pdf.pipe(pdfOutput);
    await writeBackupPdf(filePath, pdf);
    pdf.end();
    await pdfWritten;
    const pdfBytes = await fs.readFile(pdfPath);
    assert.strictEqual(pdfBytes.subarray(0, 5).toString(), '%PDF-', 'Admin export should be a valid PDF file');
    const pageCount = Number(pdfBytes.toString('latin1').match(/\/Count (\d+)/)?.[1] || 0);
    assert(pageCount >= 3, `PDF should include data pages and a summary (found ${pageCount} pages)`);
    assert(pdfBytes.subarray(-1024).includes(Buffer.from('%%EOF')), 'PDF should be complete');

    mongoose.connection.db = makeDatabase({ orders: [{ orderNo: 'SFA-2' }] }, 'orders');
    await assert.rejects(() => createBackup({ type: 'manual' }), /synthetic cursor failure/);
    assert.strictEqual(records[1].status, 'FAILED', 'failed jobs must retain a failed metadata status');
    assert.strictEqual(
      (await fs.readdir(directory)).filter(filename => filename.endsWith('.json.gz')).length,
      1,
      'failed runs must not leave partial backups'
    );

    const oldFilename = 'sfa-backup-2020-01-01-00-00-00-a1b2c3d4.json.gz';
    const newestFilename = 'sfa-backup-2020-01-02-00-00-00-b1b2c3d4.json.gz';
    await fs.writeFile(path.join(directory, oldFilename), 'old');
    await fs.writeFile(path.join(directory, newestFilename), 'new');
    Backup.find = () => ({
      sort: () => ({
        lean: async () => [
          { _id: 'newest', filename: newestFilename, createdAt: new Date('2020-01-02T00:00:00Z') },
          { _id: 'older', filename: oldFilename, createdAt: new Date('2020-01-01T00:00:00Z') },
        ],
      }),
    });
    await cleanupExpiredBackups();
    await assert.rejects(() => fs.access(path.join(directory, oldFilename)), { code: 'ENOENT' });
    await fs.access(path.join(directory, newestFilename));
    assert.deepStrictEqual(deletedRecords, ['older'], 'retention must preserve the newest backup');
    assert(logEntries.some(entry => entry.status === 'FAILED'), 'failed backup actions should be logged');
    console.log('backup service tests passed');
  } finally {
    mongoose.connection.db = originalDb;
    Backup.create = originalCreate;
    Backup.find = originalFind;
    Backup.deleteOne = originalDeleteOne;
    BackupLog.create = originalLogCreate;
    if (originalDirectory === undefined) delete process.env.BACKUP_DIRECTORY;
    else process.env.BACKUP_DIRECTORY = originalDirectory;
    if (originalEnabled === undefined) delete process.env.BACKUP_ENABLED;
    else process.env.BACKUP_ENABLED = originalEnabled;
    if (originalRetentionDays === undefined) delete process.env.BACKUP_RETENTION_DAYS;
    else process.env.BACKUP_RETENTION_DAYS = originalRetentionDays;
    await fs.rm(directory, { recursive: true, force: true });
  }
};

runBackupTests().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
