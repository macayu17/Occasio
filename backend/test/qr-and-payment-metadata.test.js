import test from 'node:test';
import assert from 'node:assert/strict';
import { getTicketTierIdFromPaymentData, mergePaymentData } from '../src/utils/payment-metadata.util.js';
import {
  buildTicketTierSnapshot,
  calculateDiscountedAmountCents,
  isDiscountUsable,
  normalizeDiscountCode,
  resolveSelectedTicketTier,
} from '../src/utils/registration-pricing.util.js';

process.env.QR_SECRET_KEY = 'test-secret';
const { generateQRPayload, verifyQRSignature } = await import('../src/utils/qr.util.js');

test('QR payloads are HMAC signed and reject tampering', () => {
  const payload = generateQRPayload({
    ticketId: 'ticket-1',
    orderId: 'order-1',
    eventId: 'event-1',
    registrationId: 'registration-1',
  });

  assert.equal(payload.ticketId, 'ticket-1');
  assert.equal(typeof payload.sig, 'string');
  assert.equal(verifyQRSignature(payload), true);
  assert.equal(verifyQRSignature({ ...payload, eventId: 'other-event' }), false);
});

test('QR payload generation requires a ticket id', () => {
  assert.throws(
    () => generateQRPayload({ orderId: 'order-1', eventId: 'event-1' }),
    /ticketId is required/
  );
});

test('QR signing fails closed in production without QR_SECRET_KEY', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalQrSecret = process.env.QR_SECRET_KEY;

  process.env.NODE_ENV = 'production';
  delete process.env.QR_SECRET_KEY;

  try {
    const qr = await import(`../src/utils/qr.util.js?missing-secret=${Date.now()}`);

    assert.throws(
      () => qr.generateQRPayload({
        ticketId: 'ticket-1',
        orderId: 'order-1',
        eventId: 'event-1',
        registrationId: 'registration-1',
      }),
      /QR_SECRET_KEY is required in production/
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalQrSecret) {
      process.env.QR_SECRET_KEY = originalQrSecret;
    } else {
      delete process.env.QR_SECRET_KEY;
    }
  }
});

test('payment metadata merge preserves ticket tier snapshots', () => {
  const merged = mergePaymentData(
    {
      ticketTier: {
        id: 'tier-vip',
        name: 'VIP',
        priceCents: 49900,
      },
    },
    {
      razorpayOrder: {
        id: 'rzp-order-1',
      },
    }
  );

  assert.equal(getTicketTierIdFromPaymentData(merged), 'tier-vip');
  assert.equal(merged.ticketTier.priceCents, 49900);
  assert.equal(merged.razorpayOrder.id, 'rzp-order-1');
});

test('payment metadata helpers tolerate empty or invalid metadata', () => {
  assert.deepEqual(mergePaymentData(null, { phonePe: { transactionId: 'txn-1' } }), {
    phonePe: { transactionId: 'txn-1' },
  });
  assert.equal(getTicketTierIdFromPaymentData(null), null);
  assert.equal(getTicketTierIdFromPaymentData([]), null);
});

test('R2 references are detected and image uploads do not use R2-only memory storage', async () => {
  process.env.R2_ACCOUNT_ID = 'account';
  process.env.R2_ACCESS_KEY_ID = 'access-key';
  process.env.R2_SECRET_ACCESS_KEY = 'secret-key';
  process.env.R2_BUCKET = 'bucket';
  process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';

  const { isR2TemplateRef } = await import('../src/utils/r2.util.js');
  assert.equal(isR2TemplateRef('r2://bucket/certificates/template.pdf'), true);
  assert.equal(isR2TemplateRef('https://account.r2.cloudflarestorage.com/bucket/certificates/template.pdf'), true);
  assert.equal(isR2TemplateRef('https://example.com/template.pdf'), false);

  const { upload, uploadPdf } = await import('../src/middleware/upload.middleware.js?r2-storage-test');
  assert.equal(upload.storage.constructor.name, 'DiskStorage');
  assert.equal(uploadPdf.storage.constructor.name, 'MemoryStorage');
});

test('ticket tier selection rejects missing, unknown, and sold-out tiers', () => {
  const tiers = [
    { id: 'standard', name: 'Standard', priceCents: 25000, capacity: 10, soldCount: 10 },
    { id: 'vip', name: 'VIP', priceCents: 50000, capacity: 5, soldCount: 2 },
  ];

  assert.deepEqual(resolveSelectedTicketTier(tiers, null), {
    selectedTier: null,
    error: 'Ticket tier is required',
    statusCode: 400,
  });
  assert.deepEqual(resolveSelectedTicketTier(tiers, 'missing'), {
    selectedTier: null,
    error: 'Selected ticket tier is not available',
    statusCode: 400,
  });
  assert.deepEqual(resolveSelectedTicketTier(tiers, 'standard'), {
    selectedTier: null,
    error: 'Selected ticket tier is sold out',
    statusCode: 409,
  });

  const result = resolveSelectedTicketTier(tiers, 'vip');
  assert.equal(result.error, null);
  assert.equal(result.selectedTier.id, 'vip');
});

test('ticket tier selection rejects tier ids when event has no tiers', () => {
  assert.deepEqual(resolveSelectedTicketTier([], 'vip'), {
    selectedTier: null,
    error: 'Selected ticket tier is not available',
    statusCode: 400,
  });
  assert.deepEqual(resolveSelectedTicketTier([], null), {
    selectedTier: null,
    error: null,
    statusCode: null,
  });
});

test('discount validation and pricing use cents consistently', () => {
  const now = new Date('2026-05-13T00:00:00.000Z');
  const validPercent = {
    isActive: true,
    type: 'PERCENTAGE',
    amount: 25,
    usedCount: 0,
    maxUses: 2,
    validFrom: new Date('2026-05-01T00:00:00.000Z'),
    validUntil: new Date('2026-05-30T00:00:00.000Z'),
  };
  const validFixed = {
    ...validPercent,
    type: 'FIXED_AMOUNT',
    amount: 10000,
  };

  assert.equal(normalizeDiscountCode(' early_bird '), 'EARLY_BIRD');
  assert.equal(isDiscountUsable(validPercent, now), true);
  assert.equal(calculateDiscountedAmountCents(40000, validPercent), 30000);
  assert.equal(calculateDiscountedAmountCents(40000, validFixed), 30000);
  assert.equal(calculateDiscountedAmountCents(5000, validFixed), 0);
  assert.equal(isDiscountUsable({ ...validPercent, usedCount: 2 }, now), false);
  assert.equal(isDiscountUsable({ ...validPercent, isActive: false }, now), false);
});

test('ticket tier snapshot only includes checkout-safe tier metadata', () => {
  assert.equal(buildTicketTierSnapshot(null), undefined);
  assert.deepEqual(
    buildTicketTierSnapshot({
      id: 'vip',
      name: 'VIP',
      priceCents: 50000,
      capacity: 5,
      soldCount: 2,
      internal: 'ignore-me',
    }),
    {
      ticketTier: {
        id: 'vip',
        name: 'VIP',
        priceCents: 50000,
      },
    }
  );
});
