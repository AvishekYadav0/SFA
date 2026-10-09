const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');

const originalFindById = User.findById;
const originalJwtSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'backup-auth-test-secret';
User.findById = id => ({
  select: async () => ({ _id: id, role: id === 'staff-id' ? 'se' : 'admin' }),
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

    const staffToken = jwt.sign({ id: 'staff-id' }, process.env.JWT_SECRET);
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
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  }
});
