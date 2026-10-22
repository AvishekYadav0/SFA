const assert = require('node:assert/strict');
const { calculateDiscount } = require('../src/utils/discountPricing');

assert.deepEqual(calculateDiscount(100, 0), {
  discountPercent: 0,
  discountAmount: 0,
  grandTotal: 100,
});

assert.deepEqual(calculateDiscount(100, 12.5), {
  discountPercent: 12.5,
  discountAmount: 12.5,
  grandTotal: 87.5,
});

assert.deepEqual(calculateDiscount(100, 100), {
  discountPercent: 100,
  discountAmount: 100,
  grandTotal: 0,
});

assert.deepEqual(calculateDiscount(100.01, 10), {
  discountPercent: 10,
  discountAmount: 10,
  grandTotal: 90.01,
});

for (const invalidPercent of [-0.01, 100.01, Number.NaN]) {
  assert.throws(() => calculateDiscount(100, invalidPercent), /between 0 and 100/);
}

assert.throws(() => calculateDiscount(-1, 10), /non-negative number/);
console.log('Discount pricing tests passed.');
