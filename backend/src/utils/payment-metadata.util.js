const asPlainObject = (value) => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

export const mergePaymentData = (existing, updates) => ({
  ...asPlainObject(existing),
  ...asPlainObject(updates),
});

export const getTicketTierIdFromPaymentData = (paymentData) => {
  return asPlainObject(paymentData).ticketTier?.id || null;
};
