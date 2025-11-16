import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../config/db.js';
import { authenticate, requireOrganizer } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';
import { uploadToS3 } from '../utils/s3.util.js';

const router = express.Router();

// All admin routes require authentication
router.use(authenticate);
router.use(requireOrganizer);

// Create event
router.post('/events',
  [
    body('title').notEmpty().trim(),
    body('description').notEmpty().trim(),
    body('location').notEmpty().trim(),
    body('startTime').isISO8601(),
    body('endTime').isISO8601(),
    body('capacity').isInt({ min: 1 }),
    body('priceCents').isInt({ min: 0 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        description,
        location,
        startTime,
        endTime,
        capacity,
        priceCents,
        currency
      } = req.body;

      // Generate slug from title
      const slug = title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + Date.now();

      const event = await prisma.event.create({
        data: {
          organizerId: req.user.id,
          title,
          slug,
          description,
          location,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          capacity,
          priceCents,
          currency: currency || 'INR'
        },
        include: {
          organizer: {
            select: { name: true, email: true }
          }
        }
      });

      res.status(201).json(event);
    } catch (error) {
      console.error('Create event error:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  }
);

// Update event
router.put('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        ...req.body,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined
      },
      include: {
        organizer: {
          select: { name: true, email: true }
        }
      }
    });

    res.json(updatedEvent);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.event.delete({
      where: { id }
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Upload event poster
router.post('/events/:id/poster-upload', upload.single('poster'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Upload to S3 (or use local path in development)
    let posterUrl;
    if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
      posterUrl = await uploadToS3(req.file);
    } else {
      posterUrl = `/uploads/${req.file.filename}`;
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: { posterUrl }
    });

    res.json({ posterUrl: updatedEvent.posterUrl });
  } catch (error) {
    console.error('Upload poster error:', error);
    res.status(500).json({ error: 'Failed to upload poster' });
  }
});

// Create/Update event form
router.post('/events/:id/form', async (req, res) => {
  try {
    const { id } = req.params;
    const { schemaJson } = req.body;

    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const form = await prisma.form.upsert({
      where: { eventId: id },
      update: { schemaJson },
      create: {
        eventId: id,
        schemaJson
      }
    });

    res.json(form);
  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ error: 'Failed to create form' });
  }
});

// Get all events for organizer
router.get('/events', async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN' 
      ? {} 
      : { organizerId: req.user.id };

    const events = await prisma.event.findMany({
      where,
      include: {
        organizer: {
          select: { name: true, email: true }
        },
        _count: {
          select: {
            registrations: {
              where: { status: 'PAID' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(events);
  } catch (error) {
    console.error('Get admin events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get registrations for an event
router.get('/events/:id/registrations', async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const registrations = await prisma.registration.findMany({
      where: { eventId: id },
      include: {
        orders: {
          include: {
            ticket: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(registrations);
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Get analytics for an event
router.get('/events/:id/analytics', async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get all registrations
    const registrations = await prisma.registration.findMany({
      where: { eventId: id },
      include: {
        orders: {
          include: {
            ticket: true
          }
        }
      }
    });

    const totalRegistrations = registrations.length;
    const paidRegistrations = registrations.filter(r => r.status === 'PAID').length;
    const pendingRegistrations = registrations.filter(r => r.status === 'PENDING').length;
    const failedRegistrations = registrations.filter(r => r.status === 'FAILED').length;

    // Revenue calculation
    const paidOrders = registrations.flatMap(r => r.orders.filter(o => o.status === 'PAID'));
    const totalRevenue = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0) / 100;
    const averageOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

    // Check-in stats
    const tickets = registrations.flatMap(r => r.orders.flatMap(o => o.ticket ? [o.ticket] : []));
    const checkedInCount = tickets.filter(t => t.scannedAt).length;
    const notCheckedInCount = tickets.length - checkedInCount;
    const checkInRate = tickets.length > 0 ? (checkedInCount / tickets.length) * 100 : 0;

    // Daily registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRegs = registrations.filter(r => new Date(r.createdAt) >= sevenDaysAgo);
    const dailyMap = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap[dateStr] = 0;
    }
    recentRegs.forEach(r => {
      const dateStr = new Date(r.createdAt).toISOString().split('T')[0];
      if (dailyMap[dateStr] !== undefined) dailyMap[dateStr]++;
    });
    const dailyRegistrations = Object.entries(dailyMap).map(([date, count]) => ({ date, count })).reverse();

    // Recent registrations
    const recentRegistrations = registrations
      .slice(0, 10)
      .map(r => ({
        attendeeName: r.formResponse.name || 'N/A',
        email: r.userEmail,
        status: r.status,
        createdAt: r.createdAt
      }));

    // Conversion rate
    const conversionRate = totalRegistrations > 0 ? (paidRegistrations / totalRegistrations) * 100 : 0;

    res.json({
      totalRegistrations,
      paidRegistrations,
      pendingRegistrations,
      failedRegistrations,
      totalRevenue,
      averageOrderValue,
      conversionRate,
      registrationGrowth: 0,
      checkedInCount,
      notCheckedInCount,
      checkInRate,
      dailyRegistrations,
      recentRegistrations
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
