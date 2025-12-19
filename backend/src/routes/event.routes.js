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

import { createEvent } from 'ics';

// Download ICS
router.get('/:id/calendar', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    // Format dates for ICS ([year, month, day, hour, minute])
    const eventAttributes = {
      start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
      end: [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()],
      title: event.title,
      description: event.description,
      location: event.location,
      url: `${process.env.FRONTEND_URL}/events/${event.id}`,
      // Use event.organizerId or fetch organizer detail if needed, simple for now
    };

    createEvent(eventAttributes, (error, value) => {
      if (error) {
        console.error('ICS Generation error:', error);
        return res.status(500).json({ error: 'Failed to generate calendar file' });
      }

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename="${event.slug || 'event'}.ics"`);
      res.send(value);
    });

  } catch (error) {
    console.error('Calendar download error:', error);
    res.status(500).json({ error: 'Failed to generate calendar file' });
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
              where: { status: { in: ['PAID', 'CONFIRMED'] } }
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
