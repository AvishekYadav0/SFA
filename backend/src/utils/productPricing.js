function getEffectiveProductPrice(product) {
  if (!product) return 0;
  const customerPrice = Number(product.customerPrice);
  if (Number.isFinite(customerPrice) && customerPrice > 0) return customerPrice;
  const amount = Number(product.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function productMatchesCustomerType(product, customerType) {
  return Boolean(String(customerType || '').trim()) && getEffectiveProductPrice(product) > 0;
}

module.exports = { getEffectiveProductPrice, productMatchesCustomerType };