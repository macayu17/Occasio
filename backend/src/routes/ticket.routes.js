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

    // Verify signature
    const isValid = verifyQRSignature(payload);

    if (!isValid) {
      return res.status(400).json({ 
        valid: false,
        error: 'Invalid signature' 
      });
    }

    // Find ticket
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

export default router;
