require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const PlatformAdmin = require('../src/models/PlatformAdmin');

async function bootstrap() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME || 'Platform Administrator';

  if (!email || !password) {
    console.error('Missing PLATFORM_ADMIN_EMAIL or PLATFORM_ADMIN_PASSWORD in environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const existing = await PlatformAdmin.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`Platform admin already exists for ${email}`);
    process.exit(0);
  }

  const admin = await PlatformAdmin.create({
    name,
    email: email.toLowerCase(),
    passwordHash: password,
    accountType: 'platform_admin',
    permissions: ['all'],
    isActive: true,
  });

  console.log(`Platform admin created: ${admin.email}`);
  process.exit(0);
}

bootstrap().catch((error) => {
  console.error('Platform admin bootstrap failed:', error.message);
  process.exit(1);
});
