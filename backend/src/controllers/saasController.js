const crypto   = require('crypto');
const User     = require('../models/User');
const Company  = require('../models/Company');
const {
  connectionForCompany,
  databaseNameForCompany,
  initializeTenantDatabase,
  tenantContextFor,
} = require('../utils/tenantModels');
const { withTenantContext } = require('../utils/tenantContext');

// Generate a short unique tenantId
const genTenantId = () => crypto.randomBytes(6).toString('hex');

// ── GET /api/saas/companies ───────────────────────────────────────────────────
// Super Admin: list all companies
exports.listCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort('-createdAt').lean();
    const data = await Promise.all(companies.map(async company => {
      const adminUser = await withTenantContext(tenantContextFor(company), () =>
        company.adminUser
          ? User.findById(company.adminUser).select('name email lastLogin').lean()
          : User.findOne({ role: 'admin', email: company.email }).select('name email lastLogin').lean()
      );
      return { ...company, adminUser };
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/saas/companies ──────────────────────────────────────────────────
// Super Admin: onboard an existing company
exports.addCompany = async (req, res) => {
  try {
    const { companyName, adminEmail, tempPassword } = req.body;
    if (!companyName || !adminEmail || !tempPassword)
      return res.status(400).json({ success: false, message: 'Company name, admin email and temp password are required' });

    const existingCompany = await Company.findOne({ email: adminEmail.toLowerCase() });
    if (existingCompany)
      return res.status(409).json({ success: false, message: 'A company with this email already exists' });

    const tenantId = genTenantId();
    const company = await Company.create({
      name:      companyName,
      email:     adminEmail.toLowerCase(),
      tenantId,
      databaseName: databaseNameForCompany(companyName, tenantId),
      adminCount: 1,
      status:    'active',
      createdBy: req.user._id,
    });
    await initializeTenantDatabase(connectionForCompany(company));
    const adminUser = await withTenantContext(tenantContextFor(company), () => User.create({
      name:               companyName + ' Admin',
      email:              adminEmail.toLowerCase(),
      password:           tempPassword,
      role:               'admin',
      companyId:          company._id,
      tenantId,
      mustChangePassword: true,
      status:             'active',
    }));
    company.adminUser = adminUser._id;
    await company.save();

    const userData = adminUser.toObject();
    delete userData.password;
    res.status(201).json({ success: true, data: { company, adminUser: userData } });
  } catch (err) {
    console.error('addCompany error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/saas/companies/onboard-legacy ───────────────────────────────────
// Super Admin: safely onboard the existing legacy company
// Does NOT change any existing user credentials or IDs
exports.onboardLegacy = async (req, res) => {
  try {
    const { companyName, adminEmail } = req.body;
    if (!companyName || !adminEmail)
      return res.status(400).json({ success: false, message: 'Company name and existing admin email are required' });

    // Find the existing admin user — do NOT change password or ID
    const alreadyCompany = await Company.findOne({ email: adminEmail.toLowerCase() });
    if (alreadyCompany)
      return res.status(409).json({ success: false, message: 'A company record already exists for this email' });

    const tenantId = genTenantId();
    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase(), role: 'admin' }).select('+password');
    if (!existingAdmin)
      return res.status(404).json({ success: false, message: 'No admin user found with this email' });
    if (existingAdmin.tenantId)
      return res.status(409).json({ success: false, message: 'This user is already assigned to a tenant' });

    const company = await Company.create({
      name:      companyName,
      email:     adminEmail.toLowerCase(),
      tenantId,
      databaseName: databaseNameForCompany(companyName, tenantId),
      adminCount: 1,
      isLegacy:  true,
      status:    'active',
      createdBy: req.user._id,
    });

    await initializeTenantDatabase(connectionForCompany(company));
    const tenantAdmin = existingAdmin.toObject();
    delete tenantAdmin.__v;
    tenantAdmin.companyId = company._id;
    tenantAdmin.tenantId = tenantId;
    await connectionForCompany(company).collection(User.collection.collectionName).insertOne(tenantAdmin);
    company.adminUser = existingAdmin._id;
    await company.save();

    res.json({ success: true, message: 'Legacy company onboarded successfully', data: { company, tenantId } });
  } catch (err) {
    console.error('onboardLegacy error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/saas/companies/:id/status ─────────────────────────────────────
// Super Admin: suspend or activate a company
exports.updateCompanyStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status))
      return res.status(400).json({ success: false, message: 'Status must be active or suspended' });

    const company = await Company.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!company)
      return res.status(404).json({ success: false, message: 'Company not found' });

    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
