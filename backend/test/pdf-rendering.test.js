import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { normalizeCertificateMapping } from '../src/services/certificate.service.js';
import { buildTicketRenderModel, renderTicketPDFBuffer } from '../src/services/ticket.service.js';

const sampleEvent = {
  id: 'event-1',
  title: 'Occasio Launch Night',
  location: 'The Grand Hall, Bengaluru',
  startTime: new Date('2026-08-15T12:00:00.000Z'),
  endTime: new Date('2026-08-15T15:00:00.000Z'),
  currency: 'INR',
  ticketStyle: {
    primaryColor: '#E23744',
    accentColor: '#fff4e6',
    backgroundColor: '#070707',
  },
};

const sampleOrder = {
  id: 'order-1',
  amountCents: 49900,
  currency: 'INR',
  registrationId: 'registration-1',
  paymentData: {
    ticketTier: {
      id: 'tier-vip',
      name: 'VIP Access',
      priceCents: 49900,
    },
  },
  registration: {
    userEmail: 'aarav@example.com',
    formResponse: {
      name: 'Aarav Mehta',
      email: 'aarav@example.com',
      phone: '9999999999',
    },
    event: sampleEvent,
  },
};

const sampleTicket = {
  id: '91ce8539-087b-4abc-9a9a-de0448669607',
  qrPayload: JSON.stringify({ ticketId: '91ce8539-087b-4abc-9a9a-de0448669607', sig: 'signed' }),
  issuedAt: new Date('2026-07-20T10:00:00.000Z'),
};

test('certificate generation uses a sensible default mapping when no fields are placed', () => {
  const mapping = normalizeCertificateMapping([]);

  assert.deepEqual(
    mapping.map((field) => field.fieldId),
    ['certificateType', 'userName', 'eventName', 'date', 'qrCode']
  );
  assert.equal(mapping.find((field) => field.fieldId === 'userName').bold, true);
  assert.equal(mapping.find((field) => field.fieldId === 'userName').fontSize > 24, true);
});

test('ticket render model exposes polished pass metadata', () => {
  const model = buildTicketRenderModel(sampleOrder, sampleTicket);

  assert.equal(model.brand, 'Occasio');
  assert.equal(model.attendeeName, 'Aarav Mehta');
  assert.equal(model.attendeeEmail, 'aarav@example.com');
  assert.equal(model.ticketCode, '91CE8539');
  assert.equal(model.tierName, 'VIP Access');
  assert.equal(model.priceLabel, 'INR 499');
  assert.match(model.dateLabel, /Sat, 15 Aug 2026/);
});

test('ticket renderer creates a substantial one-page branded PDF without database access', async () => {
  const buffer = await renderTicketPDFBuffer(sampleOrder, sampleTicket);
  const pdf = await PDFDocument.load(buffer);

  assert.equal(buffer.slice(0, 4).toString(), '%PDF');
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(buffer.length > 18000, true);
});
