function calculateDiscount(total, discountPercent = 0) {
  const amount = Number(total);
  const percent = Number(discountPercent ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Discount base amount must be a non-negative number.');
  }
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Discount percentage must be between 0 and 100.');
  }

  const discountAmount = Math.round((amount * percent / 100) * 100) / 100;
  return {
    discountPercent: percent,
    discountAmount,
    grandTotal: Math.max(0, Math.round((amount - discountAmount) * 100) / 100),
  };
}

module.exports = { calculateDiscount };
