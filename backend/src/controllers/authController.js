const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const {
  connectionForCompany,
  databaseNameForCompany,
  initializeTenantDatabase,
  tenantContextFor,
} = require('../utils/tenantModels');
const { withTenantContext } = require('../utils/tenantContext');
const MAX_ADMINS = 8;

function withCompanyDatabase(company, callback) {
  return withTenantContext(tenantContextFor(company), callback);
}

function adminFilterForCompany(company) {
  return company.isLegacy
    ? { role: 'admin', $or: [{ companyId: company._id }, { companyId: null }, { companyId: { $exists: false } }] }
    : { role: 'admin', companyId: company._id };
}

async function reserveAdminSlot(company) {
  const count = await User.countDocuments(adminFilterForCompany(company));
  await Company.updateOne(
    { _id: company._id, adminCount: { $exists: false } },
    { $set: { adminCount: count } },
  );
  return Company.findOneAndUpdate(
    { _id: company._id, status: 'active', adminCount: { $lt: MAX_ADMINS } },
    { $inc: { adminCount: 1 } },
    { new: true },
  );
}

async function releaseAdminSlot(companyId) {
  await Company.updateOne(
    { _id: companyId, adminCount: { $gt: 0 } },
    { $inc: { adminCount: -1 } },
  );
}

const signToken = (user, company) => jwt.sign({
  id: user._id,
  companyId: String(company._id),
  tenantId: company.tenantId,
}, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

function verificationTokenFrom(req) {
  return req.body?.companyVerificationToken || req.get('X-Company-Verification');
}

async function getVerifiedCompany(req) {
  const token = verificationTokenFrom(req);
  if (!token) throw new Error('Verify your company before continuing.');
  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new Error('Company verification expired. Verify your company again.');
  }
  if (claims.purpose !== 'company-verification' || !mongoose.isValidObjectId(claims.companyId)) {
    throw new Error('Company verification is invalid. Verify your company again.');
  }
  const company = await Company.findById(claims.companyId);
  if (!company || company.tenantId !== claims.tenantId) throw new Error('Verified company could not be found.');
  if (company.status !== 'active') throw new Error('This company is inactive. Contact the platform administrator.');
  connectionForCompany(company);
  return company;
}

exports.registerCompany = async (req, res) => {
  let company;
  let admin;
  try {
    const companyName = String(req.body?.companyName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    const confirmPassword = req.body?.confirmPassword;
    if (!companyName || companyName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || typeof password !== 'string' || typeof confirmPassword !== 'string') {
      return res.status(400).json({ success: false, message: 'Enter a valid company name, email, password, and password confirmation.' });
    }
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    if (password !== confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    if (await Company.exists({ email })) return res.status(409).json({ success: false, message: 'A company with this email is already registered.' });
    const tenantId = crypto.randomUUID();
    company = await Company.create({
      name: companyName,
      email,
      tenantId,
      databaseName: databaseNameForCompany(companyName, tenantId),
      status: 'active',
      adminCount: 1,
      isLegacy: false,
    });
    const connection = connectionForCompany(company);
    await initializeTenantDatabase(connection);
    admin = await withCompanyDatabase(company, () => User.create({
      name: `${companyName} Admin`,
      email,
      password,
      role: 'admin',
      companyId: company._id,
      tenantId: company.tenantId,
      status: 'active',
    }));
    company.adminUser = admin._id;
    await company.save();
    res.status(201).json({
      success: true,
      message: 'Company registered. Verify your company to continue.',
      data: { companyId: company._id, tenantId: company.tenantId, name: company.name },
    });
  } catch (err) {
    if (admin?._id) {
      try {
        if (company) {
          await withCompanyDatabase(company, () => User.deleteOne({ _id: admin._id }));
        }
      } catch (rollbackError) {
        console.error('Failed to remove the newly created company admin during rollback:', rollbackError.message);
      }
    }
    if (company?._id) {
      try {
        await Company.deleteOne({ _id: company._id });
      } catch (rollbackError) {
        console.error('Failed to remove the newly created company during rollback:', rollbackError.message);
      }
    }
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'A company or user with this email is already registered.' });
    res.status(500).json({ success: false, message: err.message || 'Company registration failed.' });
  }
};

exports.verifyCompany = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!email || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Company email and password are required.' });
    }
    const company = await Company.findOne({ email });
    if (!company) return res.status(401).json({ success: false, message: 'Company email or password is incorrect.' });
    if (company.status !== 'active') return res.status(403).json({ success: false, message: 'This company is inactive. Contact the platform administrator.' });

    const admin = await withCompanyDatabase(company, async () => {
      let companyAdmin = company.adminUser
        ? await User.findById(company.adminUser).select('+password')
        : null;
      if (!companyAdmin) {
        companyAdmin = await User.findOne({
          email,
          role: 'admin',
          $or: [{ companyId: company._id }, ...(company.isLegacy ? [{ companyId: null }, { companyId: { $exists: false } }] : [])],
        }).select('+password');
      }
      return companyAdmin;
    });
    if (!admin || admin.role !== 'admin' || admin.status !== 'active'
      || admin.email !== email || !(await admin.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Company email or password is incorrect.' });
    }
    if (admin.companyId && String(admin.companyId) !== String(company._id)) {
      return res.status(403).json({ success: false, message: 'The company administrator does not belong to this company.' });
    }

    const companyVerificationToken = jwt.sign({
      purpose: 'company-verification',
      companyId: String(company._id),
      tenantId: company.tenantId,
      legacy: company.isLegacy === true,
    }, process.env.JWT_SECRET, { expiresIn: '30m' });
    res.json({
      success: true,
      companyVerificationToken,
      data: { companyId: String(company._id), tenantId: company.tenantId, name: company.name },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Company verification failed.' });
  }
};

exports.checkAdmin = async (req, res) => {
  try {
    const company = await getVerifiedCompany(req);
    const count = await withCompanyDatabase(company, () => User.countDocuments(adminFilterForCompany(company)));
    res.json({
      success: true,
      adminExists: count > 0,
      adminCount: count,
      adminLimitReached: count >= MAX_ADMINS,
    });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};

exports.registerAdmin = async (req, res) => {
  let reserved = false;
  let company;
  try {
    company = await getVerifiedCompany(req);
    return await withCompanyDatabase(company, async () => {
      const { name, email, password, phone } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
      }
      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      if (await User.exists({ email: normalizedEmail })) {
        return res.status(409).json({ success: false, message: 'This email is already registered.' });
      }
      const slot = await reserveAdminSlot(company);
      if (!slot) return res.status(409).json({ success: false, message: 'The maximum of 8 admin accounts already exists.' });
      reserved = true;
      const admin = await User.create({
        name,
        email: normalizedEmail,
        password,
        phone,
        role: 'admin',
        companyId: company._id,
        tenantId: company.tenantId,
      });
      reserved = false;
      const user = admin.toObject();
      delete user.password;
      return res.status(201).json({ success: true, user });
    });
  } catch (err) {
    if (reserved && company) {
      try {
        await releaseAdminSlot(company._id);
      } catch (releaseError) {
        console.error('Failed to release a reserved company admin slot:', releaseError.message);
      }
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const company = await getVerifiedCompany(req);
    return await withCompanyDatabase(company, async () => {
      const normalizedEmail = String(email).trim().toLowerCase();
      const userFilter = company.isLegacy
        ? { email: normalizedEmail, $or: [{ companyId: company._id }, { companyId: null }, { companyId: { $exists: false } }] }
        : { email: normalizedEmail, companyId: company._id };
      const user = await User.findOne(userFilter).select('+password');
      if (!user || user.status !== 'active' || !(await user.matchPassword(password))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
      if (!req.body.role || user.role !== req.body.role) {
        return res.status(403).json({ success: false, message: `This account is not assigned the ${req.body.role} role.` });
      }
      user.lastLogin = new Date();
      if (!user.companyId) user.companyId = company._id;
      if (!user.tenantId) user.tenantId = company.tenantId;
      await user.save({ validateBeforeSave: false });
      const token = signToken(user, company);
      const userData = user.toObject();
      delete userData.password;
      userData.companyName = company.name;
      return res.json({ success: true, token, user: userData, company: { _id: company._id, tenantId: company.tenantId, name: company.name } });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  const user = req.user.toObject();
  user.companyName = req.company?.name || '';
  res.json({ success: true, user });
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
