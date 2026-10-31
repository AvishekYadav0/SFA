require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const createSuperAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  const email    = process.env.SUPER_ADMIN_EMAIL    || 'superadmin@sfa.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2024';
  const name     = process.env.SUPER_ADMIN_NAME     || 'Super Admin';

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.isSuperAdmin) {
      console.log('✅ Super admin already exists:', email);
    } else {
      await User.findByIdAndUpdate(existing._id, { isSuperAdmin: true, role: 'superadmin' });
      console.log('✅ Existing user promoted to super admin:', email);
    }
    process.exit(0);
  }

  await User.create({ name, email, password, role: 'superadmin', isSuperAdmin: true, status: 'active' });
  console.log('✅ Super admin created:', email);
  console.log('   Password:', password);
  console.log('   ⚠️  Change this password immediately after first login!');
  process.exit(0);
};

createSuperAdmin().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
