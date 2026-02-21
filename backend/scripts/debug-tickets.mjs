import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const tickets = await p.ticket.findMany({
  take: 10,
  include: { order: { include: { registration: { select: { eventId: true } } } } }
});

for (const t of tickets) {
  const qr = JSON.parse(t.qrPayload || '{}');
  console.log(JSON.stringify({
    id: t.id,
    short: t.id.substring(0, 8).toUpperCase(),
    orderId: t.orderId,
    eventId: t.order.registration.eventId,
    qrTicketId: qr.ticketId,
    qrMatch: qr.ticketId === t.id,
    qrHasSig: !!qr.sig,
    pdfUrl: (t.ticketPdfUrl || '').substring(0, 60),
    checkedIn: !!t.checkedInAt,
    scannedAt: !!t.scannedAt
  }));
}

await p.$disconnect();
