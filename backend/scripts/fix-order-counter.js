require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set in environment (.env).');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;

  console.log('Connected to MongoDB');

  // 1) Find duplicate orderNumbers
  const dupAgg = [
    { $group: { _id: '$orderNumber', count: { $sum: 1 }, ids: { $push: { _id: '$_id', createdAt: '$createdAt' } } } },
    { $match: { _id: { $ne: null }, count: { $gt: 1 } } }
  ];

  const duplicates = await db.collection('orders').aggregate(dupAgg).toArray();
  if (duplicates.length === 0) {
    console.log('No duplicate orderNumber values found.');
  } else {
    console.log(`Found ${duplicates.length} duplicated orderNumber(s). Removing duplicates (keeping oldest by createdAt)...`);
    for (const d of duplicates) {
      // sort ids by createdAt ascending and keep the first
      const sorted = d.ids.sort((a,b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      const keepId = sorted[0]._id;
      const removeIds = sorted.slice(1).map(x => x._id);
      const delRes = await db.collection('orders').deleteMany({ _id: { $in: removeIds } });
      console.log(`OrderNumber=${d._id}: removed ${delRes.deletedCount} duplicate docs`);
    }
  }

  // 2) Compute max numeric suffix of existing orderNumber values like ORD-00027
  const agg = [
    { $match: { orderNumber: { $regex: '^ORD-\\d{1,}$' } } },
    { $project: { n: { $toInt: { $substr: [ '$orderNumber', 4, 10 ] } } } },
    { $group: { _id: null, max: { $max: '$n' } } }
  ];

  const arr = await db.collection('orders').aggregate(agg).toArray();
  const max = (arr[0] && arr[0].max) ? arr[0].max : 0;
  console.log('Max existing ORD- number is', max);

  // 3) Update counters collection
  const up = await db.collection('counters').updateOne({ _id: 'orderNumber' }, { $set: { seq: max } }, { upsert: true });
  console.log('Updated counters.orderNumber to', max);

  // 4) Ensure unique index exists on orderNumber
  try {
    await db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true });
    console.log('Ensured unique index on orders.orderNumber');
  } catch (err) {
    console.error('Failed to create unique index on orders.orderNumber:', err.message);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error('Migration failed:', err); process.exit(1); });
