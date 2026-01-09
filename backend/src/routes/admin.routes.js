import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../config/db.js';
import { authenticate, requireOrganizer } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';
import { uploadToS3 } from '../utils/s3.util.js';
import { uploadToCloudinary, isCloudinaryConfigured } from '../utils/cloudinary.util.js';

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
    body('priceCents').isInt({ min: 0 }),
    body('category').optional().isIn(['MUSIC', 'TECH', 'SPORTS', 'ARTS', 'BUSINESS', 'EDUCATION', 'FOOD', 'HEALTH', 'SOCIAL', 'OTHER']),
    body('tags').optional().isArray()
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
        currency,
        category,
        tags
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
          currency: currency || 'INR',
          category: category || 'OTHER',
          tags: tags || []
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

    // Upload to cloud storage or use local path
    let posterUrl;
    if (isCloudinaryConfigured()) {
      // Use Cloudinary (recommended for production)
      console.log('📸 Uploading to Cloudinary...');
      posterUrl = await uploadToCloudinary(req.file.buffer, 'posters');
      console.log('✅ Cloudinary URL:', posterUrl);
    } else if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
      // Fallback to S3
      posterUrl = await uploadToS3(req.file);
    } else {
      // Local development
      posterUrl = `/uploads/${req.file.filename}`;
    }

    console.log('💾 Saving posterUrl to DB for event:', id);
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: { posterUrl }
    });
    console.log('✅ DB updated, posterUrl now:', updatedEvent.posterUrl);

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

// Delete a registration (and associated orders/tickets)
router.delete('/registrations/:regId', async (req, res) => {
  try {
    const { regId } = req.params;

    const registration = await prisma.registration.findUnique({
      where: { id: regId },
      include: { event: true }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (registration.event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete registration (cascades to orders and tickets)
    await prisma.registration.delete({
      where: { id: regId }
    });

    res.json({ message: 'Registration deleted successfully' });
  } catch (error) {
    console.error('Delete registration error:', error);
    res.status(500).json({ error: 'Failed to delete registration' });
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

    // Daily registrations (last 30 days likely better, but stick to 7 for UI)
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 14);

    // Calculate growth (This Week vs Last Week)
    const currentWeekRegs = registrations.filter(r => {
      const d = new Date(r.createdAt);
      return d >= sevenDaysAgo && d <= today;
    }).length;

    const previousWeekRegs = registrations.filter(r => {
      const d = new Date(r.createdAt);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    }).length;

    let registrationGrowth = 0;
    if (previousWeekRegs > 0) {
      registrationGrowth = ((currentWeekRegs - previousWeekRegs) / previousWeekRegs) * 100;
    } else if (currentWeekRegs > 0) {
      registrationGrowth = 100; // 0 to something is 100% growth effectively
    }

    const recentRegs = registrations.filter(r => new Date(r.createdAt) >= sevenDaysAgo);
    const dailyMap = {};
    // ... rest of dailyMap logic
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
      registrationGrowth: Number(registrationGrowth.toFixed(1)),
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

// Broadcast email
router.post('/broadcast',
  [
    body('subject').notEmpty().trim(),
    body('content').notEmpty().trim(),
    body('type').isIn(['ALL', 'EVENT']),
    body('eventId').optional()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { subject, content, type, eventId } = req.body;
      let users = [];

      if (type === 'EVENT') {
        if (!eventId) {
          return res.status(400).json({ error: 'Event ID is required for event broadcast' });
        }

        // Get unique emails from registrations for this event
        const registrations = await prisma.registration.findMany({
          where: {
            eventId: eventId,
            status: { in: ['PAID', 'PENDING'] } // Include pending? Maybe just PAID. Let's do both for now as a "reminder"
          },
          select: { userEmail: true },
          distinct: ['userEmail']
        });
        users = registrations.map(r => r.userEmail);

      } else {
        // ALL users (unique emails across all registrations)
        const registrations = await prisma.registration.findMany({
          select: { userEmail: true },
          distinct: ['userEmail']
        });
        users = registrations.map(r => r.userEmail);
      }

      if (users.length === 0) {
        return res.json({ message: 'No recipients found', count: 0 });
      }

      // Send in background (basic loop for now)
      // In production, this should go to a queue
      const { sendCustomEmail } = await import('../services/email.service.js');

      // Sending individually to hide other recipients (BCC effect)
      // Or use BCC in one mail if list is small. 
      // Safe approach: Loop.
      console.log(`Broadcasting to ${users.length} users: ${subject}`);

      // Process in chunks or just background it completely
      (async () => {
        try {
          for (const email of users) {
            await sendCustomEmail(email, subject, content); // Wait or Promise.all
          }
          console.log('Broadcast complete');
        } catch (e) {
          console.error('Broadcast error:', e);
        }
      })();

      res.json({ message: `Broadcast started for ${users.length} recipients`, count: users.length });
    } catch (error) {
      console.error('Broadcast error:', error);
      res.status(500).json({ error: 'Failed to initiate broadcast' });
    }
  }
);

// Get financial analytics
router.get('/financials', async (req, res) => {
  try {
    const where = req.user.role === 'ADMIN'
      ? {}
      : { organizerId: req.user.id };

    // Get all events for this organizer/admin
    const events = await prisma.event.findMany({
      where,
      include: {
        registrations: {
          where: { status: 'PAID' },
          include: {
            orders: {
              where: { status: 'PAID' }
            }
          }
        }
      }
    });

    // Calculate total revenue and tickets
    let totalRevenue = 0;
    let totalTickets = 0;
    const monthlyRevenue = {};

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[key] = 0;
    }

    events.forEach(event => {
      event.registrations.forEach(reg => {
        reg.orders.forEach(order => {
          totalRevenue += order.totalAmount;
          totalTickets += order.quantity || 1;

          // Monthly breakdown
          const orderDate = new Date(order.createdAt);
          const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyRevenue[monthKey] !== undefined) {
            monthlyRevenue[monthKey] += order.totalAmount;
          }
        });
      });
    });

    // Calculate previous month's revenue for growth
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    const currentMonthRevenue = monthlyRevenue[currentMonthKey] || 0;
    const lastMonthRevenue = monthlyRevenue[lastMonthKey] || 0;

    let revenueGrowth = 0;
    if (lastMonthRevenue > 0) {
      revenueGrowth = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } else if (currentMonthRevenue > 0) {
      revenueGrowth = 100;
    }

    // Active events count
    const activeEvents = events.filter(e => new Date(e.endTime) > new Date()).length;

    // Convert monthly revenue to array for chart
    const revenueChart = Object.entries(monthlyRevenue).map(([month, amount]) => ({
      month,
      revenue: amount / 100 // Convert from cents
    }));

    res.json({
      totalRevenue: totalRevenue / 100, // Convert from cents
      totalTickets,
      activeEvents,
      revenueGrowth: Number(revenueGrowth.toFixed(1)),
      revenueChart
    });
  } catch (error) {
    console.error('Get financials error:', error);
    res.status(500).json({ error: 'Failed to fetch financial data' });
  }
});

// Clone an event
router.post('/events/:id/clone', async (req, res) => {
  try {
    const { id } = req.params;

    const originalEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        form: true
      }
    });

    if (!originalEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (originalEvent.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Generate new slug
    const newTitle = `${originalEvent.title} (Copy)`;
    const newSlug = newTitle.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();

    // Clone the event
    const clonedEvent = await prisma.event.create({
      data: {
        organizerId: req.user.id,
        title: newTitle,
        slug: newSlug,
        description: originalEvent.description,
        location: originalEvent.location,
        startTime: originalEvent.startTime,
        endTime: originalEvent.endTime,
        capacity: originalEvent.capacity,
        priceCents: originalEvent.priceCents,
        currency: originalEvent.currency,
        type: originalEvent.type,
        category: originalEvent.category,
        tags: originalEvent.tags,
        posterUrl: originalEvent.posterUrl,
        published: false // Always unpublished by default
      },
      include: {
        organizer: {
          select: { name: true, email: true }
        }
      }
    });

    // Clone the form if it exists
    if (originalEvent.form) {
      await prisma.form.create({
        data: {
          eventId: clonedEvent.id,
          schemaJson: originalEvent.form.schemaJson
        }
      });
    }

    res.status(201).json(clonedEvent);
  } catch (error) {
    console.error('Clone event error:', error);
    res.status(500).json({ error: 'Failed to clone event' });
  }
});

// ============================================
// CHECK-IN MANAGEMENT ENDPOINTS
// ============================================

// Get all attendees for an event with check-in status
router.get('/events/:id/attendees', async (req, res) => {
  try {
    const { id } = req.params;
    const { search, status } = req.query;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Build filter conditions
    let ticketWhere = {};
    if (status === 'checked-in') ticketWhere.checkedInAt = { not: null };
    if (status === 'not-checked-in') ticketWhere.checkedInAt = null;
    if (status === 'checked-out') ticketWhere.checkedOutAt = { not: null };

    const registrations = await prisma.registration.findMany({
      where: {
        eventId: id,
        status: { in: ['PAID', 'CONFIRMED'] },
        ...(search && {
          OR: [
            { userEmail: { contains: search, mode: 'insensitive' } },
            { formResponse: { path: ['name'], string_contains: search } }
          ]
        })
      },
      include: {
        orders: {
          where: { status: 'PAID' },
          include: {
            ticket: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Flatten to attendees list with check-in info
    const attendees = registrations.flatMap(reg =>
      reg.orders
        .filter(o => o.ticket)
        .filter(o => {
          if (status === 'checked-in') return o.ticket.checkedInAt;
          if (status === 'not-checked-in') return !o.ticket.checkedInAt;
          if (status === 'checked-out') return o.ticket.checkedOutAt;
          return true;
        })
        .map(order => ({
          id: order.ticket.id,
          ticketId: order.ticket.id,
          orderId: order.id,
          name: reg.formResponse?.name || 'N/A',
          email: reg.userEmail,
          phone: reg.formResponse?.phone || null,
          checkedInAt: order.ticket.checkedInAt,
          checkedOutAt: order.ticket.checkedOutAt,
          checkedInBy: order.ticket.checkedInBy,
          issuedAt: order.ticket.issuedAt,
          revoked: order.ticket.revoked
        }))
    );

    res.json(attendees);
  } catch (error) {
    console.error('Get attendees error:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// Get check-in stats for an event
router.get('/events/:id/checkin-stats', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Count tickets
    const [total, checkedIn, checkedOut] = await Promise.all([
      prisma.ticket.count({
        where: {
          order: {
            registration: { eventId: id },
            status: 'PAID'
          }
        }
      }),
      prisma.ticket.count({
        where: {
          order: {
            registration: { eventId: id },
            status: 'PAID'
          },
          checkedInAt: { not: null }
        }
      }),
      prisma.ticket.count({
        where: {
          order: {
            registration: { eventId: id },
            status: 'PAID'
          },
          checkedOutAt: { not: null }
        }
      })
    ]);

    res.json({
      total,
      checkedIn,
      checkedOut,
      notCheckedIn: total - checkedIn,
      currentlyInside: checkedIn - checkedOut,
      checkInRate: total > 0 ? ((checkedIn / total) * 100).toFixed(1) : 0
    });
  } catch (error) {
    console.error('Get checkin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch check-in stats' });
  }
});

// Manual check-in by ticket ID
router.post('/tickets/:ticketId/checkin', async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        order: {
          include: {
            registration: {
              include: { event: true }
            }
          }
        }
      }
    });

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const event = ticket.order.registration.event;
    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (ticket.revoked) {
      return res.status(400).json({ error: 'Ticket has been revoked' });
    }

    if (ticket.checkedInAt) {
      return res.status(400).json({
        error: 'Already checked in',
        checkedInAt: ticket.checkedInAt
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        checkedInAt: new Date(),
        checkedInBy: req.user.id,
        scannedAt: ticket.scannedAt || new Date() // Backward compatibility
      }
    });

    res.json({
      success: true,
      message: 'Checked in successfully',
      ticket: updatedTicket
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// Manual check-out by ticket ID
router.post('/tickets/:ticketId/checkout', async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        order: {
          include: {
            registration: {
              include: { event: true }
            }
          }
        }
      }
    });

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const event = ticket.order.registration.event;
    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!ticket.checkedInAt) {
      return res.status(400).json({ error: 'Not checked in yet' });
    }

    if (ticket.checkedOutAt) {
      return res.status(400).json({
        error: 'Already checked out',
        checkedOutAt: ticket.checkedOutAt
      });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        checkedOutAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Checked out successfully',
      ticket: updatedTicket
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
});

// Undo check-in (reset)
router.post('/tickets/:ticketId/reset-checkin', async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        order: {
          include: {
            registration: {
              include: { event: true }
            }
          }
        }
      }
    });

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const event = ticket.order.registration.event;
    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        checkedInAt: null,
        checkedOutAt: null,
        checkedInBy: null
      }
    });

    res.json({
      success: true,
      message: 'Check-in reset',
      ticket: updatedTicket
    });
  } catch (error) {
    console.error('Reset check-in error:', error);
    res.status(500).json({ error: 'Failed to reset check-in' });
  }
});

// Update ticket style for an event
router.put('/events/:id/ticket-style', async (req, res) => {
  try {
    const { id } = req.params;
    const { ticketStyle } = req.body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: { ticketStyle }
    });

    res.json({ success: true, ticketStyle: updatedEvent.ticketStyle });
  } catch (error) {
    console.error('Update ticket style error:', error);
    res.status(500).json({ error: 'Failed to update ticket style' });
  }
});

export default router;

