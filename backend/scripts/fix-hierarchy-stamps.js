/**
 * One-time script: re-stamp rsm/asm/nsm on all users based on reportsTo chain.
 * Run: node scripts/fix-hierarchy-stamps.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const users = await User.find({}).lean();
  const byId = Object.fromEntries(users.map(u => [u._id.toString(), u]));

  function getHierarchy(userId) {
    const u = byId[userId?.toString()];
    if (!u) return {};
    const parent = byId[u.reportsTo?.toString()];
    if (!parent) return {};
    if (parent.role === 'nsm') return { nsm: parent._id, rsm: null, asm: null };
    if (parent.role === 'rsm') return { rsm: parent._id, nsm: parent.nsm, asm: null };
    if (parent.role === 'asm') return { asm: parent._id, rsm: parent.rsm, nsm: parent.nsm };
    // se/so: inherit parent's stamped fields
    if (parent.role === 'se' || parent.role === 'so') {
      // parent may itself need stamps — resolve recursively
      const parentStamps = parent.rsm ? {} : getHierarchy(parent._id);
      return {
        asm: parent.asm || parentStamps.asm || null,
        rsm: parent.rsm || parentStamps.rsm || null,
        nsm: parent.nsm || parentStamps.nsm || null,
      };
    }
    return {};
  }

  let updated = 0;
  for (const u of users) {
    if (u.role === 'admin' || u.role === 'nsm') continue;
    const stamps = getHierarchy(u._id);
    if (!Object.keys(stamps).length) continue;

    const needsUpdate = Object.entries(stamps).some(
      ([k, v]) => u[k]?.toString() !== v?.toString()
    );
    if (!needsUpdate) continue;

    await User.updateOne({ _id: u._id }, { $set: stamps });
    console.log(`Fixed ${u.name} (${u.role}):`, stamps);
    updated++;
  }

  console.log(`Done. Updated ${updated} users.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
