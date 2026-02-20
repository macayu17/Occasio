import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../config/db.js';
import { authenticate, requireOrganizer, checkEventAccess } from '../middleware/auth.middleware.js';
import { upload, uploadPdf } from '../middleware/upload.middleware.js';
import { uploadToS3 } from '../utils/s3.util.js';
import { uploadToCloudinary, isCloudinaryConfigured } from '../utils/cloudinary.util.js';

const router = express.Router();

// Lazy load certificate service to avoid startup errors if pdf-lib isn't installed
let generateCertificate = null;
let generateTypedCertificate = null;
let CERTIFICATE_TYPES = null;
let CERTIFICATE_TYPE_LABELS = null;
let sendCertificateEmail = null;

const loadCertificateServices = async () => {
  if (!generateCertificate) {
    try {
      const certService = await import('../services/certificate.service.js');
      generateCertificate = certService.generateCertificate;
      generateTypedCertificate = certService.generateTypedCertificate;
      CERTIFICATE_TYPES = certService.CERTIFICATE_TYPES;
      CERTIFICATE_TYPE_LABELS = certService.CERTIFICATE_TYPE_LABELS;
      const emailService = await import('../services/email.service.js');
      sendCertificateEmail = emailService.sendCertificateEmail;
    } catch (error) {
      console.error('Failed to load certificate services:', error);
      throw new Error('Certificate generation not available. Please ensure pdf-lib is installed.');
    }
  }
};

// All admin routes require authentication
router.use(authenticate);
router.use(requireOrganizer);

// Upload certificate template (PDF)
router.post('/upload', uploadPdf.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let fileUrl;
    
    // Try Cloudinary first
    if (isCloudinaryConfigured()) {
      const result = await uploadToCloudinary(req.file.buffer || req.file.path, 'events/certificates');
      fileUrl = result.secure_url;
    } else if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
      fileUrl = await uploadToS3(req.file);
    } else {
      // Fallback to local
      fileUrl = `/uploads/${req.file.filename}`;
    }

    res.json({ url: fileUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

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

// Update event (owners, admins, MANAGER, SUPER_MANAGER can edit)
router.put('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check access - MANAGER and SUPER_MANAGER can edit
    const access = await checkEventAccess(req.user, id, ['MANAGER', 'SUPER_MANAGER']);

    if (!access.hasAccess) {
      return res.status(403).json({ error: access.error || 'Not authorized' });
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

// Create/Update event form (owners, admins, SUPER_MANAGER can edit)
router.post('/events/:id/form', async (req, res) => {
  try {
    const { id } = req.params;
    const { schemaJson } = req.body;

    // Check access - only SUPER_MANAGER (not regular MANAGER) can edit forms
    const access = await checkEventAccess(req.user, id, ['SUPER_MANAGER']);

    if (!access.hasAccess) {
      return res.status(403).json({ error: access.error || 'Not authorized' });
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
          totalRevenue += order.amountCents || 0;
          totalTickets += 1;

          // Monthly breakdown
          const orderDate = new Date(order.createdAt);
          const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyRevenue[monthKey] !== undefined) {
            monthlyRevenue[monthKey] += order.amountCents || 0;
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

// ============================================
// ENHANCED ANALYTICS ENDPOINTS
// ============================================

// Get conversion funnel data for an event
router.get('/events/:id/analytics/funnel', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get all registrations with their orders and tickets
    const registrations = await prisma.registration.findMany({
      where: { eventId: id },
      include: {
        orders: {
          include: { ticket: true }
        }
      }
    });

    // Calculate funnel stages
    const totalRegistrations = registrations.length;
    const paidRegistrations = registrations.filter(r => r.status === 'PAID' || r.status === 'CONFIRMED').length;
    const ticketsIssued = registrations.flatMap(r => r.orders.filter(o => o.ticket)).length;
    const checkedIn = registrations.flatMap(r =>
      r.orders.filter(o => o.ticket && o.ticket.checkedInAt)
    ).length;

    // Calculate drop-off percentages
    const funnel = [
      { stage: 'Registrations', count: totalRegistrations, percentage: 100 },
      {
        stage: 'Payments',
        count: paidRegistrations,
        percentage: totalRegistrations > 0 ? Math.round((paidRegistrations / totalRegistrations) * 100) : 0,
        dropOff: totalRegistrations > 0 ? Math.round(((totalRegistrations - paidRegistrations) / totalRegistrations) * 100) : 0
      },
      {
        stage: 'Tickets Issued',
        count: ticketsIssued,
        percentage: totalRegistrations > 0 ? Math.round((ticketsIssued / totalRegistrations) * 100) : 0,
        dropOff: paidRegistrations > 0 ? Math.round(((paidRegistrations - ticketsIssued) / paidRegistrations) * 100) : 0
      },
      {
        stage: 'Check-ins',
        count: checkedIn,
        percentage: totalRegistrations > 0 ? Math.round((checkedIn / totalRegistrations) * 100) : 0,
        dropOff: ticketsIssued > 0 ? Math.round(((ticketsIssued - checkedIn) / ticketsIssued) * 100) : 0
      }
    ];

    res.json({ funnel, totalRegistrations, paidRegistrations, ticketsIssued, checkedIn });
  } catch (error) {
    console.error('Get funnel analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch funnel data' });
  }
});

// Get real-time attendance stats for an event
router.get('/events/:id/analytics/realtime', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get ticket stats
    const tickets = await prisma.ticket.findMany({
      where: {
        order: {
          registration: { eventId: id },
          status: 'PAID'
        }
      },
      select: {
        checkedInAt: true,
        checkedOutAt: true
      }
    });

    const totalTickets = tickets.length;
    const checkedIn = tickets.filter(t => t.checkedInAt).length;
    const checkedOut = tickets.filter(t => t.checkedOutAt).length;
    const currentlyInside = checkedIn - checkedOut;
    const notYetArrived = totalTickets - checkedIn;

    // Check-in rate per hour (last 6 hours)
    const now = new Date();
    const hourlyData = [];
    for (let i = 5; i >= 0; i--) {
      const hourStart = new Date(now);
      hourStart.setHours(now.getHours() - i, 0, 0, 0);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourStart.getHours() + 1);

      const count = tickets.filter(t => {
        if (!t.checkedInAt) return false;
        const checkIn = new Date(t.checkedInAt);
        return checkIn >= hourStart && checkIn < hourEnd;
      }).length;

      hourlyData.push({
        hour: hourStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        checkIns: count
      });
    }

    // Calculate peak attendance (max currently inside at any point)
    // Simplified: just use current as peak for now
    const peakAttendance = currentlyInside;

    res.json({
      totalTickets,
      checkedIn,
      checkedOut,
      currentlyInside,
      notYetArrived,
      checkInRate: totalTickets > 0 ? Math.round((checkedIn / totalTickets) * 100) : 0,
      peakAttendance,
      hourlyData,
      capacity: event.capacity,
      capacityUsed: Math.round((currentlyInside / event.capacity) * 100)
    });
  } catch (error) {
    console.error('Get realtime analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch realtime data' });
  }
});

// ============================================
// TEAM MANAGEMENT ENDPOINTS
// ============================================

// Get team members for an event
router.get('/events/:id/team', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const teamMembers = await prisma.teamMember.findMany({
      where: { eventId: id },
      orderBy: { invitedAt: 'desc' }
    });

    res.json(teamMembers);
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Invite a team member
router.post('/events/:id/team', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if already a team member
    const existing = await prisma.teamMember.findUnique({
      where: { eventId_email: { eventId: id, email } }
    });

    if (existing) {
      return res.status(400).json({ error: 'User is already a team member' });
    }

    const teamMember = await prisma.teamMember.create({
      data: {
        eventId: id,
        email,
        name: name || null,
        role: role || 'STAFF'
      }
    });

    res.status(201).json(teamMember);
  } catch (error) {
    console.error('Invite team member error:', error);
    res.status(500).json({ error: 'Failed to invite team member' });
  }
});

// Update team member role
router.put('/events/:id/team/:memberId', async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const teamMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role }
    });

    res.json(teamMember);
  } catch (error) {
    console.error('Update team member error:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// Remove team member
router.delete('/events/:id/team/:memberId', async (req, res) => {
  try {
    const { id, memberId } = req.params;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.teamMember.delete({
      where: { id: memberId }
    });

    res.json({ success: true, message: 'Team member removed' });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Test/Preview Certificate - generates a sample certificate with dummy data
router.post('/events/:id/certificates/test', async (req, res) => {
  try {
    await loadCertificateServices();
  } catch (error) {
    return res.status(500).json({ error: 'Certificate service unavailable: ' + error.message });
  }

  try {
    const { id } = req.params;
    const { templateUrl, mapping, certificateType } = req.body;

    // Use provided template/mapping or fetch from event
    let finalTemplateUrl = templateUrl;
    let finalMapping = mapping;

    if (!templateUrl || !mapping) {
      const event = await prisma.event.findUnique({
        where: { id }
      });

      if (!event) return res.status(404).json({ error: 'Event not found' });
      
      // If a specific certificate type is requested, look in certificateConfigs
      if (certificateType && event.certificateConfigs) {
        const configs = event.certificateConfigs;
        const config = configs[certificateType];
        if (config) {
          finalTemplateUrl = templateUrl || config.templateUrl;
          finalMapping = mapping || config.mapping;
        }
      }
      
      // Fallback to legacy fields
      if (!finalTemplateUrl) {
        finalTemplateUrl = templateUrl || event.certificateTemplateUrl;
      }
      if (!finalMapping) {
        finalMapping = mapping || event.certificateMapping;
      }
    }

    if (!finalTemplateUrl) {
      return res.status(400).json({ error: 'No template URL provided. Please upload a PDF template first.' });
    }

    // Generate with sample data
    const typeLabel = certificateType ? (CERTIFICATE_TYPE_LABELS[certificateType] || certificateType) : 'Participation';
    const sampleData = {
      userName: 'John Doe',
      eventName: 'Sample Event Name',
      date: new Date().toDateString(),
      qrCode: 'TEST-QR-12345',
      certificateType: typeLabel,
      rank: certificateType === 'first_prize' ? '1st Place' : 
            certificateType === 'second_prize' ? '2nd Place' : 
            certificateType === 'third_prize' ? '3rd Place' : ''
    };

    const pdfBytes = await generateCertificate(finalTemplateUrl, finalMapping || [], sampleData);

    // Return as PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="test-certificate.pdf"');
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Test certificate error:', error);
    res.status(500).json({ error: 'Failed to generate test certificate: ' + error.message });
  }
});

// Save certificate config for a specific type
router.put('/events/:id/certificates/config', async (req, res) => {
  try {
    const { id } = req.params;
    const { certificateType, templateUrl, mapping, enabled } = req.body;

    const access = await checkEventAccess(req.user, id, ['MANAGER', 'SUPER_MANAGER']);
    if (!access.hasAccess) {
      return res.status(403).json({ error: access.error || 'Not authorized' });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const configs = event.certificateConfigs || {};
    configs[certificateType] = {
      templateUrl: templateUrl || configs[certificateType]?.templateUrl,
      mapping: mapping || configs[certificateType]?.mapping || [],
      enabled: enabled !== undefined ? enabled : true,
    };

    // Also set legacy fields if this is the participation certificate
    const updateData = {
      certificateConfigs: configs,
      certificateEnabled: true,
    };

    if (certificateType === 'participation') {
      updateData.certificateTemplateUrl = configs[certificateType].templateUrl;
      updateData.certificateMapping = configs[certificateType].mapping;
    }

    const updated = await prisma.event.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, certificateConfigs: updated.certificateConfigs });
  } catch (error) {
    console.error('Save certificate config error:', error);
    res.status(500).json({ error: 'Failed to save certificate config' });
  }
});

// Get certificate configs for an event
router.get('/events/:id/certificates/config', async (req, res) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        certificateEnabled: true,
        certificateTemplateUrl: true,
        certificateMapping: true,
        certificateConfigs: true,
      }
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Build unified config - merge legacy fields into configs if needed
    let configs = event.certificateConfigs || {};
    
    // If legacy fields exist but not in configs, add them as participation
    if (event.certificateTemplateUrl && !configs.participation) {
      configs.participation = {
        templateUrl: event.certificateTemplateUrl,
        mapping: event.certificateMapping || [],
        enabled: event.certificateEnabled,
      };
    }

    res.json({
      certificateEnabled: event.certificateEnabled,
      configs,
    });
  } catch (error) {
    console.error('Get certificate config error:', error);
    res.status(500).json({ error: 'Failed to get certificate config' });
  }
});

// Send Certificates to checked-in users (supports typed certificates)
router.post('/events/:id/certificates', async (req, res) => {
  try {
    await loadCertificateServices();
  } catch (error) {
    return res.status(500).json({ error: 'Certificate service unavailable: ' + error.message });
  }

  try {
    const { id } = req.params;
    const { dryRun, certificateType = 'participation', recipientEmails } = req.body;

    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check if the requested certificate type has a config
    const configs = event.certificateConfigs || {};
    const typeConfig = configs[certificateType];
    const hasLegacyConfig = certificateType === 'participation' && event.certificateTemplateUrl;

    if (!typeConfig?.templateUrl && !hasLegacyConfig) {
      return res.status(400).json({ error: `No template configured for certificate type: ${certificateType}` });
    }

    // For prize certificates, use recipientEmails; for participation, use checked-in attendees
    let recipients = [];

    if (recipientEmails && recipientEmails.length > 0) {
      // Sending to specific recipients (prize certificates)
      recipients = recipientEmails.map(email => ({ email, userName: email.split('@')[0] }));
      
      // Try to resolve names from users table
      for (let i = 0; i < recipients.length; i++) {
        const user = await prisma.user.findUnique({ where: { email: recipients[i].email } });
        if (user) recipients[i].userName = user.name;
      }
    } else {
      // Find checked-in tickets (participation certificates)
      const tickets = await prisma.ticket.findMany({
        where: {
          checkedInAt: { not: null },
          order: {
            registration: {
              eventId: id
            }
          }
        },
        include: {
          order: {
            include: {
              registration: true
            }
          }
        }
      });

      if (tickets.length === 0) {
        return res.json({ message: 'No checked-in attendees found', count: 0 });
      }

      for (const ticket of tickets) {
        const registration = ticket.order.registration;
        const user = await prisma.user.findUnique({ where: { email: registration.userEmail } });
        const userName = user ? user.name : registration.userEmail.split('@')[0];
        recipients.push({ email: registration.userEmail, userName, ticketId: ticket.id });
      }
    }

    if (dryRun) {
      return res.json({ message: 'Dry run complete', count: recipients.length });
    }

    let sentCount = 0;
    const templateUrl = typeConfig?.templateUrl || event.certificateTemplateUrl;
    const templateMapping = typeConfig?.mapping || event.certificateMapping || [];
    const typeLabel = CERTIFICATE_TYPE_LABELS[certificateType] || 'Participation';

    for (const recipient of recipients) {
      try {
        const pdfBytes = await generateCertificate(
          templateUrl,
          templateMapping,
          {
            userName: recipient.userName,
            eventName: event.title,
            date: event.startTime.toDateString(),
            qrCode: recipient.ticketId || recipient.email,
            certificateType: typeLabel,
            rank: certificateType === 'first_prize' ? '1st Place' :
                  certificateType === 'second_prize' ? '2nd Place' :
                  certificateType === 'third_prize' ? '3rd Place' : ''
          }
        );

        await sendCertificateEmail(
          recipient.email, 
          recipient.userName, 
          event.title, 
          Buffer.from(pdfBytes),
          typeLabel
        );
        sentCount++;
      } catch (err) {
        console.error(`Failed to send ${certificateType} cert to ${recipient.email}`, err);
      }
    }

    res.json({ message: `${typeLabel} certificates sent to ${sentCount} recipients`, count: sentCount });

  } catch (error) {
    console.error('Certificate generation error:', error);
    res.status(500).json({ error: 'Failed to generate certificates' });
  }
});

export default router;

