import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../config/db.js';

const router = express.Router();

// Join Waitlist
router.post('/events/:id/waitlist', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('name').notEmpty().withMessage('Name is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { email, name, phone } = req.body;

    try {
        const event = await prisma.event.findUnique({
            where: { id }
        });

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check if duplicate
        const existing = await prisma.waitlist.findFirst({
            where: {
                eventId: id,
                email
            }
        });

        if (existing) {
            return res.status(409).json({ error: 'You are already on the waitlist' });
        }

        const entry = await prisma.waitlist.create({
            data: {
                eventId: id,
                email,
                name,
                phone
            }
        });

        res.status(201).json({ message: 'Added to waitlist', entry });
    } catch (error) {
        console.error('Waitlist error:', error);
        res.status(500).json({ error: 'Failed to join waitlist' });
    }
});

export default router;
