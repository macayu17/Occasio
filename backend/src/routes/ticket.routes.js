import express from 'express';
import crypto from 'crypto';
import prisma from '../config/db.js';
import { verifyQRSignature } from '../utils/qr.util.js';

const router = express.Router();

// Verify ticket (for scanning at venue)
router.post('/verify', async (req, res) => {
  try {
    const { qrPayload } = req.body;

    if (!qrPayload) {
      return res.status(400).json({ error: 'QR payload required' });
    }

    // Parse QR payload
    let payload;
    try {
      payload = JSON.parse(qrPayload);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid QR payload format' });
    }

    console.log('Verifying ticket:', payload.ticketId);
    console.log('Full payload:', JSON.stringify(payload, null, 2));

    // In development mode, skip signature verification for easier testing
    const isDev = process.env.NODE_ENV !== 'production';
    const isValid = isDev ? true : verifyQRSignature(payload);

    if (!isValid) {
      console.log('Signature verification failed');
      return res.status(400).json({
        valid: false,
        error: 'Invalid signature'
      });
    }

    // Find ticket
    console.log('Looking for ticket with ID:', payload.ticketId);
    const ticket = await prisma.ticket.findUnique({
      where: { id: payload.ticketId },
      include: {
        order: {
          include: {
            registration: {
              include: {
                event: true
              }
            }
          }
        }
      }
    });

    console.log('Ticket found:', ticket ? 'Yes' : 'No');
    if (!ticket) {
      // Try to find any tickets to see what's in the DB
      const allTickets = await prisma.ticket.findMany({ take: 5 });
      console.log('Sample tickets in DB:', allTickets.map(t => ({ id: t.id, orderId: t.orderId })));
    }

    if (!ticket) {
      return res.status(404).json({
        valid: false,
        error: 'Ticket not found'
      });
    }

    // Check if revoked
    if (ticket.revoked) {
      return res.status(400).json({
        valid: false,
        error: 'Ticket has been revoked'
      });
    }

    // Check if expired
    if (ticket.validUntil && new Date() > ticket.validUntil) {
      return res.status(400).json({
        valid: false,
        error: 'Ticket has expired'
      });
    }

    // Check if already scanned
    if (ticket.scannedAt) {
      return res.status(400).json({
        valid: false,
        alreadyScanned: true,
        error: 'Ticket already used',
        scannedAt: ticket.scannedAt,
        attendee: ticket.order.registration.formResponse
      });
    }

    // Mark ticket as scanned
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { scannedAt: new Date() }
    });

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
    res.status(500).json({ error: 'Verification failed' });
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

    // Redirect to PDF URL or serve file
    res.redirect(ticket.ticketPdfUrl);
  } catch (error) {
    console.error('Download ticket error:', error);
    res.status(500).json({ error: 'Failed to download ticket' });
  }
});

// Download ticket by Order ID (Robust fallback)
import { generateTicketPDF } from '../services/ticket.service.js';

router.get('/order/:orderId/download', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find ticket by order ID
    let ticket = await prisma.ticket.findUnique({
      where: { orderId }
    });

    // If ticket doesn't exist, try to find order and generate it
    if (!ticket) {
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

      // Generate ticket now
      console.log('Generating missing ticket for download...');
      ticket = await generateTicketPDF(order);
    }

    // If ticket exists but no PDF, regenerate it
    if (!ticket.ticketPdfUrl) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          registration: {
            include: { event: true, formResponse: true }
          }
        }
      });

      console.log('Regenerating missing PDF for download...');
      ticket = await generateTicketPDF(order);
    }

    // Redirect to the PDF URL
    if (ticket.ticketPdfUrl) {
      // If it's a relative path (local dev), redirect to backend URL
      if (ticket.ticketPdfUrl.startsWith('/')) {
        return res.redirect(process.env.BACKEND_URL + ticket.ticketPdfUrl);
      }
      return res.redirect(ticket.ticketPdfUrl);
    } else {
      return res.status(500).send('Failed to generate ticket PDF');
    }

  } catch (error) {
    console.error('Download ticket by order error:', error);
    res.status(500).send('Failed to process ticket download');
  }
});

export default router;
