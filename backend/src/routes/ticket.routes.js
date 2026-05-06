import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../config/db.js';
import { verifyQRSignature } from '../utils/qr.util.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { getR2ObjectBuffer, isR2TemplateRef } from '../utils/r2.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const debugTicketVerify = (...args) => {
  if (process.env.DEBUG_TICKET_VERIFY === 'true') {
    console.log(...args);
  }
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TICKET_PREFIX_PATTERN = /^[0-9a-f]{6,12}$/i;

const ticketLookupSelect = `
  SELECT
    t.id,
    t.order_id AS "orderId",
    t.qr_payload AS "qrPayload",
    t.issued_at AS "issuedAt",
    t.revoked,
    t.valid_until AS "validUntil",
    t.scanned_at AS "scannedAt",
    t.checked_in_at AS "checkedInAt",
    r.form_response AS "formResponse",
    e.id AS "eventId",
    e.title AS "eventTitle",
    e.location AS "eventLocation",
    e.start_time AS "eventStartTime",
    e.organizer_id AS "organizerId"
  FROM tickets t
  INNER JOIN orders o ON o.id = t.order_id
  INNER JOIN registrations r ON r.id = o.registration_id
  INNER JOIN events e ON e.id = r.event_id
`;

function mapTicketRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    orderId: row.orderId,
    qrPayload: row.qrPayload,
    issuedAt: row.issuedAt,
    revoked: row.revoked,
    validUntil: row.validUntil,
    scannedAt: row.scannedAt,
    checkedInAt: row.checkedInAt,
    order: {
      registration: {
        formResponse: row.formResponse,
        event: {
          id: row.eventId,
          title: row.eventTitle,
          location: row.eventLocation,
          startTime: row.eventStartTime,
          organizerId: row.organizerId
        }
      }
    }
  };
}

async function canScanTicket(user, event) {
  if (user.role === 'ADMIN') {
    return { hasAccess: true };
  }

  if (event.organizerId === user.id) {
    return { hasAccess: true };
  }

  const teamMember = await prisma.teamMember.findUnique({
    where: { eventId_email: { eventId: event.id, email: user.email } },
    select: { role: true }
  });

  if (!teamMember) {
    return { hasAccess: false, error: 'Not authorized' };
  }

  if (!['SUPER_MANAGER', 'MANAGER', 'SCANNER'].includes(teamMember.role)) {
    return { hasAccess: false, error: 'Insufficient permissions' };
  }

  return { hasAccess: true };
}

const toNormalizedPayload = (input) => {
  if (!input) return null;

  let parsed = null;

  if (typeof input === 'object') {
    parsed = input;
  } else {
    const raw = String(input).trim();

    const parseJsonSafe = (value) => {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    parsed = parseJsonSafe(raw);

    if (!parsed) {
      const decoded = (() => {
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      })();
      parsed = parseJsonSafe(decoded);
    }

    if (!parsed) {
      const b64 = (() => {
        try {
          return Buffer.from(raw, 'base64').toString('utf8');
        } catch {
          return null;
        }
      })();
      if (b64) parsed = parseJsonSafe(b64);
    }

    if (!parsed && raw.startsWith('http')) {
      try {
        const url = new URL(raw);
        const q = url.searchParams.get('qrPayload') || url.searchParams.get('payload') || url.searchParams.get('data');
        if (q) {
          const qDecoded = (() => {
            try {
              return decodeURIComponent(q);
            } catch {
              return q;
            }
          })();
          parsed = parseJsonSafe(qDecoded) || parseJsonSafe(Buffer.from(qDecoded, 'base64').toString('utf8'));
        }
      } catch {
      }
    }

    if (typeof parsed === 'string') {
      parsed = parseJsonSafe(parsed) || null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;

  return {
    ticketId: parsed.ticketId || parsed.ticket_id || parsed.id || null,
    orderId: parsed.orderId || parsed.order_id || null,
    eventId: parsed.eventId || parsed.event_id || null,
    registrationId: parsed.registrationId || parsed.registration_id || null,
    issuedAt: parsed.issuedAt || parsed.issued_at || null,
    sig: parsed.sig || parsed.signature || null,
  };
};

// Helper: find ticket by full ID or partial (first 8 chars) prefix
async function findTicketByIdOrPrefix(ticketId) {
  if (!ticketId) return null;
  const cleaned = ticketId.trim().toLowerCase();
  const isFullId = UUID_PATTERN.test(cleaned);
  const isPrefix = TICKET_PREFIX_PATTERN.test(cleaned);

  if (!isFullId && !isPrefix) {
    return null;
  }

  // Try exact match first
  if (isFullId) {
    const rows = await prisma.$queryRawUnsafe(`${ticketLookupSelect} WHERE t.id = $1 LIMIT 1`, cleaned);
    const ticket = mapTicketRow(rows[0]);
    if (ticket) return ticket;
  }

  // Try prefix match (short IDs like "2FBF033A" → first 8 chars of UUID)
  if (isPrefix) {
    const rows = await prisma.$queryRawUnsafe(`${ticketLookupSelect} WHERE t.id LIKE $1 LIMIT 1`, `${cleaned}%`);
    const ticket = mapTicketRow(rows[0]);
    if (ticket) return ticket;
  }

  return null;
}

// Verify ticket (for scanning at venue) - uses JWT-only auth for fast gate checks.
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { qrPayload } = req.body;

    if (!qrPayload) {
      return res.status(400).json({ error: 'QR payload required' });
    }

    debugTicketVerify('[verify] Raw qrPayload type:', typeof qrPayload, 'length:', String(qrPayload).length);

    // Parse QR payload (supports JSON, URL-encoded JSON, base64 JSON, URL query payloads)
    const payload = toNormalizedPayload(qrPayload);

    let ticket = null;

    if (payload && payload.ticketId) {
      debugTicketVerify('[verify] Parsed ticketId:', payload.ticketId);
      ticket = await findTicketByIdOrPrefix(payload.ticketId);
    }

    // Fallback: treat raw qrPayload as a plain ticket ID string
    if (!ticket && typeof qrPayload === 'string') {
      const rawId = qrPayload.trim().replace(/^\uFEFF/, '').replace(/[^a-fA-F0-9-]/g, '');
      if (rawId.length >= 6) {
        debugTicketVerify('[verify] Trying raw string as ticketId:', rawId);
        ticket = await findTicketByIdOrPrefix(rawId);
      }
    }

    if (!ticket) {
      debugTicketVerify('[verify] Ticket not found for payload:', JSON.stringify(payload));
      return res.status(404).json({
        valid: false,
        error: 'Ticket not found'
      });
    }

    debugTicketVerify('[verify] Found ticket:', ticket.id);

    // Signature verification — multiple fallback strategies
    let storedPayload = null;
    try { storedPayload = JSON.parse(ticket.qrPayload || '{}'); } catch (e) { /* ignore */ }

    const matchesStoredPayload = Boolean(
      storedPayload && payload &&
      payload.ticketId === storedPayload.ticketId &&
      payload.orderId === storedPayload.orderId &&
      payload.eventId === storedPayload.eventId &&
      payload.sig === storedPayload.sig
    );

    const matchesTicketIdentity = Boolean(
      ticket && payload &&
      ((payload.ticketId === ticket.id) || ticket.id.startsWith(payload.ticketId || '___')) &&
      (payload.orderId === ticket.orderId || !payload.orderId) &&
      (payload.eventId === ticket.order.registration.event.id || !payload.eventId)
    );

    const isDev = process.env.NODE_ENV !== 'production';
    const hasValidHmac = payload ? verifyQRSignature(payload) : false;
    // In dev mode ALWAYS valid; in production accept any valid fallback
    const isValid = isDev ? true : (hasValidHmac || matchesStoredPayload || matchesTicketIdentity);

    debugTicketVerify('[verify] Sig check:', { isDev, hasValidHmac, matchesStoredPayload, matchesTicketIdentity, isValid });

    if (!isValid) {
      return res.status(400).json({
        valid: false,
        error: 'Invalid ticket signature'
      });
    }

    // Check if user has access to scan this event's tickets
    const event = ticket.order.registration.event;
    const accessCheck = await canScanTicket(req.user, event);

    if (!accessCheck.hasAccess) {
      return res.status(403).json({
        valid: false,
        error: 'You do not have permission to scan tickets for this event'
      });
    }

    // Check if revoked
    if (ticket.revoked) {
      return res.status(400).json({
        valid: false,
        error: 'Ticket has been revoked'
      });
    }

    // Expiry check: allow a 24-hour grace period AFTER event end
    if (ticket.validUntil) {
      const graceEnd = new Date(ticket.validUntil.getTime() + 24 * 60 * 60 * 1000);
      if (new Date() > graceEnd) {
        return res.status(400).json({
          valid: false,
          error: 'Ticket has expired'
        });
      }
    }

    // Check if already scanned
    if (ticket.scannedAt || ticket.checkedInAt) {
      return res.status(400).json({
        valid: false,
        alreadyScanned: true,
        error: 'Ticket already used',
        scannedAt: ticket.scannedAt || ticket.checkedInAt,
        attendee: ticket.order.registration.formResponse
      });
    }

    // Mark ticket as scanned (set both fields for compatibility)
    const now = new Date();
    const updateResult = await prisma.ticket.updateMany({
      where: {
        id: ticket.id,
        scannedAt: null,
        checkedInAt: null
      },
      data: {
        scannedAt: now,
        checkedInAt: now,
        checkedInBy: req.user.id
      }
    });

    if (updateResult.count === 0) {
      const currentTicket = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { scannedAt: true, checkedInAt: true }
      });

      return res.status(400).json({
        valid: false,
        alreadyScanned: true,
        error: 'Ticket already used',
        scannedAt: currentTicket?.scannedAt || currentTicket?.checkedInAt || now,
        attendee: ticket.order.registration.formResponse
      });
    }

    res.json({
      valid: true,
      ticket: {
        id: ticket.id,
        event: {
          title: ticket.order.registration.event.title,
          location: ticket.order.registration.event.location,
          startTime: ticket.order.registration.event.startTime
        },
        attendee: ticket.order.registration.formResponse,
        issuedAt: ticket.issuedAt
      }
    });
  } catch (error) {
    console.error('Verify ticket error:', error);
    res.status(500).json({ error: 'Verification failed: ' + error.message });
  }
});

// Download ticket PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!ticket.ticketPdfUrl) {
      return res.status(404).json({ error: 'Ticket PDF not generated yet' });
    }

    const pdfRef = ticket.ticketPdfUrl;

    if (isR2TemplateRef(pdfRef)) {
      const pdfBuffer = await getR2ObjectBuffer(pdfRef);
      const filename = `ticket-${id.substring(0, 8)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(pdfBuffer);
    }

    if (!pdfRef.startsWith('http')) {
      const localPath = pdfRef.startsWith('/uploads/')
        ? path.join(__dirname, '../../', pdfRef)
        : path.join(__dirname, '../../uploads/', pdfRef);

      if (!fs.existsSync(localPath)) {
        return res.status(404).json({ error: 'Ticket PDF file not found' });
      }

      return res.sendFile(localPath);
    }

    return res.redirect(pdfRef);
  } catch (error) {
    console.error('Download ticket error:', error);
    res.status(500).json({ error: 'Failed to download ticket' });
  }
});

// Download ticket by Order ID - generates PDF fresh and streams it
import { generateTicketPDFBuffer } from '../services/ticket.service.js';

router.get('/order/:orderId/download', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order with all required data
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        registration: {
          include: { event: true }
        }
      }
    });

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Generate PDF buffer directly (skip Cloudinary for downloads)
    console.log(`Generating PDF for download, order: ${orderId}`);
    const pdfBuffer = await generateTicketPDFBuffer(order);

    // Set headers for PDF download
    const filename = `ticket-${orderId.substring(0, 8)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send the PDF buffer directly
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Download ticket by order error:', error);
    res.status(500).send('Failed to generate ticket PDF');
  }
});

export default router;
