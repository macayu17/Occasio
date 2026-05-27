import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { body, validationResult } from 'express-validator';
import prisma from '../config/db.js';
import { authenticate, requireOrganizer, checkEventAccess } from '../middleware/auth.middleware.js';
import { upload, uploadPdf } from '../middleware/upload.middleware.js';
import { uploadToS3 } from '../utils/s3.util.js';
import { uploadToCloudinary, uploadPdfToCloudinary, uploadPublicPdfToCloudinary, isCloudinaryConfigured, signCloudinaryRawUrl } from '../utils/cloudinary.util.js';
import { getR2ObjectBuffer, isR2Configured, isR2TemplateRef, uploadBufferToR2 } from '../utils/r2.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const EVENT_CATEGORIES = new Set(['MUSIC', 'TECH', 'SPORTS', 'ARTS', 'BUSINESS', 'EDUCATION', 'FOOD', 'HEALTH', 'SOCIAL', 'OTHER']);
const EVENT_TYPES = new Set(['TICKETED', 'RSVP']);
const TEAM_ROLES = new Set(['SUPER_MANAGER', 'MANAGER', 'SCANNER', 'STAFF']);
const CERTIFICATE_TYPE_VALUES = new Set(['participation', 'first_prize', 'second_prize', 'third_prize']);
const CERTIFICATE_ACCESS_ROLES = ['MANAGER', 'SUPER_MANAGER'];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const sendAccessDenied = (res, access) => {
  const status = access.error === 'Event not found' ? 404 : 403;
  return res.status(status).json({ error: access.error || 'Not authorized' });
};

const parseRequiredString = (value, fieldName) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw badRequest(`${fieldName} is required`);
  return normalized;
};

const parseIntegerField = (value, fieldName, min) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw badRequest(`${fieldName} must be an integer greater than or equal to ${min}`);
  }
  return parsed;
};

const parseDateField = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${fieldName} must be a valid date`);
  }
  return parsed;
};

const parseBooleanField = (value, fieldName) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw badRequest(`${fieldName} must be a boolean`);
};

const normalizeTeamEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeTeamRole = (role = 'STAFF') => {
  const normalized = String(role || 'STAFF').trim().toUpperCase();
  return TEAM_ROLES.has(normalized) ? normalized : null;
};

const normalizeCertificateType = (certificateType = 'participation') => {
  const normalized = String(certificateType || 'participation').trim();
  return CERTIFICATE_TYPE_VALUES.has(normalized) ? normalized : null;
};

const isTicketExpired = (ticket) => {
  if (!ticket.validUntil) return false;
  const graceEnd = new Date(ticket.validUntil.getTime() + 24 * 60 * 60 * 1000);
  return new Date() > graceEnd;
};

const buildEventUpdateData = (body = {}) => {
  const data = {};

  if (hasOwn(body, 'title')) data.title = parseRequiredString(body.title, 'title');
  if (hasOwn(body, 'description')) data.description = parseRequiredString(body.description, 'description');
  if (hasOwn(body, 'location')) data.location = parseRequiredString(body.location, 'location');
  if (hasOwn(body, 'startTime')) data.startTime = parseDateField(body.startTime, 'startTime');
  if (hasOwn(body, 'endTime')) data.endTime = parseDateField(body.endTime, 'endTime');
  if (hasOwn(body, 'capacity')) data.capacity = parseIntegerField(body.capacity, 'capacity', 1);
  if (hasOwn(body, 'priceCents')) data.priceCents = parseIntegerField(body.priceCents, 'priceCents', 0);

  if (hasOwn(body, 'currency')) {
    const currency = parseRequiredString(body.currency, 'currency').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw badRequest('currency must be a 3-letter code');
    data.currency = currency;
  }

  if (hasOwn(body, 'type')) {
    const type = String(body.type || '').trim().toUpperCase();
    if (!EVENT_TYPES.has(type)) throw badRequest('type is invalid');
    data.type = type;
  }

  if (hasOwn(body, 'category')) {
    const category = String(body.category || '').trim().toUpperCase();
    if (!EVENT_CATEGORIES.has(category)) throw badRequest('category is invalid');
    data.category = category;
  }

  if (hasOwn(body, 'tags')) {
    if (!Array.isArray(body.tags)) throw badRequest('tags must be an array');
    data.tags = body.tags.map((tag) => String(tag || '').trim()).filter(Boolean);
  }

  if (hasOwn(body, 'published')) {
    data.published = parseBooleanField(body.published, 'published');
  }

  if (hasOwn(body, 'ticketStyle')) {
    const ticketStyle = body.ticketStyle;
    if (ticketStyle !== null && (Array.isArray(ticketStyle) || typeof ticketStyle !== 'object')) {
      throw badRequest('ticketStyle must be an object');
    }
    data.ticketStyle = ticketStyle;
  }

  if (hasOwn(body, 'certificateEnabled')) {
    data.certificateEnabled = parseBooleanField(body.certificateEnabled, 'certificateEnabled');
  }

  if (hasOwn(body, 'certificateTemplateUrl')) {
    const value = body.certificateTemplateUrl;
    data.certificateTemplateUrl = value === null || value === '' ? null : parseRequiredString(value, 'certificateTemplateUrl');
  }

  if (hasOwn(body, 'certificateMapping')) {
    const value = body.certificateMapping;
    if (value !== null && typeof value !== 'object') {
      throw badRequest('certificateMapping must be an object or array');
    }
    data.certificateMapping = value;
  }

  if (Object.keys(data).length === 0) {
    throw badRequest('No supported event fields provided');
  }

  return data;
};

// Lazy load certificate service to avoid startup errors if pdf-lib isn't installed
let generateCertificate = null;
let generateTypedCertificate = null;
let CERTIFICATE_TYPES = null;
let CERTIFICATE_TYPE_LABELS = null;
let sendCertificateEmail = null;
let isEmailDeliveryConfigured = null;

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
      isEmailDeliveryConfigured = emailService.isEmailDeliveryConfigured;
    } catch (error) {
      console.error('Failed to load certificate services:', error);
      throw new Error('Certificate generation not available. Please ensure pdf-lib is installed.');
    }
  }
};

const safeCertificateFilePart = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'recipient';

async function storeGeneratedCertificatePdf({ buffer, eventId, certificateType, recipientEmail }) {
  const fileName = `${safeCertificateFilePart(certificateType)}-${safeCertificateFilePart(recipientEmail)}-${Date.now()}.pdf`;
  const key = `certificates/generated/${eventId}/${fileName}`;

  if (isR2Configured()) {
    return uploadBufferToR2({
      buffer,
      key,
      contentType: 'application/pdf',
    });
  }

  if (isCloudinaryConfigured()) {
    return uploadPublicPdfToCloudinary(buffer, `certificates/generated/${eventId}`);
  }

  const certificateDir = path.join(__dirname, '../../uploads/certificates/generated', eventId);
  if (!fs.existsSync(certificateDir)) {
    fs.mkdirSync(certificateDir, { recursive: true });
  }

  const destinationPath = path.join(certificateDir, fileName);
  fs.writeFileSync(destinationPath, buffer);
  return `/uploads/certificates/generated/${eventId}/${fileName}`;
}

// All admin routes require authentication
router.use(authenticate);
router.use(requireOrganizer);

// Upload certificate template (PDF)
router.post('/upload', uploadPdf.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname || '.pdf') || '.pdf';
    const safeExt = ext.toLowerCase() === '.pdf' ? '.pdf' : '.pdf';
    const generatedFileName = `certificate-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    let fileBuffer = req.file.buffer;
    if (!fileBuffer && req.file.path && fs.existsSync(req.file.path)) {
      fileBuffer = fs.readFileSync(req.file.path);
    }

    if (!fileBuffer) {
      return res.status(500).json({ error: 'Uploaded file data is missing' });
    }

    let fileUrl;
    if (isR2Configured()) {
      const key = `certificates/templates/${generatedFileName}`;
      fileUrl = await uploadBufferToR2({
        buffer: fileBuffer,
        key,
        contentType: 'application/pdf',
      });
    } else if (isCloudinaryConfigured()) {
      fileUrl = await uploadPublicPdfToCloudinary(fileBuffer, 'certificates/templates');
    } else {
      const certificateUploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(certificateUploadDir)) {
        fs.mkdirSync(certificateUploadDir, { recursive: true });
      }

      const destinationPath = path.join(certificateUploadDir, generatedFileName);
      fs.writeFileSync(destinationPath, fileBuffer);
      fileUrl = `/uploads/${generatedFileName}`;
    }

    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
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
    body('type').optional().isIn(['TICKETED', 'RSVP']),
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
        type,
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
          type: type || 'TICKETED',
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
      data: buildEventUpdateData(req.body),
      include: {
        organizer: {
          select: { name: true, email: true }
        }
      }
    });

    res.json(updatedEvent);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
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

// Get a single event for admin/team workflows, including drafts
router.get('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const access = await checkEventAccess(req.user, id);

    if (!access.hasAccess) {
      return sendAccessDenied(res, access);
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { name: true, email: true }
        },
        form: true,
        ticketTiers: { orderBy: { sortOrder: 'asc' } },
        speakers: { orderBy: { sortOrder: 'asc' } },
        reminders: { orderBy: { hoursBeforeEvent: 'desc' } }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get admin event error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
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
      where: { id },
      include: {
        ticketTiers: { orderBy: { sortOrder: 'asc' } },
        discounts: true
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get all registrations with orders, tickets, and discount info
    const registrations = await prisma.registration.findMany({
      where: { eventId: id },
      include: {
        orders: {
          include: {
            ticket: true,
            discountCode: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalRegistrations = registrations.length;
    const paidRegistrations = registrations.filter(r => r.status === 'PAID').length;
    const pendingRegistrations = registrations.filter(r => r.status === 'PENDING').length;
    const failedRegistrations = registrations.filter(r => r.status === 'FAILED').length;
    const cancelledRegistrations = registrations.filter(r => r.status === 'CANCELLED').length;

    // Revenue calculation
    const paidOrders = registrations.flatMap(r => r.orders.filter(o => o.status === 'PAID'));
    const totalRevenue = paidOrders.reduce((sum, order) => sum + (order.amountCents || order.totalAmount || 0), 0) / 100;
    const averageOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

    // Check-in stats
    const tickets = registrations.flatMap(r => r.orders.flatMap(o => o.ticket ? [o.ticket] : []));
    const checkedInCount = tickets.filter(t => t.scannedAt || t.checkedInAt).length;
    const notCheckedInCount = tickets.length - checkedInCount;
    const checkInRate = tickets.length > 0 ? (checkedInCount / tickets.length) * 100 : 0;

    // ---- DAILY REGISTRATIONS (last 30 days) ----
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
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
      registrationGrowth = 100;
    }

    // Build daily map for last 30 days
    const dailyMap = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap[dateStr] = 0;
    }
    registrations.forEach(r => {
      const dateStr = new Date(r.createdAt).toISOString().split('T')[0];
      if (dailyMap[dateStr] !== undefined) dailyMap[dateStr]++;
    });
    const dailyRegistrations = Object.entries(dailyMap).map(([date, count]) => ({ date, count })).reverse();

    // ---- DAILY REVENUE ----
    const revenueMap = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      revenueMap[date.toISOString().split('T')[0]] = 0;
    }
    paidOrders.forEach(o => {
      const dateStr = new Date(o.createdAt).toISOString().split('T')[0];
      if (revenueMap[dateStr] !== undefined) {
        revenueMap[dateStr] += (o.amountCents || o.totalAmount || 0) / 100;
      }
    });
    const dailyRevenue = Object.entries(revenueMap).map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) })).reverse();

    // ---- HOURLY DISTRIBUTION (all-time) ----
    const hourlyMap = Array(24).fill(0);
    registrations.forEach(r => {
      const hour = new Date(r.createdAt).getHours();
      hourlyMap[hour]++;
    });
    const hourlyDistribution = hourlyMap.map((count, hour) => ({ hour, count }));
    const peakHour = hourlyDistribution.reduce((max, h) => h.count > max.count ? h : max, { hour: 0, count: 0 });

    // ---- TICKET TIER BREAKDOWN ----
    const tierBreakdown = event.ticketTiers.map(tier => {
      const capacity = tier.capacity || null;
      return {
        id: tier.id,
        name: tier.name,
        priceCents: tier.priceCents,
        capacity,
        soldCount: tier.soldCount,
        revenue: (tier.soldCount * tier.priceCents) / 100,
        fillRate: capacity ? ((tier.soldCount / capacity) * 100) : null
      };
    });

    // ---- DISCOUNT CODE USAGE ----
    const discountUsage = event.discounts.map(d => ({
      code: d.code,
      type: d.type,
      amount: d.amount,
      usedCount: d.usedCount,
      maxUses: d.maxUses,
      isActive: d.isActive
    }));
    const totalDiscountUses = discountUsage.reduce((s, d) => s + d.usedCount, 0);
    // Estimate discount savings from orders that used a code
    const discountedOrders = paidOrders.filter(o => o.discountCodeId);
    const discountSavings = discountedOrders.reduce((sum, o) => {
      const disc = o.discountCode;
      if (!disc) return sum;
      if (disc.type === 'PERCENTAGE') {
        return sum + ((o.amountCents || o.totalAmount || 0) * disc.amount / (100 - disc.amount)) / 100;
      }
      return sum + disc.amount / 100;
    }, 0);

    // ---- CHECK-IN TIMELINE ----
    const checkinTimeline = [];
    const checkedInTickets = tickets.filter(t => t.scannedAt || t.checkedInAt);
    if (checkedInTickets.length > 0) {
      const ciMap = {};
      checkedInTickets.forEach(t => {
        const ts = t.checkedInAt || t.scannedAt;
        const key = new Date(ts).toISOString().slice(0, 16); // minute resolution
        ciMap[key] = (ciMap[key] || 0) + 1;
      });
      let cumulative = 0;
      Object.entries(ciMap).sort().forEach(([time, count]) => {
        cumulative += count;
        checkinTimeline.push({ time, count, cumulative });
      });
    }

    // ---- REGISTRATION SOURCE / PAYMENT PROVIDER BREAKDOWN ----
    const providerBreakdown = {};
    paidOrders.forEach(o => {
      const provider = o.provider || 'UNKNOWN';
      if (!providerBreakdown[provider]) providerBreakdown[provider] = { count: 0, revenue: 0 };
      providerBreakdown[provider].count++;
      providerBreakdown[provider].revenue += (o.amountCents || o.totalAmount || 0) / 100;
    });

    // Recent registrations (top 15)
    const recentRegistrations = registrations
      .slice(0, 15)
      .map(r => {
        const ticket = r.orders?.[0]?.ticket;
        return {
          attendeeName: r.formResponse?.name || 'N/A',
          email: r.userEmail,
          status: r.status,
          createdAt: r.createdAt,
          ticketId: ticket ? ticket.id.substring(0, 8).toUpperCase() : null,
          checkedIn: ticket ? !!(ticket.scannedAt || ticket.checkedInAt) : false,
          amount: r.orders?.find(o => o.status === 'PAID')?.amountCents
            ? (r.orders.find(o => o.status === 'PAID').amountCents / 100)
            : null
        };
      });

    // Conversion rate
    const conversionRate = totalRegistrations > 0 ? (paidRegistrations / totalRegistrations) * 100 : 0;

    // ---- SUMMARY STATS ----
    const totalTickets = tickets.length;
    const capacityUsed = event.capacity > 0 ? ((totalRegistrations / event.capacity) * 100) : null;

    res.json({
      // Core stats
      totalRegistrations,
      paidRegistrations,
      pendingRegistrations,
      failedRegistrations,
      cancelledRegistrations,
      totalRevenue,
      averageOrderValue,
      conversionRate,
      registrationGrowth: Number(registrationGrowth.toFixed(1)),

      // Capacity
      eventCapacity: event.capacity,
      capacityUsed: capacityUsed !== null ? Number(capacityUsed.toFixed(1)) : null,

      // Check-in
      totalTickets,
      checkedInCount,
      notCheckedInCount,
      checkInRate,
      checkinTimeline,

      // Time series
      dailyRegistrations,
      dailyRevenue,
      hourlyDistribution,
      peakHour: { hour: peakHour.hour, count: peakHour.count },

      // Breakdowns
      tierBreakdown,
      discountUsage,
      totalDiscountUses,
      discountSavings: Number(discountSavings.toFixed(2)),
      providerBreakdown,

      // Recent
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
          ticketShortId: order.ticket.id.substring(0, 8).toUpperCase(),
          orderId: order.id,
          name: reg.formResponse?.name || 'N/A',
          email: reg.userEmail,
          phone: reg.formResponse?.phone || null,
          checkedInAt: order.ticket.checkedInAt,
          checkedOutAt: order.ticket.checkedOutAt,
          checkedInBy: order.ticket.checkedInBy,
          issuedAt: order.ticket.issuedAt,
          bookedAt: reg.createdAt,
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

    if (isTicketExpired(ticket)) {
      return res.status(400).json({ error: 'Ticket has expired' });
    }

    if (ticket.scannedAt || ticket.checkedInAt) {
      return res.status(400).json({
        error: 'Already checked in',
        checkedInAt: ticket.checkedInAt || ticket.scannedAt
      });
    }

    const now = new Date();
    const updateResult = await prisma.ticket.updateMany({
      where: {
        id: ticketId,
        scannedAt: null,
        checkedInAt: null
      },
      data: {
        checkedInAt: now,
        checkedInBy: req.user.id,
        scannedAt: now
      }
    });

    if (updateResult.count === 0) {
      const currentTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { scannedAt: true, checkedInAt: true }
      });

      return res.status(400).json({
        error: 'Already checked in',
        checkedInAt: currentTicket?.checkedInAt || currentTicket?.scannedAt || now
      });
    }

    const updatedTicket = await prisma.ticket.findUnique({ where: { id: ticketId } });

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
        scannedAt: null,
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
    const normalizedEmail = normalizeTeamEmail(email);
    const normalizedRole = normalizeTeamRole(role);

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!normalizedRole) {
      return res.status(400).json({ error: 'Invalid team role' });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if already a team member
    const existing = await prisma.teamMember.findUnique({
      where: { eventId_email: { eventId: id, email: normalizedEmail } }
    });

    if (existing) {
      return res.status(400).json({ error: 'User is already a team member' });
    }

    const teamMember = await prisma.teamMember.create({
      data: {
        eventId: id,
        email: normalizedEmail,
        name: name || null,
        role: normalizedRole
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
    const normalizedRole = hasOwn(req.body || {}, 'role') ? normalizeTeamRole(role) : null;

    if (!normalizedRole) {
      return res.status(400).json({ error: 'Invalid team role' });
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const existingMember = await prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!existingMember || existingMember.eventId !== id) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const teamMember = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role: normalizedRole }
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

    const existingMember = await prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!existingMember || existingMember.eventId !== id) {
      return res.status(404).json({ error: 'Team member not found' });
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
    const selectedCertificateType = normalizeCertificateType(certificateType);

    if (!selectedCertificateType) {
      return res.status(400).json({ error: 'Invalid certificate type' });
    }

    const access = await checkEventAccess(req.user, id, CERTIFICATE_ACCESS_ROLES);
    if (!access.hasAccess) {
      return sendAccessDenied(res, access);
    }

    console.log('Test certificate request:', {
      eventId: id,
      certificateType: selectedCertificateType,
      hasTemplateUrl: !!templateUrl,
      templateUrlType: templateUrl ? (templateUrl.startsWith('data:') ? 'data-url' : templateUrl.substring(0, 80)) : 'none',
      mappingCount: mapping?.length || 0
    });

    // Use provided template/mapping or fetch from event
    let finalTemplateUrl = templateUrl;
    let finalMapping = mapping;

    if (!templateUrl || !mapping) {
      const event = await prisma.event.findUnique({
        where: { id }
      });

      if (!event) return res.status(404).json({ error: 'Event not found' });

      // If a specific certificate type is requested, look in certificateConfigs
      if (selectedCertificateType && event.certificateConfigs) {
        const configs = event.certificateConfigs;
        const config = configs[selectedCertificateType];
        if (config) {
          finalTemplateUrl = finalTemplateUrl || config.templateUrl;
          finalMapping = finalMapping || config.mapping;
        }
      }

      // Fallback to legacy fields
      if (!finalTemplateUrl) {
        finalTemplateUrl = event.certificateTemplateUrl;
      }
      if (!finalMapping) {
        finalMapping = event.certificateMapping;
      }
    }

    if (!finalTemplateUrl) {
      return res.status(400).json({ error: 'No template URL provided. Please upload and save a PDF template first.' });
    }

    // Generate with sample data
    const typeLabel = CERTIFICATE_TYPE_LABELS[selectedCertificateType] || selectedCertificateType;
    const sampleData = {
      userName: 'John Doe',
      eventName: 'Sample Event Name',
      date: new Date().toDateString(),
      qrCode: 'TEST-QR-12345',
      certificateType: typeLabel,
      rank: selectedCertificateType === 'first_prize' ? '1st Place' :
            selectedCertificateType === 'second_prize' ? '2nd Place' :
            selectedCertificateType === 'third_prize' ? '3rd Place' : ''
    };

    console.log('Generating test certificate with template type:',
      finalTemplateUrl.startsWith('data:') ? 'data-url' : finalTemplateUrl.substring(0, 80),
      'mapping fields:', (finalMapping || []).map(m => m.fieldId).join(', ')
    );

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
    const selectedCertificateType = normalizeCertificateType(certificateType);

    if (!selectedCertificateType) {
      return res.status(400).json({ error: 'Invalid certificate type' });
    }

    const access = await checkEventAccess(req.user, id, ['MANAGER', 'SUPER_MANAGER']);
    if (!access.hasAccess) {
      return sendAccessDenied(res, access);
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const configs = { ...(event.certificateConfigs || {}) };
    configs[selectedCertificateType] = {
      templateUrl: templateUrl || configs[selectedCertificateType]?.templateUrl,
      mapping: mapping || configs[selectedCertificateType]?.mapping || [],
      enabled: enabled !== undefined ? enabled : true,
    };

    // Also set legacy fields if this is the participation certificate
    const updateData = {
      certificateConfigs: configs,
      certificateEnabled: true,
    };

    if (selectedCertificateType === 'participation') {
      updateData.certificateTemplateUrl = configs[selectedCertificateType].templateUrl;
      updateData.certificateMapping = configs[selectedCertificateType].mapping;
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
    const access = await checkEventAccess(req.user, id, CERTIFICATE_ACCESS_ROLES);
    if (!access.hasAccess) {
      return sendAccessDenied(res, access);
    }

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
    const configs = { ...(event.certificateConfigs || {}) };

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

// Proxy endpoint: serve certificate template PDF (avoids Cloudinary 401 for raw files)
router.get('/events/:id/certificates/template', async (req, res) => {
  try {
    const { id } = req.params;
    const type = normalizeCertificateType(req.query.type || 'participation');

    if (!type) {
      return res.status(400).json({ error: 'Invalid certificate type' });
    }

    const access = await checkEventAccess(req.user, id, CERTIFICATE_ACCESS_ROLES);
    if (!access.hasAccess) {
      return sendAccessDenied(res, access);
    }

    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        certificateTemplateUrl: true,
        certificateConfigs: true,
      }
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Find the template URL
    const configs = { ...(event.certificateConfigs || {}) };
    let templateUrl = configs[type]?.templateUrl || event.certificateTemplateUrl;

    if (!templateUrl) {
      return res.status(404).json({ error: 'No template configured' });
    }

    // Serve from R2 directly
    if (isR2TemplateRef(templateUrl)) {
      try {
        const buffer = await getR2ObjectBuffer(templateUrl);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(buffer);
      } catch (r2Err) {
        console.error('R2 fetch failed for template:', r2Err.message);
        return res.status(500).json({ error: 'Failed to fetch template from storage' });
      }
    }

    // For any HTTP URL (Cloudinary or otherwise), fetch with retries
    if (templateUrl.startsWith('http')) {
      let buffer = null;

      // For Cloudinary URLs, use the dedicated download helper
      if (templateUrl.includes('cloudinary.com')) {
        try {
          const { downloadCloudinaryBuffer } = await import('../utils/cloudinary.util.js');
          buffer = await downloadCloudinaryBuffer(templateUrl);
          if (buffer) console.log('Cloudinary download success:', buffer.length, 'bytes');
        } catch (err) {
          console.error('Cloudinary download error:', err.message);
        }
      }

      // For non-Cloudinary URLs or if Cloudinary download failed, try direct fetch
      if (!buffer) {
        try {
          const response = await fetch(templateUrl);
          if (response.ok) {
            buffer = Buffer.from(await response.arrayBuffer());
          } else {
            console.error('Template direct fetch failed:', response.status, response.statusText);
          }
        } catch (fetchErr) {
          console.error('Template fetch error:', fetchErr.message);
        }
      }

      if (!buffer) {
        return res.status(502).json({ error: 'Failed to fetch template from remote source' });
      }

      // Auto-migrate to R2 for future reliability
      if (isR2Configured() && !isR2TemplateRef(templateUrl)) {
        try {
          const key = `certificates/templates/migrated-${id}-${type}-${Date.now()}.pdf`;
          const r2Url = await uploadBufferToR2({ buffer, key, contentType: 'application/pdf' });
          // Update the event config to use R2 URL
          if (configs[type]?.templateUrl) {
            configs[type].templateUrl = r2Url;
            await prisma.event.update({ where: { id }, data: { certificateConfigs: configs } });
          }
          if (event.certificateTemplateUrl === templateUrl) {
            await prisma.event.update({ where: { id }, data: { certificateTemplateUrl: r2Url } });
          }
          console.log('Auto-migrated certificate template to R2:', r2Url);
        } catch (migrateErr) {
          console.error('Auto-migrate to R2 failed (non-fatal):', migrateErr.message);
        }
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buffer);
    }

    // For local files, read from disk
    if (!templateUrl.startsWith('http')) {
      const localPath = templateUrl.startsWith('/uploads/')
        ? path.join(__dirname, '../../', templateUrl)
        : path.join(__dirname, '../../uploads/', templateUrl);

      if (!fs.existsSync(localPath)) {
        return res.status(404).json({ error: 'Template file not found' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(fs.readFileSync(localPath));
    }

    return res.status(400).json({ error: 'Unsupported template URL format' });
  } catch (error) {
    console.error('Template proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
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
    const selectedCertificateType = normalizeCertificateType(certificateType);

    if (!selectedCertificateType) {
      return res.status(400).json({ error: 'Invalid certificate type' });
    }

    if (recipientEmails !== undefined && !Array.isArray(recipientEmails)) {
      return res.status(400).json({ error: 'recipientEmails must be an array' });
    }

    const access = await checkEventAccess(req.user, id, CERTIFICATE_ACCESS_ROLES);
    if (!access.hasAccess) {
      return sendAccessDenied(res, access);
    }

    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check if the requested certificate type has a config
    const configs = { ...(event.certificateConfigs || {}) };
    const typeConfig = configs[selectedCertificateType];
    const hasLegacyConfig = selectedCertificateType === 'participation' && event.certificateTemplateUrl;

    if (!typeConfig?.templateUrl && !hasLegacyConfig) {
      return res.status(400).json({ error: `No template configured for certificate type: ${selectedCertificateType}` });
    }

    // Resolve the template URL (may need migration from Cloudinary to R2)
    let resolvedTemplateUrl = typeConfig?.templateUrl || event.certificateTemplateUrl;

    // If it's a Cloudinary URL, download via API and migrate to R2
    if (resolvedTemplateUrl && resolvedTemplateUrl.includes('cloudinary.com')) {
      try {
        const { downloadCloudinaryBuffer } = await import('../utils/cloudinary.util.js');
        const templateBuffer = await downloadCloudinaryBuffer(resolvedTemplateUrl);

        if (templateBuffer && isR2Configured()) {
          const key = `certificates/templates/migrated-${id}-${selectedCertificateType}-${Date.now()}.pdf`;
          const r2Url = await uploadBufferToR2({ buffer: templateBuffer, key, contentType: 'application/pdf' });
          // Update event config
          if (typeConfig?.templateUrl) {
            configs[selectedCertificateType].templateUrl = r2Url;
            await prisma.event.update({ where: { id }, data: { certificateConfigs: configs } });
          }
          if (event.certificateTemplateUrl === resolvedTemplateUrl) {
            await prisma.event.update({ where: { id }, data: { certificateTemplateUrl: r2Url } });
          }
          resolvedTemplateUrl = r2Url;
          console.log('Migrated certificate template to R2 before sending:', r2Url);
        } else if (!templateBuffer) {
          console.error('Cloudinary download returned null — certificate sending may fail');
        }
      } catch (migrateErr) {
        console.error('Template migration failed (will try direct fetch):', migrateErr.message);
      }
    }

    // For prize certificates, use recipientEmails; for participation, use checked-in attendees
    let recipients = [];

    if (recipientEmails && recipientEmails.length > 0) {
      // Sending to specific recipients (prize certificates)
      recipients = recipientEmails
        .map(email => String(email || '').trim().toLowerCase())
        .filter(Boolean)
        .map(email => ({ email, userName: email.split('@')[0] }));

      // Try to resolve names from users table
      for (let i = 0; i < recipients.length; i++) {
        const user = await prisma.user.findUnique({ where: { email: recipients[i].email } });
        if (user) recipients[i].userName = user.name;
      }
    } else {
      // Find checked-in tickets (participation certificates)
      // Check both checkedInAt (new) and scannedAt (legacy) for backward compatibility
      const tickets = await prisma.ticket.findMany({
        where: {
          OR: [
            { checkedInAt: { not: null } },
            { scannedAt: { not: null } }
          ],
          order: {
            registration: {
              eventId: id
            },
            status: 'PAID'
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
        const userName = user ? user.name : (registration.formResponse?.name || registration.userEmail.split('@')[0]);
        recipients.push({ email: registration.userEmail, userName, ticketId: ticket.id });
      }
    }

    if (dryRun) {
      return res.json({ message: 'Dry run complete', count: recipients.length });
    }

    let sentCount = 0;
    let generatedCount = 0;
    const errors = [];
    const emailErrors = [];
    const generatedCertificates = [];
    const templateMapping = typeConfig?.mapping || event.certificateMapping || [];
    const typeLabel = CERTIFICATE_TYPE_LABELS[selectedCertificateType] || 'Participation';
    const emailConfigured = isEmailDeliveryConfigured?.() === true;

    for (const recipient of recipients) {
      try {
        const pdfBytes = await generateCertificate(
          resolvedTemplateUrl,
          templateMapping,
          {
            userName: recipient.userName,
            eventName: event.title,
            date: event.startTime.toDateString(),
            qrCode: recipient.ticketId || recipient.email,
            certificateType: typeLabel,
            rank: selectedCertificateType === 'first_prize' ? '1st Place' :
                  selectedCertificateType === 'second_prize' ? '2nd Place' :
                  selectedCertificateType === 'third_prize' ? '3rd Place' : ''
          }
        );
        const pdfBuffer = Buffer.from(pdfBytes);
        const certificateUrl = await storeGeneratedCertificatePdf({
          buffer: pdfBuffer,
          eventId: id,
          certificateType: selectedCertificateType,
          recipientEmail: recipient.email
        });
        generatedCount++;
        generatedCertificates.push({
          email: recipient.email,
          userName: recipient.userName,
          certificateUrl
        });

        if (emailConfigured) {
          try {
            await sendCertificateEmail(
              recipient.email,
              recipient.userName,
              event.title,
              pdfBuffer,
              typeLabel
            );
            sentCount++;
          } catch (emailError) {
            console.error(`Generated ${selectedCertificateType} cert but email failed for ${recipient.email}:`, emailError.message);
            emailErrors.push({ email: recipient.email, error: emailError.message, certificateUrl });
          }
        }
      } catch (err) {
        console.error(`Failed to generate ${selectedCertificateType} cert for ${recipient.email}:`, err.message);
        errors.push({ email: recipient.email, error: err.message });
      }
    }

    const deliveryNote = emailConfigured
      ? `emailed to ${sentCount} recipients`
      : 'email delivery is not configured; generated PDF links are returned';

    res.json({
      message: `${typeLabel} certificates generated for ${generatedCount} recipients; ${deliveryNote}`,
      sent: sentCount,
      generated: generatedCount,
      failed: errors.length,
      emailFailed: emailErrors.length,
      total: recipients.length,
      certificates: generatedCertificates,
      errors: errors.length > 0 ? errors : undefined,
      emailErrors: emailErrors.length > 0 ? emailErrors : undefined
    });

  } catch (error) {
    console.error('Certificate generation error:', error);
    res.status(500).json({ error: 'Failed to generate certificates: ' + error.message });
  }
});

export default router;
