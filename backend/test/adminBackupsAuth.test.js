const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Company = require('../src/models/Company');

const originalFindById = User.findById;
const originalCompanyFindById = Company.findById;
const originalUseDb = mongoose.connection.useDb;
const originalJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'backup-auth-test-secret';
mongoose.connection.useDb = () => ({
  models: {
    User: {
      findById: id => ({
        select: async () => ({
          _id: id,
          role: id === 'staff-id' ? 'se' : 'admin',
          companyId: 'company-id',
          tenantId: 'tenant-id',
        }),
      }),
    },
  },
});
Company.findById = async id => ({
  _id: id,
  tenantId: 'tenant-id',
  databaseName: 'sfa_test_company',
  status: 'active',
  isLegacy: false,
});

const app = express();
app.use('/api/admin/backups', require('../src/routes/adminBackups'));
const server = app.listen(0, '127.0.0.1');

server.once('listening', async () => {
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/admin/backups`;
  try {
    const anonymousResponse = await fetch(baseUrl);
    assert.strictEqual(anonymousResponse.status, 401, 'anonymous users must not access backup APIs');

    const staffToken = jwt.sign({
      id: 'staff-id',
      companyId: 'company-id',
      tenantId: 'tenant-id',
    }, process.env.JWT_SECRET);
    const staffResponse = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(staffResponse.status, 403, 'non-admin users must not access backup APIs');
    console.log('admin backup authorization tests passed');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
    User.findById = originalFindById;
    Company.findById = originalCompanyFindById;
    mongoose.connection.useDb = originalUseDb;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});
