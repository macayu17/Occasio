import express from 'express';
import prisma from '../config/db.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// ============================================
// TICKET TIERS
// ============================================

// Get all tiers for an event (public)
router.get('/events/:eventId/tiers', async (req, res) => {
    try {
        const { eventId } = req.params;

        const tiers = await prisma.ticketTier.findMany({
            where: {
                eventId,
                isActive: true
            },
            orderBy: { sortOrder: 'asc' }
        });

        res.json(tiers);
    } catch (error) {
        console.error('Get tiers error:', error);
        res.status(500).json({ error: 'Failed to fetch tiers' });
    }
});

// ============================================
// SPEAKERS
// ============================================

// Get all speakers for an event (public)
router.get('/events/:eventId/speakers', async (req, res) => {
    try {
        const { eventId } = req.params;

        const speakers = await prisma.speaker.findMany({
            where: { eventId },
            orderBy: { sortOrder: 'asc' }
        });

        res.json(speakers);
    } catch (error) {
        console.error('Get speakers error:', error);
        res.status(500).json({ error: 'Failed to fetch speakers' });
    }
});

// ============================================
// ADMIN ROUTES (Protected)
// ============================================

// --- TICKET TIERS ADMIN ---

// Create tier
router.post('/admin/events/:eventId/tiers', authenticate, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { name, description, priceCents, capacity, sortOrder } = req.body;

        // Verify event ownership
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const tier = await prisma.ticketTier.create({
            data: {
                eventId,
                name,
                description,
                priceCents: parseInt(priceCents) || 0,
                capacity: capacity ? parseInt(capacity) : null,
                sortOrder: parseInt(sortOrder) || 0
            }
        });

        res.status(201).json(tier);
    } catch (error) {
        console.error('Create tier error:', error);
        res.status(500).json({ error: 'Failed to create tier' });
    }
});

// Update tier
router.put('/admin/tiers/:tierId', authenticate, async (req, res) => {
    try {
        const { tierId } = req.params;
        const { name, description, priceCents, capacity, sortOrder, isActive } = req.body;

        const tier = await prisma.ticketTier.findUnique({
            where: { id: tierId },
            include: { event: true }
        });

        if (!tier) return res.status(404).json({ error: 'Tier not found' });
        if (tier.event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const updated = await prisma.ticketTier.update({
            where: { id: tierId },
            data: {
                name,
                description,
                priceCents: priceCents !== undefined ? parseInt(priceCents) : undefined,
                capacity: capacity !== undefined ? (capacity ? parseInt(capacity) : null) : undefined,
                sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : undefined,
                isActive: isActive !== undefined ? isActive : undefined
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Update tier error:', error);
        res.status(500).json({ error: 'Failed to update tier' });
    }
});

// Delete tier
router.delete('/admin/tiers/:tierId', authenticate, async (req, res) => {
    try {
        const { tierId } = req.params;

        const tier = await prisma.ticketTier.findUnique({
            where: { id: tierId },
            include: { event: true }
        });

        if (!tier) return res.status(404).json({ error: 'Tier not found' });
        if (tier.event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await prisma.ticketTier.delete({ where: { id: tierId } });
        res.json({ success: true, message: 'Tier deleted' });
    } catch (error) {
        console.error('Delete tier error:', error);
        res.status(500).json({ error: 'Failed to delete tier' });
    }
});

// --- SPEAKERS ADMIN ---

// Create speaker
router.post('/admin/events/:eventId/speakers', authenticate, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { name, title, bio, photoUrl, linkedIn, twitter, sortOrder } = req.body;

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const speaker = await prisma.speaker.create({
            data: {
                eventId,
                name,
                title,
                bio,
                photoUrl,
                linkedIn,
                twitter,
                sortOrder: parseInt(sortOrder) || 0
            }
        });

        res.status(201).json(speaker);
    } catch (error) {
        console.error('Create speaker error:', error);
        res.status(500).json({ error: 'Failed to create speaker' });
    }
});

// Update speaker
router.put('/admin/speakers/:speakerId', authenticate, async (req, res) => {
    try {
        const { speakerId } = req.params;
        const { name, title, bio, photoUrl, linkedIn, twitter, sortOrder } = req.body;

        const speaker = await prisma.speaker.findUnique({
            where: { id: speakerId },
            include: { event: true }
        });

        if (!speaker) return res.status(404).json({ error: 'Speaker not found' });
        if (speaker.event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const updated = await prisma.speaker.update({
            where: { id: speakerId },
            data: { name, title, bio, photoUrl, linkedIn, twitter, sortOrder }
        });

        res.json(updated);
    } catch (error) {
        console.error('Update speaker error:', error);
        res.status(500).json({ error: 'Failed to update speaker' });
    }
});

// Delete speaker
router.delete('/admin/speakers/:speakerId', authenticate, async (req, res) => {
    try {
        const { speakerId } = req.params;

        const speaker = await prisma.speaker.findUnique({
            where: { id: speakerId },
            include: { event: true }
        });

        if (!speaker) return res.status(404).json({ error: 'Speaker not found' });
        if (speaker.event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await prisma.speaker.delete({ where: { id: speakerId } });
        res.json({ success: true, message: 'Speaker deleted' });
    } catch (error) {
        console.error('Delete speaker error:', error);
        res.status(500).json({ error: 'Failed to delete speaker' });
    }
});

// --- REMINDERS ADMIN ---

// Get reminders for an event
router.get('/admin/events/:eventId/reminders', authenticate, async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const reminders = await prisma.eventReminder.findMany({
            where: { eventId },
            orderBy: { hoursBeforeEvent: 'desc' }
        });

        res.json(reminders);
    } catch (error) {
        console.error('Get reminders error:', error);
        res.status(500).json({ error: 'Failed to fetch reminders' });
    }
});

// Create reminder
router.post('/admin/events/:eventId/reminders', authenticate, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { hoursBeforeEvent, subject, message } = req.body;

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const reminder = await prisma.eventReminder.create({
            data: {
                eventId,
                hoursBeforeEvent: parseInt(hoursBeforeEvent),
                subject,
                message
            }
        });

        res.status(201).json(reminder);
    } catch (error) {
        console.error('Create reminder error:', error);
        res.status(500).json({ error: 'Failed to create reminder' });
    }
});

// Update reminder
router.put('/admin/reminders/:reminderId', authenticate, async (req, res) => {
    try {
        const { reminderId } = req.params;
        const { hoursBeforeEvent, subject, message, isActive } = req.body;

        const reminder = await prisma.eventReminder.findUnique({
            where: { id: reminderId },
            include: { event: true }
        });

        if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
        if (reminder.event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const updated = await prisma.eventReminder.update({
            where: { id: reminderId },
            data: {
                hoursBeforeEvent: hoursBeforeEvent !== undefined ? parseInt(hoursBeforeEvent) : undefined,
                subject,
                message,
                isActive
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Update reminder error:', error);
        res.status(500).json({ error: 'Failed to update reminder' });
    }
});

// Delete reminder
router.delete('/admin/reminders/:reminderId', authenticate, async (req, res) => {
    try {
        const { reminderId } = req.params;

        const reminder = await prisma.eventReminder.findUnique({
            where: { id: reminderId },
            include: { event: true }
        });

        if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
        if (reminder.event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await prisma.eventReminder.delete({ where: { id: reminderId } });
        res.json({ success: true, message: 'Reminder deleted' });
    } catch (error) {
        console.error('Delete reminder error:', error);
        res.status(500).json({ error: 'Failed to delete reminder' });
    }
});

export default router;
