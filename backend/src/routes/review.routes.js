import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../config/db.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get reviews for an event
router.get('/events/:id/reviews', async (req, res) => {
    try {
        const { id } = req.params;
        const reviews = await prisma.review.findMany({
            where: { eventId: id },
            include: {
                user: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate average
        const aggregate = await prisma.review.aggregate({
            where: { eventId: id },
            _avg: { rating: true },
            _count: { rating: true }
        });

        res.json({
            reviews,
            stats: {
                average: aggregate._avg.rating || 0,
                count: aggregate._count.rating || 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// Create a review
router.post('/events/:id/reviews', [
    authenticate,
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().trim().isLength({ max: 500 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { id } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        // 1. Check if event exists
        const event = await prisma.event.findUnique({ where: { id } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // 2. Check if user has attended (Paid/Confirmed registration and event has ended/started?)
        // Let's assume they can review if they have a valid registration. 
        // Ideally enforce that event.startTime < now (post-event review)
        if (new Date(event.startTime) > new Date()) {
            return res.status(400).json({ error: 'Cannot review, event has not started yet' });
        }

        const registration = await prisma.registration.findFirst({
            where: {
                eventId: id,
                userEmail: req.user.email, // using email as link since user ID might vary if they registered as guest then signed up.
                // Wait, Schema has 'userId' in Review.
                // If user authenticated, we check if they have a registration.
                // If Registration table has `userEmail`, does it link to User?
                // The schema doesn't explicitly link Registration to User model, just `userEmail`.
                // So we check by email.
                status: { in: ['PAID', 'CONFIRMED'] }
            }
        });

        if (!registration) {
            return res.status(403).json({ error: 'You need a confirmed registration to review this event' });
        }

        // 3. Create Review
        const review = await prisma.review.create({
            data: {
                eventId: id,
                userId: userId,
                rating,
                comment
            }
        });

        res.status(201).json(review);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'You have already reviewed this event' });
        res.status(500).json({ error: 'Failed to submit review' });
    }
});

export default router;
