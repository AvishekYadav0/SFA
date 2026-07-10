require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Salesperson = require('./src/models/Salesperson');
const Dealer = require('./src/models/Dealer');
const Product = require('./src/models/Product');
const Order = require('./src/models/Order');
const Lifting = require('./src/models/Lifting');
const Collection = require('./src/models/Collection');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  // ── Clean existing data ──────────────────────────
  await Promise.all([
    User.deleteMany({}),
    Salesperson.deleteMany({}),
    Dealer.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
    Lifting.deleteMany({}),
    Collection.deleteMany({}),
  ]);
  console.log('🗑  Cleared existing data');

  // ── Users ────────────────────────────────────────
  const users = await User.create([
    { name: 'Admin User',      email: 'admin@sfa.com',   password: 'admin123',  role: 'admin',  companyName: 'SFA Nepal', isActive: true },
    { name: 'Marketing Staff', email: 'staff@sfa.com',   password: 'staff123',  role: 'staff',  designation: 'Marketing Staff', employeeId: 'EMP-S01', isActive: true },
    { name: 'Sales Executive', email: 'sales@sfa.com',   password: 'sales123',  role: 'staff',  designation: 'Sales Executive',  employeeId: 'EMP-S02', isActive: true },
  ]);
  const admin = users[0];
  console.log('👤 Users created');

  // ── Products ─────────────────────────────────────
  const products = await Product.create([
    { productName: 'Wai Wai Noodles',    brand: 'CG Foods',    category: 'Snacks',    sku: 'WW-001', unit: 'Carton', rate: 1200, excisePercent: 5,  vatPercent: 13, stock: 500, status: 'active', createdBy: admin._id },
    { productName: 'Tuborg Beer 650ml',  brand: 'Carlsberg',   category: 'Beverages', sku: 'TB-001', unit: 'Carton', rate: 2400, excisePercent: 30, vatPercent: 13, stock: 300, status: 'active', createdBy: admin._id },
    { productName: 'Coca Cola 1.5L',     brand: 'Coca Cola',   category: 'Beverages', sku: 'CC-001', unit: 'Carton', rate: 1800, excisePercent: 10, vatPercent: 13, stock: 400, status: 'active', createdBy: admin._id },
    { productName: 'Lays Classic 26g',   brand: 'PepsiCo',     category: 'Snacks',    sku: 'LY-001', unit: 'Box',    rate: 960,  excisePercent: 5,  vatPercent: 13, stock: 600, status: 'active', createdBy: admin._id },
    { productName: 'Surf Excel 1kg',     brand: 'Unilever',    category: 'Household', sku: 'SE-001', unit: 'Carton', rate: 3600, excisePercent: 0,  vatPercent: 13, stock: 200, status: 'active', createdBy: admin._id },
    { productName: 'Dettol Soap 75g',    brand: 'Reckitt',     category: 'Personal Care', sku: 'DT-001', unit: 'Box', rate: 1440, excisePercent: 0, vatPercent: 13, stock: 350, status: 'active', createdBy: admin._id },
    { productName: 'Dairy Milk 50g',     brand: 'Cadbury',     category: 'Snacks',    sku: 'DM-001', unit: 'Box',    rate: 2160, excisePercent: 5,  vatPercent: 13, stock: 250, status: 'active', createdBy: admin._id },
    { productName: 'Sprite 500ml',       brand: 'Coca Cola',   category: 'Beverages', sku: 'SP-001', unit: 'Carton', rate: 1560, excisePercent: 10, vatPercent: 13, stock: 380, status: 'active', createdBy: admin._id },
  ]);
  console.log('📦 Products created');

  // ── Salespersons (one per province) ──────────────
  const spData = [
    { employeeId: 'EMP-001', fullName: 'Rajesh Sharma',    phone: '9841001001', email: 'rajesh@sfa.com',   area: 'Kathmandu',   designation: 'Area Manager' },
    { employeeId: 'EMP-002', fullName: 'Sita Thapa',       phone: '9841002002', email: 'sita@sfa.com',     area: 'Pokhara',     designation: 'Sales Executive' },
    { employeeId: 'EMP-003', fullName: 'Bikash Rai',       phone: '9841003003', email: 'bikash@sfa.com',   area: 'Biratnagar',  designation: 'Senior Sales Executive' },
    { employeeId: 'EMP-004', fullName: 'Sunita Gurung',    phone: '9841004004', email: 'sunita@sfa.com',   area: 'Butwal',      designation: 'Territory Manager' },
    { employeeId: 'EMP-005', fullName: 'Dipak Adhikari',   phone: '9841005005', email: 'dipak@sfa.com',    area: 'Janakpur',    designation: 'Sales Executive' },
    { employeeId: 'EMP-006', fullName: 'Kamala Shrestha',  phone: '9841006006', email: 'kamala@sfa.com',   area: 'Surkhet',     designation: 'Area Manager' },
    { employeeId: 'EMP-007', fullName: 'Nabin Karki',      phone: '9841007007', email: 'nabin@sfa.com',    area: 'Dhangadhi',   designation: 'Regional Manager' },
    { employeeId: 'EMP-008', fullName: 'Priya Maharjan',   phone: '9841008008', email: 'priya@sfa.com',    area: 'Lalitpur',    designation: 'Sales Executive' },
    { employeeId: 'EMP-009', fullName: 'Anil Tamang',      phone: '9841009009', email: 'anil@sfa.com',     area: 'Hetauda',     designation: 'Sales Executive' },
    { employeeId: 'EMP-010', fullName: 'Gita Poudel',      phone: '9841010010', email: 'gita@sfa.com',     area: 'Birgunj',     designation: 'Territory Manager' },
  ];
  const salespersons = await Salesperson.create(spData.map(s => ({ ...s, status: 'active', createdBy: admin._id })));
  console.log('👥 Salespersons created');

  // ── Dealers ───────────────────────────────────────
  const dealerData = [
    { dealerName: 'Kathmandu Traders',    ownerName: 'Ram Bahadur',    phone: '9801001001', area: 'Kathmandu',     province: 'Bagmati Province',       address: 'New Road, Kathmandu',       panNumber: '301001001', openingBalance: 45000,  creditLimit: 200000 },
    { dealerName: 'Lalitpur Distributors', ownerName: 'Shyam Prasad',   phone: '9801002002', area: 'Lalitpur',      province: 'Bagmati Province',       address: 'Patan, Lalitpur',           panNumber: '301002002', openingBalance: 32000,  creditLimit: 150000 },
    { dealerName: 'Bhaktapur Stores',      ownerName: 'Hari Krishna',   phone: '9801003003', area: 'Bhaktapur',     province: 'Bagmati Province',       address: 'Durbar Sq, Bhaktapur',      panNumber: '301003003', openingBalance: 28000,  creditLimit: 120000 },
    { dealerName: 'Pokhara Wholesale',     ownerName: 'Laxmi Devi',     phone: '9801004004', area: 'Pokhara',       province: 'Gandaki Province',       address: 'Lakeside, Pokhara',         panNumber: '301004004', openingBalance: 55000,  creditLimit: 250000 },
    { dealerName: 'Gandaki Suppliers',     ownerName: 'Mohan Gurung',   phone: '9801005005', area: 'Pokhara',       province: 'Gandaki Province',       address: 'Mahendrapool, Pokhara',     panNumber: '301005005', openingBalance: 18000,  creditLimit: 100000 },
    { dealerName: 'Biratnagar Mart',       ownerName: 'Suresh Rai',     phone: '9801006006', area: 'Biratnagar',    province: 'Koshi Province',         address: 'Traffic Chowk, Biratnagar', panNumber: '301006006', openingBalance: 67000,  creditLimit: 300000 },
    { dealerName: 'Koshi Distributors',    ownerName: 'Binod Limbu',    phone: '9801007007', area: 'Dharan',        province: 'Koshi Province',         address: 'BP Chowk, Dharan',          panNumber: '301007007', openingBalance: 41000,  creditLimit: 180000 },
    { dealerName: 'Janakpur Traders',      ownerName: 'Ramesh Yadav',   phone: '9801008008', area: 'Janakpur',      province: 'Madhesh Province',       address: 'Station Road, Janakpur',    panNumber: '301008008', openingBalance: 38000,  creditLimit: 160000 },
    { dealerName: 'Madhesh Wholesale',     ownerName: 'Sanjay Shah',    phone: '9801009009', area: 'Birgunj',       province: 'Madhesh Province',       address: 'Ghantaghar, Birgunj',       panNumber: '301009009', openingBalance: 52000,  creditLimit: 220000 },
    { dealerName: 'Butwal Distributors',   ownerName: 'Prakash Thapa',  phone: '9801010010', area: 'Butwal',        province: 'Lumbini Province',       address: 'Traffic Chowk, Butwal',     panNumber: '301010010', openingBalance: 29000,  creditLimit: 130000 },
    { dealerName: 'Lumbini Traders',       ownerName: 'Santosh Paudel', phone: '9801011011', area: 'Bhairahawa',    province: 'Lumbini Province',       address: 'Siddhartha Nagar',          panNumber: '301011011', openingBalance: 35000,  creditLimit: 150000 },
    { dealerName: 'Surkhet Stores',        ownerName: 'Dil Bahadur',    phone: '9801012012', area: 'Surkhet',       province: 'Karnali Province',       address: 'Birendranagar, Surkhet',    panNumber: '301012012', openingBalance: 22000,  creditLimit: 90000  },
    { dealerName: 'Karnali Suppliers',     ownerName: 'Tek Bahadur',    phone: '9801013013', area: 'Jumla',         province: 'Karnali Province',       address: 'Khalanga, Jumla',           panNumber: '301013013', openingBalance: 15000,  creditLimit: 70000  },
    { dealerName: 'Dhangadhi Wholesale',   ownerName: 'Gopal Bista',    phone: '9801014014', area: 'Dhangadhi',     province: 'Sudurpashchim Province', address: 'Dhangadhi, Kailali',        panNumber: '301014014', openingBalance: 48000,  creditLimit: 200000 },
    { dealerName: 'Sudur Distributors',    ownerName: 'Narayan Chand',  phone: '9801015015', area: 'Mahendranagar', province: 'Sudurpashchim Province', address: 'Mahendranagar, Kanchanpur', panNumber: '301015015', openingBalance: 31000,  creditLimit: 140000 },
  ];
  const dealers = await Dealer.create(dealerData.map(d => ({ ...d, status: 'active', createdBy: admin._id })));
  console.log('🏪 Dealers created');

  // ── Helper: calculate order item ─────────────────
  const calcItem = (product, quantity) => {
    const basic   = quantity * product.rate;
    const excise  = basic * (product.excisePercent / 100);
    const vat     = (basic + excise) * (product.vatPercent / 100);
    const total   = basic + excise + vat;
    return { product: product._id, productName: product.productName, quantity, rate: product.rate, excisePercent: product.excisePercent, vatPercent: product.vatPercent, basicAmount: basic, exciseAmount: excise, vatAmount: vat, grandTotal: total };
  };

  const sumItems = (items) => items.reduce((a, i) => ({
    totalBasicAmount:  a.totalBasicAmount  + i.basicAmount,
    totalExciseAmount: a.totalExciseAmount + i.exciseAmount,
    totalVatAmount:    a.totalVatAmount    + i.vatAmount,
    grandTotal:        a.grandTotal        + i.grandTotal,
  }), { totalBasicAmount: 0, totalExciseAmount: 0, totalVatAmount: 0, grandTotal: 0 });

  // ── Orders (spread across months & provinces) ────
  const orderDefs = [
    // Bagmati
    { sp: 0, dealer: 0, area: 'Kathmandu', items: [[0,50],[1,20],[2,30]], month: 0, status: 'approved' },
    { sp: 7, dealer: 1, area: 'Lalitpur',  items: [[3,80],[4,15],[5,25]], month: 1, status: 'approved' },
    { sp: 8, dealer: 2, area: 'Bhaktapur', items: [[6,40],[7,60]],        month: 2, status: 'approved' },
    { sp: 0, dealer: 0, area: 'Kathmandu', items: [[0,60],[2,40]],        month: 3, status: 'approved' },
    { sp: 7, dealer: 1, area: 'Lalitpur',  items: [[1,25],[3,100]],       month: 4, status: 'approved' },
    // Gandaki
    { sp: 1, dealer: 3, area: 'Pokhara',   items: [[0,70],[1,30],[2,50]], month: 0, status: 'approved' },
    { sp: 1, dealer: 4, area: 'Pokhara',   items: [[3,90],[4,20]],        month: 2, status: 'approved' },
    { sp: 1, dealer: 3, area: 'Pokhara',   items: [[5,35],[6,45],[7,55]], month: 4, status: 'approved' },
    // Koshi
    { sp: 2, dealer: 5, area: 'Biratnagar',items: [[0,80],[1,40],[2,60]], month: 1, status: 'approved' },
    { sp: 2, dealer: 6, area: 'Dharan',    items: [[3,70],[4,25],[5,30]], month: 3, status: 'approved' },
    { sp: 2, dealer: 5, area: 'Biratnagar',items: [[6,50],[7,65]],        month: 5, status: 'approved' },
    // Madhesh
    { sp: 4, dealer: 7, area: 'Janakpur',  items: [[0,45],[2,35],[3,55]], month: 0, status: 'approved' },
    { sp: 9, dealer: 8, area: 'Birgunj',   items: [[1,35],[4,18],[5,22]], month: 2, status: 'approved' },
    { sp: 9, dealer: 8, area: 'Birgunj',   items: [[6,30],[7,40]],        month: 4, status: 'approved' },
    // Lumbini
    { sp: 3, dealer: 9, area: 'Butwal',    items: [[0,55],[1,28],[2,42]], month: 1, status: 'approved' },
    { sp: 3, dealer: 10,area: 'Bhairahawa',items: [[3,65],[4,22],[5,28]], month: 3, status: 'approved' },
    // Karnali
    { sp: 5, dealer: 11,area: 'Surkhet',   items: [[0,30],[2,25],[3,40]], month: 2, status: 'approved' },
    { sp: 5, dealer: 12,area: 'Jumla',     items: [[4,12],[5,15],[6,20]], month: 4, status: 'approved' },
    // Sudurpashchim
    { sp: 6, dealer: 13,area: 'Dhangadhi', items: [[0,40],[1,22],[2,33]], month: 1, status: 'approved' },
    { sp: 6, dealer: 14,area: 'Mahendranagar',items:[[3,50],[4,16],[5,20]],month: 3, status: 'approved' },
    // Pending orders
    { sp: 0, dealer: 0, area: 'Kathmandu', items: [[0,30],[2,20]],        month: 5, status: 'pending' },
    { sp: 1, dealer: 3, area: 'Pokhara',   items: [[1,15],[3,25]],        month: 5, status: 'pending' },
    { sp: 2, dealer: 5, area: 'Biratnagar',items: [[0,20],[4,10]],        month: 5, status: 'pending' },
  ];

  const year = new Date().getFullYear();
  const orders = [];
  for (let i = 0; i < orderDefs.length; i++) {
    const def = orderDefs[i];
    const items = def.items.map(([pi, qty]) => calcItem(products[pi], qty));
    const totals = sumItems(items);
    const count = await Order.countDocuments();
    const order = await Order.create({
      orderNumber: `ORD-${String(count + 1).padStart(5, '0')}`,
      date: new Date(year, def.month, Math.floor(Math.random() * 25) + 1),
      salesperson: salespersons[def.sp]._id,
      dealer: dealers[def.dealer]._id,
      area: def.area,
      province: dealers[def.dealer].province,
      items,
      ...totals,
      status: def.status,
      createdBy: admin._id,
    });
    orders.push(order);
  }
  console.log(`📋 ${orders.length} Orders created`);

  // ── Lifting Plans ─────────────────────────────────
  const approvedOrders = orders.filter(o => o.status === 'approved');
  const liftings = [];
  for (const order of approvedOrders.slice(0, 15)) {
    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
    const w1 = Math.floor(totalQty * 0.3);
    const w2 = Math.floor(totalQty * 0.25);
    const w3 = Math.floor(totalQty * 0.25);
    const w4 = totalQty - w1 - w2 - w3;
    const lifted = await Lifting.create({
      order: order._id,
      orderNumber: order.orderNumber,
      dealer: order.dealer,
      product: order.items[0]?.product,
      productName: order.items[0]?.productName,
      orderedQuantity: totalQty,
      week1: w1, week2: w2, week3: w3, week4: w4,
      month: new Date(year, 0, 1).toLocaleString('default', { month: 'long' }) + ' ' + year,
      year,
      createdBy: admin._id,
    });
    liftings.push(lifted);
  }
  console.log(`🚚 ${liftings.length} Lifting plans created`);

  // ── Collections ───────────────────────────────────
  const collectionDefs = [
    { dealer: 0,  ob: 45000, oa: 185000, w1: 50000, w2: 60000, w3: 55000, w4: 45000 },
    { dealer: 1,  ob: 32000, oa: 142000, w1: 40000, w2: 45000, w3: 42000, w4: 30000 },
    { dealer: 2,  ob: 28000, oa: 98000,  w1: 30000, w2: 35000, w3: 28000, w4: 20000 },
    { dealer: 3,  ob: 55000, oa: 220000, w1: 60000, w2: 70000, w3: 65000, w4: 55000 },
    { dealer: 4,  ob: 18000, oa: 115000, w1: 30000, w2: 35000, w3: 30000, w4: 25000 },
    { dealer: 5,  ob: 67000, oa: 265000, w1: 70000, w2: 80000, w3: 75000, w4: 60000 },
    { dealer: 6,  ob: 41000, oa: 158000, w1: 45000, w2: 50000, w3: 48000, w4: 40000 },
    { dealer: 7,  ob: 38000, oa: 132000, w1: 35000, w2: 40000, w3: 38000, w4: 30000 },
    { dealer: 8,  ob: 52000, oa: 198000, w1: 55000, w2: 60000, w3: 58000, w4: 50000 },
    { dealer: 9,  ob: 29000, oa: 148000, w1: 40000, w2: 45000, w3: 42000, w4: 35000 },
    { dealer: 10, ob: 35000, oa: 162000, w1: 45000, w2: 50000, w3: 48000, w4: 40000 },
    { dealer: 11, ob: 22000, oa: 88000,  w1: 25000, w2: 28000, w3: 25000, w4: 20000 },
    { dealer: 12, ob: 15000, oa: 62000,  w1: 18000, w2: 20000, w3: 18000, w4: 15000 },
    { dealer: 13, ob: 48000, oa: 175000, w1: 50000, w2: 55000, w3: 52000, w4: 45000 },
    { dealer: 14, ob: 31000, oa: 128000, w1: 35000, w2: 40000, w3: 38000, w4: 30000 },
  ];

  const months = ['January','February','March','April','May','June'];
  for (const def of collectionDefs) {
    await Collection.create({
      dealer: dealers[def.dealer]._id,
      dealerName: dealers[def.dealer].dealerName,
      openingBalance: def.ob,
      currentOrderAmount: def.oa,
      week1: def.w1, week2: def.w2, week3: def.w3, week4: def.w4,
      month: months[Math.floor(Math.random() * 6)] + ' ' + year,
      year,
      createdBy: admin._id,
    });
  }
  console.log(`💰 ${collectionDefs.length} Collections created`);

  console.log('\n✅ Seed complete!');
  console.log('─────────────────────────────────');
  console.log('Login credentials:');
  console.log('  Admin:   admin@sfa.com  / admin123');
  console.log('  Staff:   staff@sfa.com  / staff123');
  console.log('  Sales:   sales@sfa.com  / sales123');
  console.log('─────────────────────────────────');
  process.exit(0);
};

seed().catch(err => { console.error('❌ Seed error:', err.message); process.exit(1); });
