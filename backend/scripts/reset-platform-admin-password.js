require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const PlatformAdmin = require('../src/models/PlatformAdmin');

async function resetPassword() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing PLATFORM_ADMIN_EMAIL or PLATFORM_ADMIN_PASSWORD in environment.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const admin = await PlatformAdmin.findOne({ email: email.trim().toLowerCase() });

  if (!admin) {
    throw new Error(`No platform admin account found for ${email}. Run the bootstrap command first.`);
  }

  admin.passwordHash = password;
  await admin.save();

  console.log(`Platform admin password updated for ${admin.email}`);
}

resetPassword()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error('Platform admin password reset failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
