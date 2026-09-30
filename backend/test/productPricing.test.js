const assert = require('assert');
const { getEffectiveProductPrice, productMatchesCustomerType } = require('../src/utils/productPricing');

const mmProduct = { productName: 'Test', customerType: 'MM', customerPrice: 120, amount: 110, exciseAmount: 10, vatAmount: 5 };
const adplProduct = { productName: 'Test ADPL', customerType: 'ADPL', customerPrice: 160, amount: 150, exciseAmount: 12, vatAmount: 6 };

assert.strictEqual(getEffectiveProductPrice(mmProduct, 'ADPL'), 120, 'ADPL selection should use the available price even when product tag is MM');
assert.strictEqual(getEffectiveProductPrice(adplProduct, 'ADPL'), 160, 'ADPL product should use its ADPL price');
assert.strictEqual(productMatchesCustomerType(mmProduct, 'ADPL'), true, 'MM-tagged products should remain selectable for ADPL rows when a valid price exists');
assert.strictEqual(productMatchesCustomerType(adplProduct, 'MM'), true, 'ADPL products should also stay available when the selected customer type is MM and a price exists');

console.log('product pricing tests passed');
