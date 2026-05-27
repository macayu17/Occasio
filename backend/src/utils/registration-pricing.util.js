export const normalizeDiscountCode = (code) => {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
};

export const resolveSelectedTicketTier = (ticketTiers = [], tierId = null) => {
  if (ticketTiers.length > 0) {
    if (!tierId) {
      return { error: 'Ticket tier is required', statusCode: 400, selectedTier: null };
    }

    const selectedTier = ticketTiers.find((tier) => tier.id === tierId);
    if (!selectedTier) {
      return { error: 'Selected ticket tier is not available', statusCode: 400, selectedTier: null };
    }

    if (selectedTier.capacity && selectedTier.soldCount >= selectedTier.capacity) {
      return { error: 'Selected ticket tier is sold out', statusCode: 409, selectedTier: null };
    }

    return { selectedTier, error: null, statusCode: null };
  }

  if (tierId) {
    return { error: 'Selected ticket tier is not available', statusCode: 400, selectedTier: null };
  }

  return { selectedTier: null, error: null, statusCode: null };
};

export const isDiscountUsable = (discount, now = new Date()) => {
  return Boolean(
    discount &&
    discount.isActive &&
    (!discount.validFrom || discount.validFrom <= now) &&
    (!discount.validUntil || discount.validUntil >= now) &&
    (!discount.maxUses || discount.usedCount < discount.maxUses)
  );
};

export const calculateDiscountedAmountCents = (baseAmountCents, discount) => {
  if (!discount) return baseAmountCents;

  if (discount.type === 'PERCENTAGE') {
    return Math.max(0, Math.round(baseAmountCents * (1 - discount.amount / 100)));
  }

  return Math.max(0, baseAmountCents - discount.amount);
};

export const buildTicketTierSnapshot = (tier) => {
  if (!tier) return undefined;

  return {
    ticketTier: {
      id: tier.id,
      name: tier.name,
      priceCents: tier.priceCents
    }
  };
};
