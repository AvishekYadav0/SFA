require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../src/models/Product');

const products = [
  { productName: 'Point 86 Vodka 750ML', ml: '750ml', up: '40', amount: 9974.071, customerPrice: 9974.071, exciseAmount: 11610, vatAmount: 2805.929 },
  { productName: 'Point 86 Vodka 375ML', ml: '375ml', up: '40', amount: 9974.071, customerPrice: 9974.071, exciseAmount: 11610, vatAmount: 2805.929 },
  { productName: 'Point 86 Vodka 180ML', ml: '180ml', up: '40', amount: 10438.471, customerPrice: 10438.471, exciseAmount: 11145.6, vatAmount: 2805.929 },

  { productName: 'VISA BLACK 750ML', ml: '750ml', up: '40', amount: 4860.796, customerPrice: 4860.796, exciseAmount: 6210, vatAmount: 1439.204 },
  { productName: 'VISA BLACK 375ML', ml: '375ml', up: '40', amount: 4860.796, customerPrice: 4860.796, exciseAmount: 6210, vatAmount: 1439.204 },
  { productName: 'VISA BLACK 180ML', ml: '180ml', up: '40', amount: 5109.196, customerPrice: 5109.196, exciseAmount: 5961.6, vatAmount: 1439.204 },

  { productName: 'Limpiya 750ML', ml: '750ml', up: '40', amount: 4834.248, customerPrice: 4834.248, exciseAmount: 6210, vatAmount: 1435.752 },
  { productName: 'Limpiya 375ML', ml: '375ml', up: '40', amount: 4834.248, customerPrice: 4834.248, exciseAmount: 6210, vatAmount: 1435.752 },
  { productName: 'Limpiya 180ML', ml: '180ml', up: '40', amount: 5082.648, customerPrice: 5082.648, exciseAmount: 5961.6, vatAmount: 1435.752 },

  { productName: 'Iconic 750ML', ml: '750ml', up: '40', amount: 4320.973, customerPrice: 4320.973, exciseAmount: 6210, vatAmount: 1369.027 },
  { productName: 'Iconic 375ML', ml: '375ml', up: '40', amount: 4320.973, customerPrice: 4320.973, exciseAmount: 6210, vatAmount: 1369.027 },
  { productName: 'Iconic 180ML', ml: '180ml', up: '40', amount: 4569.373, customerPrice: 4569.373, exciseAmount: 5961.6, vatAmount: 1369.027 },

  { productName: 'Platoon 750ML', ml: '750ml', up: '40', amount: 3613.009, customerPrice: 3613.009, exciseAmount: 6210, vatAmount: 1276.991 },
  { productName: 'Platoon 375ML', ml: '375ml', up: '40', amount: 3613.009, customerPrice: 3613.009, exciseAmount: 6210, vatAmount: 1276.991 },
  { productName: 'Platoon 180ML', ml: '180ml', up: '40', amount: 3861.409, customerPrice: 3861.409, exciseAmount: 5961.6, vatAmount: 1276.991 },

  { productName: 'Royal Antler 750ML', ml: '750ml', up: '40', amount: 3613.009, customerPrice: 3613.009, exciseAmount: 6210, vatAmount: 1276.991 },
  { productName: 'Royal Antler 375ML', ml: '375ml', up: '40', amount: 3613.009, customerPrice: 3613.009, exciseAmount: 6210, vatAmount: 1276.991 },
  { productName: 'Royal Antler 180ML', ml: '180ml', up: '40', amount: 3861.409, customerPrice: 3861.409, exciseAmount: 5961.6, vatAmount: 1276.991 },

  { productName: 'Swift White 180ML', ml: '180ml', up: '50', amount: 2261.975, customerPrice: 2261.975, exciseAmount: 4233.6, vatAmount: 844.425 },
  { productName: 'Swift Premium 180ML', ml: '180ml', up: '50', amount: 2261.975, customerPrice: 2261.975, exciseAmount: 4233.6, vatAmount: 844.425 },
  { productName: 'Amrit Quality 180ML', ml: '180ml', up: '50', amount: 2138.081, customerPrice: 2138.081, exciseAmount: 4233.6, vatAmount: 828.319 },
  { productName: 'Swift Apple 180ML', ml: '180ml', up: '50', amount: 1784.099, customerPrice: 1784.099, exciseAmount: 4233.6, vatAmount: 782.301 },
  { productName: 'Swift Red 180ML', ml: '180ml', up: '50', amount: 1784.099, customerPrice: 1784.099, exciseAmount: 4233.6, vatAmount: 782.301 },
  { productName: 'STS Premium 180ML', ml: '180ml', up: '50', amount: 1961.09, customerPrice: 1961.09, exciseAmount: 4233.6, vatAmount: 805.31 },
  { productName: 'Viewer Premium 180ML', ml: '180ml', up: '50', amount: 1961.09, customerPrice: 1961.09, exciseAmount: 4233.6, vatAmount: 805.31 },
  { productName: 'Blue Drops 180ML', ml: '180ml', up: '50', amount: 1784.099, customerPrice: 1784.099, exciseAmount: 4233.6, vatAmount: 782.301 },
  { productName: 'Metron 180ML', ml: '180ml', up: '50', amount: 1784.099, customerPrice: 1784.099, exciseAmount: 4233.6, vatAmount: 782.301 },
  { productName: 'STS No 1 180ML', ml: '180ml', up: '50', amount: 1784.099, customerPrice: 1784.099, exciseAmount: 4233.6, vatAmount: 782.301 },
  { productName: 'Viewer Regular 180ML', ml: '180ml', up: '50', amount: 1784.099, customerPrice: 1784.099, exciseAmount: 4233.6, vatAmount: 782.301 },
  { productName: 'Gelatin 180ML', ml: '180ml', up: '50', amount: 1784.099, customerPrice: 1784.099, exciseAmount: 4233.6, vatAmount: 782.301 },

  { productName: 'YUZU 300ML', ml: '300ml', up: '70', amount: 2468.85, customerPrice: 2468.85, exciseAmount: 540, vatAmount: 391.15 },
  { productName: 'Mahakali Flavour 300ML', ml: '300ml', up: '70', amount: 654.69, customerPrice: 654.69, exciseAmount: 540, vatAmount: 155.31 },
  { productName: 'Mahakali New Pinch 300ML', ml: '300ml', up: '70', amount: 654.69, customerPrice: 654.69, exciseAmount: 540, vatAmount: 155.31 },
  { productName: 'Mahakali Extra Dry 300ML', ml: '300ml', up: '70', amount: 566.195, customerPrice: 566.195, exciseAmount: 540, vatAmount: 143.805 },
  { productName: 'Mahakali Premium 300ML', ml: '300ml', up: '70', amount: 566.195, customerPrice: 566.195, exciseAmount: 540, vatAmount: 143.805 },
  { productName: 'Morepyari 300ML', ml: '300ml', up: '70', amount: 521.947, customerPrice: 521.947, exciseAmount: 540, vatAmount: 138.053 },
  { productName: 'Lovely 300ML', ml: '300ml', up: '70', amount: 1398.053, customerPrice: 1398.053, exciseAmount: 540, vatAmount: 251.947 },
  { productName: 'Mahakali Plain 300ML', ml: '300ml', up: '70', amount: 521.947, customerPrice: 521.947, exciseAmount: 540, vatAmount: 138.053 },
  { productName: 'Mahakali Orange 300ML', ml: '300ml', up: '70', amount: 499.823, customerPrice: 499.823, exciseAmount: 540, vatAmount: 135.177 },
  { productName: 'Mahakali Litchi 300ML', ml: '300ml', up: '70', amount: 499.823, customerPrice: 499.823, exciseAmount: 540, vatAmount: 135.177 },
  { productName: 'Mahakali Apple 300ML', ml: '300ml', up: '70', amount: 499.823, customerPrice: 499.823, exciseAmount: 540, vatAmount: 135.177 },
];

const seedADPLProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const mapped = products.map(item => ({
      ...item,
      up: item.up || '',
      customerType: 'ADPL',
      status: 'Active',
    }));

    await Product.deleteMany({ customerType: 'ADPL' });
    const result = await Product.insertMany(mapped);
    console.log(`Inserted ${result.length} ADPL products.`);
  } catch (error) {
    console.error('Seed failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    mongoose.disconnect();
  }
};

seedADPLProducts();
