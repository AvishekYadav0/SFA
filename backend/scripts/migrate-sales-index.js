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

    const nullCount = await collection.countDocuments({ order: null });
    console.log(`Documents with order:null: ${nullCount}`);

    if (nullCount > 0) {
      console.log('Unsetting order field on documents where order is explicitly null...');
      const result = await collection.updateMany({ order: null }, { $unset: { order: '' } });
      console.log(`Updated ${result.modifiedCount} documents.`);
    } else {
      console.log('No documents with order:null found.');
    }

    const indexes = await collection.indexes();
    console.log('Current indexes before changes:', indexes.map(idx => ({ name: idx.name, key: idx.key, partialFilterExpression: idx.partialFilterExpression })));

    const orderIndex = indexes.find(idx => idx.name === 'order_1');
    if (orderIndex) {
      console.log('Dropping existing order_1 index...');
      await collection.dropIndex('order_1');
      console.log('Dropped order_1 index.');
    } else {
      console.log('No order_1 index found.');
    }

    console.log('Creating new partial unique index on order...');
    await collection.createIndex(
      { order: 1 },
      {
        unique: true,
        partialFilterExpression: { order: { $type: 'objectId' } },
        name: 'sale_order_unique_partial',
      }
    );
    console.log('Created new partial unique index on order.');

    const finalIndexes = await collection.indexes();
    console.log('Final indexes:', finalIndexes.map(idx => ({ name: idx.name, key: idx.key, partialFilterExpression: idx.partialFilterExpression })));
  } catch (err) {
    console.error('Migration failed:', err);
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
