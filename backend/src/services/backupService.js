const crypto = require('crypto');
const fs = require('fs/promises');
const { createReadStream, createWriteStream } = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const zlib = require('zlib');
const cron = require('node-cron');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const PDFDocument = require('pdfkit');
const { parser } = require('stream-json');
const Assembler = require('stream-json/Assembler');
const Backup = require('../models/Backup');
const BackupRun = require('../models/BackupRun');
const BackupLog = require('../models/BackupLog');
const Notification = require('../models/Notification');
const User = require('../models/User');

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const LATIN_FONT = require.resolve('@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-latin-400-normal.woff');
const DEVANAGARI_FONT = require.resolve('@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff');
const BACKUP_FILENAME_PATTERN = /^sfa-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-[a-f0-9]{8}\.json\.gz$/;
const SENSITIVE_FIELD_PATTERN = /(password|passwd|pwd|secret|token|api[_-]?key|credential|authorization)/i;
let scheduler = null;
let schedulerError = null;

const isEnabled = () => (process.env.BACKUP_ENABLED || 'true').toLowerCase() === 'true';

const getRetentionDays = () => {
  const value = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('BACKUP_RETENTION_DAYS must be a positive integer.');
  }
  return value;
};

const isWithin = (directory, parent) => directory === parent || directory.startsWith(`${parent}${path.sep}`);

const getBackupDirectory = () => {
  const configuredDirectory = process.env.BACKUP_DIRECTORY || './secure-backups';
  const directory = path.isAbsolute(configuredDirectory)
    ? path.resolve(configuredDirectory)
    : path.resolve(BACKEND_ROOT, configuredDirectory);
  const frontendRoot = path.resolve(BACKEND_ROOT, '..', 'frontend');
  const publicDirectories = [
    path.join(BACKEND_ROOT, 'public'),
    path.join(frontendRoot, 'public'),
    path.join(frontendRoot, 'dist'),
    process.env.FRONTEND_DIST && path.resolve(process.env.FRONTEND_DIST),
  ].filter(Boolean);

  if (publicDirectories.some(publicDirectory => isWithin(directory, publicDirectory))) {
    throw new Error('BACKUP_DIRECTORY must not be inside a publicly served directory.');
  }

  return directory;
};

const isSafeBackupFilename = filename =>
  typeof filename === 'string' && BACKUP_FILENAME_PATTERN.test(filename);

const safeErrorMessage = error => {
  let message = error?.message || 'Unknown backup error';
  for (const secret of [process.env.MONGO_URI, process.env.JWT_SECRET].filter(Boolean)) {
    message = message.split(secret).join('[REDACTED]');
  }
  message = message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[REDACTED_MONGODB_URI]');
  return message.slice(0, 1000);
};

const redactSensitiveFields = value => {
  if (Array.isArray(value)) return value.map(redactSensitiveFields);
  if (!value || typeof value !== 'object') return value;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_FIELD_PATTERN.test(key))
      .map(([key, nestedValue]) => [key, redactSensitiveFields(nestedValue)])
  );
};

const formatTimestamp = date => {
  const pad = value => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('-');
};

const getScheduledDate = date => {
  const timeZone = process.env.BACKUP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const createFilename = date =>
  `sfa-backup-${formatTimestamp(date)}-${crypto.randomBytes(4).toString('hex')}.json.gz`;

const resolveBackupFile = filename => {
  if (!isSafeBackupFilename(filename) || path.basename(filename) !== filename) {
    throw new Error('Invalid backup reference.');
  }
  return path.join(getBackupDirectory(), filename);
};

const serializeDatabase = async function* () {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected.');

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  yield `{"format":"sfa-mongodb-ejson-v1","createdAt":${JSON.stringify(new Date().toISOString())},"collections":{`;

  let firstCollection = true;
  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;

    if (!firstCollection) yield ',';
    firstCollection = false;
    yield `${JSON.stringify(name)}:[`;

    const cursor = db.collection(name).find({}).batchSize(500);
    let firstDocument = true;
    try {
      for await (const document of cursor) {
        if (!firstDocument) yield ',';
        firstDocument = false;
        yield EJSON.stringify(document, { relaxed: false });
      }
    } finally {
      await cursor.close();
    }
    yield ']';
  }
  yield '}}';
};

const PDF_FIELDS = {
  orders: [
    'orderNumber', 'date', 'dealer', 'se', 'so', 'province', 'district', 'area', 'region', 'items',
    'totalBasicAmount', 'totalExciseAmount', 'totalVatAmount', 'totalDiscountAmount', 'grandTotal',
    'paymentType', 'status', 'remarks', 'createdAt',
  ],
  visits: [
    'date', 'dealer', 'se', 'so', 'asm', 'rsm', 'nsm', 'checkInTime', 'checkOutTime', 'checkInLat',
    'checkInLng', 'checkInAccuracyMeters', 'deviceCapturedAt', 'checkInEmployee',
    'dailyVisit', 'checkOutLat', 'checkOutLng', 'locationVerificationStatus',
    'checkOutAccuracyMeters', 'checkOutDistanceMeters', 'checkOutLocationVerificationStatus',
    'checkOutDurationSeconds', 'checkOutReviewStatus', 'checkOutReviewReason',
    'checkOutReviewResolvedAt', 'checkOutReviewResolvedBy', 'checkOutAttempts', 'checkOutReviewHistory',
    'checkOutSecurityEvents', 'verificationStatus', 'verificationReason', 'verificationHistory',
    'locationDistanceMeters', 'locationVerificationMessage', 'remarks', 'complaint',
    'marketSurvey', 'competitorInfo', 'province', 'district', 'area', 'status',
  ],
  dailyvisits: ['date', 'staff', 'dealer', 'sequence', 'status', 'workflowStatus', 'verificationStatus', 'statusHistory', 'verificationHistory', 'checkInAttempts', 'visitStatus', 'requiresReview', 'reviewHistory', 'reviewResolvedAt', 'reviewResolvedBy', 'reviewResolution', 'reviewResolutionNote', 'visit', 'notes', 'assignedBy', 'createdAt'],
  collections: [
    'collectionNumber', 'date', 'collectionDate', 'dealer', 'se', 'amount',
    'paymentType', 'allocations', 'reference', 'bankName', 'referenceNo',
    'remarks', 'province', 'district', 'area', 'status', 'verifiedAt',
  ],
  users: [
    'name', 'email', 'role', 'employeeId', 'phone', 'province', 'district',
    'region', 'area', 'target', 'status', 'lastLogin',
  ],
  dealers: [
    'dealerName', 'dealerCode', 'distributor', 'ownerName', 'phone', 'email',
    'address', 'province', 'district', 'area', 'region', 'creditLimit',
    'latitude', 'longitude', 'geofenceRadius', 'locationVerificationStatus', 'locationReviewedBy',
    'locationReviewedAt', 'locationRejectionReason', 'locationAudit',
    'outstandingAmount', 'dueAmount', 'overdueAmount', 'paymentType',
    'creditStatus', 'status', 'totalOrders', 'monthlyPurchase', 'yearlyPurchase',
  ],
  products: [
    'productName', 'ml', 'up', 'customerType', 'amount', 'customerPrice',
    'exciseAmount', 'vatAmount', 'status',
  ],
  targets: [
    'user', 'role', 'month', 'year', 'salesTarget', 'collectionTarget',
    'visitTarget', 'dealerTarget', 'province', 'region',
  ],
  sales: [
    'invoiceNumber', 'manualSaleId', 'orderNumber', 'date', 'dueDate', 'dealer',
    'salesperson', 'staffId', 'province', 'area', 'items', 'totalDiscountAmount', 'grandTotal',
    'collectedAmount', 'paidAmount', 'remainingBalance', 'paymentStatus',
    'paymentType', 'status', 'remarks',
  ],
  attendance: ['date', 'staffId', 'status', 'checkIn', 'checkOut', 'remarks', 'province'],
  claims: [
    'claimId', 'claimType', 'submittedBy', 'dealer', 'product', 'details',
    'calculatedAmount', 'status', 'rejectionReason', 'paidAt',
  ],
  collectionplans: [
    'dealer', 'month', 'province', 'openingBalance', 'currentOrderAmount',
    'week1', 'week2', 'week3', 'week4', 'remarks',
  ],
  monthlyplannings: ['month', 'year', 'target', 'schemeBudget', 'notes'],
  lifting: [
    'orderNumber', 'dealer', 'productName', 'province', 'staffId',
    'orderedQuantity', 'week1', 'week2', 'week3', 'week4', 'totalLifted',
    'remainingQuantity', 'progressPercent', 'month', 'year',
  ],
  dealerstocktransactions: [
    'dealer', 'product', 'transactionDate', 'transactionType', 'quantity',
    'referenceType', 'reason', 'remarks',
  ],
  dealerledgers: ['dealer', 'date', 'type', 'debit', 'credit', 'balance', 'reference', 'remarks'],
  soledealers: ['dealerName', 'ownerName', 'phone', 'email', 'address', 'province', 'district', 'area', 'status'],
  stockmonths: ['month', 'year', 'status', 'createdAt'],
};

const PDF_COLLECTION_TITLES = {
  users: 'Staff & Admin Accounts',
  dealers: 'Dealers & Customers',
  orders: 'Sales Orders',
  sales: 'Sales Invoices',
  visits: 'Dealer Visits & GPS Check-ins',
  dailyvisits: 'Daily Visit Plans',
  collections: 'Payments & Collections',
  products: 'Products',
  targets: 'Sales Targets',
  attendance: 'Staff Attendance',
  claims: 'Claims & Approvals',
  collectionplans: 'Collection Plans',
  monthlyplannings: 'Monthly Plans',
  lifting: 'Product Lifting',
  dealerstocktransactions: 'Dealer Stock Movements',
  dealerledgers: 'Dealer Account Ledger',
  soledealers: 'Sole Dealers',
  stockmonths: 'Stock Periods',
};

const PDF_LABELS = {
  orderNumber: 'Order number',
  collectionNumber: 'Collection number',
  dealer: 'Dealer',
  se: 'Sales executive',
  so: 'Sales officer',
  asm: 'Area sales manager',
  rsm: 'Regional sales manager',
  nsm: 'National sales manager',
  staff: 'Staff member',
  staffId: 'Staff member',
  salesperson: 'Sales representative',
  submittedBy: 'Submitted by',
  assignedBy: 'Assigned by',
  checkInTime: 'Check-in time',
  checkOutTime: 'Check-out time',
  checkInLat: 'Check-in latitude',
  checkInLng: 'Check-in longitude',
  checkOutLat: 'Check-out latitude',
  checkOutLng: 'Check-out longitude',
  checkOutAccuracyMeters: 'Check-out GPS accuracy (m)',
  checkOutDistanceMeters: 'Check-out dealer distance (m)',
  checkOutLocationVerificationStatus: 'Check-out GPS status',
  checkOutDurationSeconds: 'Visit duration (seconds)',
  checkOutReviewStatus: 'Check-out review status',
  checkOutReviewReason: 'Check-out review reason',
  checkOutReviewResolvedAt: 'Check-out review resolved at',
  checkOutReviewResolvedBy: 'Check-out review resolved by',
  checkOutAttempts: 'Check-out GPS attempts',
  checkOutReviewHistory: 'Check-out review audit history',
  grandTotal: 'Grand total',
  totalBasicAmount: 'Basic total',
  totalExciseAmount: 'Excise total',
  totalVatAmount: 'VAT total',
  totalDiscountAmount: 'Discount total',
  customerType: 'Customer type',
  visitStatus: 'Visit status',
  outstandingAmount: 'Outstanding amount',
  dueAmount: 'Due amount',
  overdueAmount: 'Overdue amount',
  creditLimit: 'Credit limit',
  monthlyPurchase: 'Monthly purchase',
  yearlyPurchase: 'Yearly purchase',
  salesTarget: 'Sales target',
  collectionTarget: 'Collection target',
  visitTarget: 'Visit target',
  dealerTarget: 'Dealer target',
};

const REFERENCE_TYPES = {
  dealer: 'dealers',
  staff: 'users',
  staffId: 'users',
  salesperson: 'users',
  submittedBy: 'users',
  user: 'users',
  se: 'users',
  so: 'users',
  asm: 'users',
  rsm: 'users',
  nsm: 'users',
  verifiedBy: 'users',
  approvedBy: 'users',
  assignedBy: 'users',
  checkOutReviewResolvedBy: 'users',
  reviewResolvedBy: 'users',
  createdBy: 'users',
  setBy: 'users',
  markedBy: 'users',
  linkedDealer: 'dealers',
  sourceDealer: 'dealers',
  destinationDealer: 'dealers',
  product: 'products',
};

const ITEM_FIELDS = [
  'productName', 'ml', 'up', 'customerType', 'quantity', 'rate',
  'discountPercent', 'discountAmount', 'grandTotal',
];
const ALLOCATION_FIELDS = ['invoiceNumber', 'amount'];

const formatPdfValue = (key, value, references) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toLocaleString();
  if (value && value._bsontype) {
    const referenceType = REFERENCE_TYPES[key];
    const referenceName = referenceType && references[referenceType].get(value.toString());
    return referenceName || null;
  }
  if (typeof value === 'number') return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') {
    const referenceType = REFERENCE_TYPES[key];
    if (/^[a-f\d]{24}$/i.test(value)) {
      return referenceType ? references[referenceType].get(value) || null : null;
    }
    return value;
  }
  return null;
};

const readableRecord = (collectionName, record, references) => {
  const fields = PDF_FIELDS[collectionName] || [
    'name', 'title', 'number', 'code', 'date', 'type', 'role', 'status',
    'description', 'notes', 'remarks', 'province', 'district', 'region',
    'area', 'quantity', 'amount', 'total', 'grandTotal', 'paymentType',
    'createdAt',
  ];
  const details = [];

  for (const field of fields) {
    const value = record[field];
    if (value === undefined || value === null || value === '') continue;

    if (field === 'items' && Array.isArray(value)) {
      const visibleItems = value.slice(0, 5).map((item, index) => {
        const parts = ITEM_FIELDS
          .filter(itemField => item[itemField] !== undefined && item[itemField] !== null && item[itemField] !== '')
          .map(itemField => `${PDF_LABELS[itemField] || itemField}: ${formatPdfValue(itemField, item[itemField], references)}`)
          .filter(part => !part.endsWith(': null'));
        return parts.length ? `Item ${index + 1} - ${parts.join(' | ')}` : null;
      }).filter(Boolean);
      if (visibleItems.length) {
        details.push({ label: 'Order items', value: visibleItems.join('\n') });
      }
      if (value.length > visibleItems.length) {
        details.push({ label: 'Additional items', value: `${value.length - visibleItems.length} more item(s) not shown` });
      }
      continue;
    }

    if (field === 'allocations' && Array.isArray(value)) {
      const entries = value.slice(0, 5).map((allocation, index) => {
        const parts = ALLOCATION_FIELDS
          .filter(allocationField => allocation[allocationField] !== undefined && allocation[allocationField] !== null)
          .map(allocationField => `${PDF_LABELS[allocationField] || allocationField}: ${formatPdfValue(allocationField, allocation[allocationField], references)}`);
        return parts.length ? `Invoice ${index + 1} - ${parts.join(' | ')}` : null;
      }).filter(Boolean);
      if (entries.length) details.push({ label: 'Invoice allocations', value: entries.join('\n') });
      if (value.length > entries.length) {
        details.push({ label: 'Additional invoices', value: `${value.length - entries.length} more invoice(s) not shown` });
      }
      continue;
    }

    const formatted = formatPdfValue(field, value, references);
    if (formatted) details.push({ label: PDF_LABELS[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase()), value: formatted });
  }

  const title = record.orderNumber || record.collectionNumber || record.dealerName
    || record.productName || record.name || record.title || record.employeeId;
  return { title: title || null, details };
};

const streamBackupRecords = async (filename, onRecord) => {
  const tokenStream = parser();
  const parsing = pipeline(createReadStream(filename), zlib.createGunzip(), tokenStream);
  const stack = [];
  let assembler = null;
  let activeCollection = null;
  let completed = false;

  try {
    for await (const token of tokenStream) {
      const parent = stack[stack.length - 1];
      if (!assembler && parent?.isCollectionArray && token.name === 'startObject') {
        activeCollection = parent.collectionName;
        assembler = new Assembler();
        assembler.consume(token);
      } else if (assembler) {
        assembler.consume(token);
        if (assembler.done) {
          await onRecord(activeCollection, EJSON.deserialize(assembler.current));
          assembler = null;
          activeCollection = null;
        }
      }

      if (token.name === 'keyValue') {
        if (parent) parent.key = token.value;
      } else if (token.name === 'startObject' || token.name === 'startArray') {
        const frame = { type: token.name === 'startObject' ? 'object' : 'array' };
        frame.isRoot = !parent && frame.type === 'object';
        frame.isCollectionsContainer = parent?.isRoot && parent.key === 'collections' && frame.type === 'object';
        frame.isCollectionArray = parent?.isCollectionsContainer && frame.type === 'array';
        frame.collectionName = frame.isCollectionArray ? parent.key : null;
        if (parent) parent.key = null;
        stack.push(frame);
      } else if (token.name === 'endObject' || token.name === 'endArray') {
        stack.pop();
        if (stack.length) stack[stack.length - 1].key = null;
      } else if (parent) {
        parent.key = null;
      }
    }
    await parsing;
    completed = true;
  } finally {
    if (!completed) {
      tokenStream.destroy();
      await parsing.catch(() => {});
    }
  }
};

const writePdfText = (document, text, options = {}) => {
  const segments = String(text).match(/[\u0900-\u097F]+|[^\u0900-\u097F]+/gu) || [''];
  segments.forEach((segment, index) => {
    const font = /[\u0900-\u097F]/u.test(segment) ? 'SfaDevanagari' : 'SfaLatin';
    document.font(font).text(segment, {
      width: 510,
      lineGap: 1,
      ...options,
      continued: index < segments.length - 1,
    });
  });
};

const writeBackupPdf = async (filename, document, createdAt = new Date()) => {
  document.registerFont('SfaLatin', LATIN_FONT);
  document.registerFont('SfaDevanagari', DEVANAGARI_FONT);
  document.font('SfaLatin').fontSize(22).fillColor('#0f172a')
    .text('SFA Database Backup');
  document.moveDown(0.5).fontSize(10).fillColor('#475569')
    .text(`Created: ${new Date(createdAt).toLocaleString()}`)
    .text('This readable PDF is for viewing and printing. It is not a restorable database archive.');
  document.moveDown().fontSize(9).fillColor('#64748b')
    .text('Sensitive authentication fields are excluded from the backup export.');

  const references = { users: new Map(), dealers: new Map(), products: new Map() };
    await streamBackupRecords(filename, async (collectionName, record) => {
      const referenceType = ['users', 'dealers', 'products'].includes(collectionName) ? collectionName : null;
      if (!referenceType || !record._id) return;
      const name = referenceType === 'users' ? record.name
        : referenceType === 'dealers' ? record.dealerName
          : record.productName;
      if (name) references[referenceType].set(record._id.toString(), name);
    });

    let activeCollection = null;
    let recordNumber = 0;
    const collectionCounts = new Map();
    const ensurePdfSpace = height => {
      const bottom = document.page.height - document.page.margins.bottom;
      if (document.y + height > bottom) document.addPage();
    };
    await streamBackupRecords(filename, async (collectionName, record) => {
      if (['backups', 'backupruns', 'backuplogs', 'notifications'].includes(collectionName.toLowerCase())) return;
      const summary = readableRecord(collectionName, record, references);
      if (!summary.details.length) return;

      if (collectionName !== activeCollection) {
        document.addPage();
        const title = PDF_COLLECTION_TITLES[collectionName]
          || collectionName.replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]/g, ' ')
            .replace(/^./, character => character.toUpperCase());
        document.font('SfaLatin').fontSize(16).fillColor('#1d4ed8').text(title);
        document.moveDown(0.6);
        activeCollection = collectionName;
        recordNumber = 0;
      }

      recordNumber += 1;
      collectionCounts.set(collectionName, (collectionCounts.get(collectionName) || 0) + 1);
      const heading = summary.title || `Record ${recordNumber}`;
      document.font('SfaLatin').fontSize(9);
      const headingHeight = document.heightOfString(heading, { width: 485 });
      ensurePdfSpace(headingHeight + 18);
      const headingY = document.y;
      document.save().roundedRect(48, headingY, 499, headingHeight + 10, 4).fill('#eff6ff').restore();
      document.font('SfaLatin').fontSize(9).fillColor('#1e3a8a')
        .text(heading, 56, headingY + 5, { width: 485 });
      document.y = headingY + headingHeight + 12;
      for (const detail of summary.details) {
        document.font('SfaLatin').fontSize(8);
        const detailHeight = document.heightOfString(`${detail.label}: ${detail.value}`, {
          width: 487,
          lineGap: 1,
        });
        ensurePdfSpace(detailHeight + 2);
        document.font('SfaLatin').fontSize(8).fillColor('#475569')
          .text(`${detail.label}:`, 58, document.y, { width: 140, continued: true });
        writePdfText(document, ` ${detail.value}`, { width: 345, continued: false });
      }
      document.moveDown(0.5);
    });

    document.addPage();
    document.font('SfaLatin').fontSize(16).fillColor('#1d4ed8').text('Backup Summary');
    document.moveDown(0.4).fontSize(9).fillColor('#334155');
    for (const [collectionName, count] of collectionCounts) {
      writePdfText(document, `${collectionName}: ${count} record(s)`);
    }
    document.moveDown(0.4);
    document.font('SfaLatin').fontSize(8).fillColor('#64748b')
      .text('This PDF displays selected business details only. The complete protected server archive is retained for restoration.');
};

const createBackupPdf = async (backup, response) => {
  const pdf = new PDFDocument({ autoFirstPage: true, margin: 48, size: 'A4' });
  pdf.pipe(response);
  try {
    await writeBackupPdf(resolveBackupFile(backup.filename), pdf, backup.createdAt);
    pdf.end();
  } catch (error) {
    pdf.destroy();
    throw error;
  }
};

const logBackupActivity = async ({
  admin = null,
  action,
  filename = null,
  status,
  ipAddress = null,
  error = null,
}) => {
  try {
    await BackupLog.create({
      adminId: admin?._id || null,
      adminEmail: admin?.email || null,
      action,
      filename,
      status,
      ipAddress,
      error: error ? safeErrorMessage(error) : null,
    });
  } catch (logError) {
    console.error('Failed to write database backup activity log:', safeErrorMessage(logError));
  }
};

const notifyAdminsBackupFailure = async error => {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    if (!admins.length) return;
    await Notification.insertMany(admins.map(admin => ({
      user: admin._id,
      type: 'general',
      title: 'Database backup failed',
      message: 'The scheduled database backup failed. Please review backup status and server logs.',
      link: '/admin/backups',
    })));
  } catch (notificationError) {
    console.error('Could not notify Admin users about a failed database backup:', safeErrorMessage(notificationError));
  }
  console.error('Scheduled database backup failed:', safeErrorMessage(error));
};

const createBackup = async ({ type = 'manual', createdBy = null, ipAddress = null } = {}) => {
  const now = new Date();
  const filename = createFilename(now);
  let backup;
  let temporaryPath;
  let finalPath;
  let ownsTemporaryFile = false;
  let ownsFinalFile = false;

  try {
    backup = await Backup.create({ filename, status: 'IN_PROGRESS', type, createdBy });
    if (!isEnabled()) throw new Error('Database backups are disabled by configuration.');
    const directory = getBackupDirectory();
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.chmod(directory, 0o700);
    finalPath = resolveBackupFile(filename);
    temporaryPath = `${finalPath}.partial`;

    const output = createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 });
    await new Promise((resolve, reject) => {
      output.once('open', () => {
        ownsTemporaryFile = true;
        resolve();
      });
      output.once('error', reject);
    });
    await pipeline(
      Readable.from(serializeDatabase()),
      zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }),
      output
    );
    await fs.rename(temporaryPath, finalPath);
    ownsTemporaryFile = false;
    ownsFinalFile = true;
    await fs.chmod(finalPath, 0o600);
    const { size } = await fs.stat(finalPath);
    backup.size = size;
    backup.status = 'SUCCESS';
    backup.error = null;
    await backup.save();

    await logBackupActivity({
      admin: createdBy ? { _id: createdBy._id || createdBy, email: createdBy.email } : null,
      action: type === 'automatic' ? 'AUTOMATIC_BACKUP' : 'CREATE_BACKUP',
      filename,
      status: 'SUCCESS',
      ipAddress,
    });
    await cleanupExpiredBackups().catch(error => {
      console.error('Database backup retention cleanup failed:', safeErrorMessage(error));
    });
    return backup;
  } catch (error) {
    if (ownsTemporaryFile) await fs.rm(temporaryPath, { force: true }).catch(() => {});
    if (ownsFinalFile) await fs.rm(finalPath, { force: true }).catch(() => {});
    const message = safeErrorMessage(error);
    if (backup) {
      backup.status = 'FAILED';
      backup.error = message;
      await backup.save().catch(saveError => {
        console.error('Failed to record database backup failure:', safeErrorMessage(saveError));
      });
    }
    await logBackupActivity({
      admin: createdBy ? { _id: createdBy._id || createdBy, email: createdBy.email } : null,
      action: type === 'automatic' ? 'AUTOMATIC_BACKUP' : 'CREATE_BACKUP',
      filename: backup?.filename || filename,
      status: 'FAILED',
      ipAddress,
      error,
    });
    throw error;
  }
};

const cleanupExpiredBackups = async () => {
  const retentionDays = getRetentionDays();
  const backups = await Backup.find({ status: 'SUCCESS' }).sort({ createdAt: -1 }).lean();
  if (backups.length < 2) return;

  const newestBackupId = String(backups[0]._id);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const backup of backups) {
    if (String(backup._id) === newestBackupId || new Date(backup.createdAt).getTime() >= cutoff) continue;

    try {
      await fs.rm(resolveBackupFile(backup.filename), { force: true });
      await Backup.deleteOne({ _id: backup._id });
      await logBackupActivity({
        action: 'RETENTION_DELETE',
        filename: backup.filename,
        status: 'SUCCESS',
      });
    } catch (error) {
      await logBackupActivity({
        action: 'RETENTION_DELETE',
        filename: backup.filename,
        status: 'FAILED',
        error,
      });
      console.error(`Failed to remove expired backup ${backup.filename}:`, safeErrorMessage(error));
    }
  }
};

const getBackupById = async id => {
  if (!mongoose.isValidObjectId(id)) return null;
  return Backup.findById(id);
};

const getBackupFilePath = backup => resolveBackupFile(backup.filename);

const getBackupStatus = async () => {
  const latestBackup = await Backup.findOne({ status: 'SUCCESS' }).sort({ createdAt: -1 }).lean();
  const [count, usage] = await Promise.all([
    Backup.countDocuments({ status: 'SUCCESS' }),
    Backup.aggregate([
      { $match: { status: 'SUCCESS' } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } },
    ]),
  ]);
  let retentionDays = null;
  let statusError = schedulerError;
  try {
    retentionDays = getRetentionDays();
  } catch (error) {
    statusError = statusError || safeErrorMessage(error);
  }

  return {
    enabled: isEnabled(),
    scheduleActive: Boolean(scheduler),
    scheduleError: statusError,
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
    timezone: process.env.BACKUP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
    retentionDays,
    latestBackup,
    backupCount: count,
    storageUsed: usage[0]?.totalSize || 0,
  };
};

const startBackupScheduler = async () => {
  if (!isEnabled()) {
    console.log('Database backup scheduler is disabled (BACKUP_ENABLED=false).');
    return;
  }
  if (scheduler) return;

  try {
    const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';
    if (!cron.validate(schedule)) throw new Error('BACKUP_SCHEDULE is not a valid cron expression.');
    getRetentionDays();
    getBackupDirectory();
    const timezone = process.env.BACKUP_TIMEZONE;
    await Promise.all([Backup.init(), BackupRun.init(), BackupLog.init()]);
    await BackupRun.collection.createIndex(
      { executionKey: 1 },
      { unique: true }
    );

    scheduler = cron.schedule(schedule, async () => {
      const startedAt = new Date();
      const executionKey = `${schedule}:${getScheduledDate(startedAt)}`;
      let run;
      try {
        run = await BackupRun.create({
          executionKey,
          status: 'IN_PROGRESS',
          startedAt,
        });
      } catch (error) {
        if (error.code === 11000) return;
        console.error('Could not claim scheduled database backup:', safeErrorMessage(error));
        return;
      }

      try {
        const backup = await createBackup({ type: 'automatic' });
        run.backup = backup._id;
        run.status = 'SUCCESS';
        run.completedAt = new Date();
        await run.save();
      } catch (error) {
        run.status = 'FAILED';
        run.error = safeErrorMessage(error);
        run.completedAt = new Date();
        await run.save().catch(saveError => {
          console.error('Failed to record scheduled backup result:', safeErrorMessage(saveError));
        });
        await notifyAdminsBackupFailure(error);
      }
    }, timezone ? { timezone } : {});
    schedulerError = null;
    console.log(`Database backup scheduler started (${schedule}${timezone ? `, ${timezone}` : ''}).`);
  } catch (error) {
    schedulerError = safeErrorMessage(error);
    console.error('Database backup scheduler could not start:', schedulerError);
  }
};

const stopBackupScheduler = () => {
  scheduler?.stop();
  scheduler = null;
};

module.exports = {
  cleanupExpiredBackups,
  createBackup,
  createBackupPdf,
  getBackupById,
  getBackupDirectory,
  getBackupFilePath,
  getBackupStatus,
  isSafeBackupFilename,
  logBackupActivity,
  redactSensitiveFields,
  readableRecord,
  safeErrorMessage,
  writeBackupPdf,
  startBackupScheduler,
  stopBackupScheduler,
};
