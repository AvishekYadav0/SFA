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

  try {
    const collection = db.collection('sales');
    const indexes = await collection.indexes();
    const orderIndex = indexes.find(idx => idx.name === 'order_1');

    if (orderIndex) {
      console.log('Found old order_1 index. Dropping it...');
      await collection.dropIndex('order_1');
      console.log('Dropped order_1 index.');
    } else {
      console.log('No old order_1 index found.');
    }

    console.log('Creating partial unique index on order field.');
    await collection.createIndex(
      { order: 1 },
      {
        unique: true,
        partialFilterExpression: { order: { $exists: true, $ne: null } },
        name: 'sale_order_unique_partial',
      }
    );
    console.log('Created partial unique index on order.');
  } catch (err) {
    console.error('Failed to repair sale order index:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
