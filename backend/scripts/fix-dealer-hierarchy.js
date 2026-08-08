/**
 * One-time script: re-stamp rsm/asm/nsm on all Dealer documents.
 * Run: node scripts/fix-dealer-hierarchy.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Dealer = require('../src/models/Dealer');
const User = require('../src/models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const dealers = await Dealer.find({}).lean();
  const users = await User.find({}).lean();
  const byId = Object.fromEntries(users.map(u => [u._id.toString(), u]));

  let updated = 0;
  for (const d of dealers) {
    const seUser = d.se ? byId[d.se.toString()] : null;
    const soUser = (d.so || []).map(id => byId[id.toString()]).find(Boolean);
    const ref = seUser || soUser;
    if (!ref) { console.log('Skipped (no se/so):', d.dealerName); continue; }

    const stamps = {
      rsm: ref.rsm || (ref.role === 'rsm' ? ref._id : null),
      asm: ref.asm || (ref.role === 'asm' ? ref._id : null),
      nsm: ref.nsm || (ref.role === 'nsm' ? ref._id : null),
    };

    const needsUpdate = Object.entries(stamps).some(
      ([k, v]) => d[k]?.toString() !== v?.toString()
    );
    if (!needsUpdate) continue;

    await Dealer.updateOne({ _id: d._id }, { $set: stamps });
    console.log('Fixed:', d.dealerName, stamps);
    updated++;
  }

  console.log(`Done. Updated ${updated} dealers.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
