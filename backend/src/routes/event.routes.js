import express from 'express';
import prisma from '../config/db.js';

const router = express.Router();

// Get all published events
router.get('/', async (req, res) => {
  try {
    const { search, upcoming } = req.query;
    
    const where = {
      published: true,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(upcoming === 'true' && {
        startTime: { gte: new Date() }
      })
    };

    const events = await prisma.event.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        location: true,
        startTime: true,
        endTime: true,
        capacity: true,
        priceCents: true,
        currency: true,
        posterUrl: true,
        createdAt: true,
        organizer: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event by ID or slug
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const event = await prisma.event.findFirst({
      where: {
        OR: [
          { id: identifier },
          { slug: identifier }
        ],
        published: true
      },
      include: {
        organizer: {
          select: {
            name: true,
            email: true
          }
        },
        form: true,
        _count: {
          select: {
            registrations: {
              where: { status: 'PAID' }
            }
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Get event form
router.get('/:id/form', async (req, res) => {
  try {
    let form = await prisma.form.findUnique({
      where: { eventId: req.params.id }
    });

    // If no form exists, return a default form
    if (!form) {
      const defaultForm = {
        id: 'default',
        eventId: req.params.id,
        schemaJson: {
          title: 'Registration Form',
          fields: [
            { key: 'name', type: 'text', label: 'Full Name', required: true },
            { key: 'email', type: 'email', label: 'Email', required: true },
            { key: 'phone', type: 'tel', label: 'Phone Number', required: false }
          ]
        },
        createdAt: new Date()
      };
      return res.json(defaultForm);
    }

    res.json(form);
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ error: 'Failed to fetch form' });
  }
});

export default router;
