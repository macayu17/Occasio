import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../config/db.js';
import { authenticate, requireOrganizer } from '../middleware/auth.middleware.js';
import { sendCustomEmail } from '../services/email.service.js';

const router = express.Router();

// ============================================
// PUBLIC ROUTES
// ============================================

// Get all active polls for an event (public)
router.get('/events/:eventId/polls', async (req, res) => {
    try {
        const { eventId } = req.params;

        const polls = await prisma.poll.findMany({
            where: {
                eventId,
                isActive: true,
                OR: [
                    { endsAt: null },
                    { endsAt: { gt: new Date() } }
                ]
            },
            include: {
                options: {
                    orderBy: { order: 'asc' },
                    include: {
                        _count: { select: { votes: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(polls);
    } catch (error) {
        console.error('Get polls error:', error);
        res.status(500).json({ error: 'Failed to fetch polls' });
    }
});

// Get poll results (public)
router.get('/polls/:pollId/results', async (req, res) => {
    try {
        const { pollId } = req.params;

        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            include: {
                options: {
                    orderBy: { order: 'asc' },
                    include: {
                        _count: { select: { votes: true } }
                    }
                }
            }
        });

        if (!poll) {
            return res.status(404).json({ error: 'Poll not found' });
        }

        const totalVotes = poll.options.reduce((sum, opt) => sum + opt._count.votes, 0);

        const results = {
            id: poll.id,
            question: poll.question,
            totalVotes,
            options: poll.options.map(opt => ({
                id: opt.id,
                text: opt.text,
                votes: opt._count.votes,
                percentage: totalVotes > 0 ? ((opt._count.votes / totalVotes) * 100).toFixed(1) : 0
            }))
        };

        res.json(results);
    } catch (error) {
        console.error('Get poll results error:', error);
        res.status(500).json({ error: 'Failed to fetch poll results' });
    }
});

// Vote on a poll (public - requires email)
router.post('/polls/:pollId/vote',
    [
        body('optionId').notEmpty(),
        body('voterEmail').isEmail()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { pollId } = req.params;
            const { optionId, voterEmail } = req.body;

            // Verify poll exists and is active
            const poll = await prisma.poll.findUnique({
                where: { id: pollId },
                include: { options: true }
            });

            if (!poll) {
                return res.status(404).json({ error: 'Poll not found' });
            }

            if (!poll.isActive) {
                return res.status(400).json({ error: 'Poll is closed' });
            }

            if (poll.endsAt && new Date(poll.endsAt) < new Date()) {
                return res.status(400).json({ error: 'Poll has ended' });
            }

            // Verify option belongs to this poll
            const option = poll.options.find(o => o.id === optionId);
            if (!option) {
                return res.status(400).json({ error: 'Invalid option' });
            }

            // Check if already voted (for any option in this poll)
            if (!poll.allowMultiple) {
                const existingVote = await prisma.pollVote.findFirst({
                    where: {
                        voterEmail,
                        option: { pollId }
                    }
                });

                if (existingVote) {
                    return res.status(400).json({ error: 'You have already voted on this poll' });
                }
            }

            // Create vote
            await prisma.pollVote.create({
                data: {
                    optionId,
                    voterEmail
                }
            });

            res.json({ success: true, message: 'Vote recorded' });
        } catch (error) {
            console.error('Vote error:', error);
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'You have already voted for this option' });
            }
            res.status(500).json({ error: 'Failed to record vote' });
        }
    }
);

// ============================================
// ADMIN ROUTES
// ============================================

// All admin routes require authentication
router.use('/admin', authenticate);
router.use('/admin', requireOrganizer);

// Get all polls for an event (admin)
router.get('/admin/events/:eventId/polls', async (req, res) => {
    try {
        const { eventId } = req.params;

        // Verify ownership
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const polls = await prisma.poll.findMany({
            where: { eventId },
            include: {
                options: {
                    orderBy: { order: 'asc' },
                    include: {
                        _count: { select: { votes: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(polls);
    } catch (error) {
        console.error('Get admin polls error:', error);
        res.status(500).json({ error: 'Failed to fetch polls' });
    }
});

// Create a poll (admin)
router.post('/admin/events/:eventId/polls',
    [
        body('question').notEmpty().trim(),
        body('options').isArray({ min: 2 }).withMessage('At least 2 options required'),
        body('options.*.text').notEmpty()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { eventId } = req.params;
            const { question, description, options, allowMultiple, endsAt, notifyUsers } = req.body;

            // Verify ownership
            const event = await prisma.event.findUnique({
                where: { id: eventId },
                include: { registrations: { where: { status: 'PAID' }, select: { userEmail: true } } }
            });
            if (!event) return res.status(404).json({ error: 'Event not found' });
            if (event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
                return res.status(403).json({ error: 'Not authorized' });
            }

            // Create poll with options
            const poll = await prisma.poll.create({
                data: {
                    eventId,
                    question,
                    description,
                    allowMultiple: allowMultiple || false,
                    endsAt: endsAt ? new Date(endsAt) : null,
                    options: {
                        create: options.map((opt, idx) => ({
                            text: opt.text,
                            order: idx
                        }))
                    }
                },
                include: { options: true }
            });

            // Send notification to attendees if requested
            if (notifyUsers && event.registrations.length > 0) {
                const emails = [...new Set(event.registrations.map(r => r.userEmail))];

                // Record notification
                await prisma.notification.create({
                    data: {
                        eventId,
                        type: 'poll_created',
                        title: `New Poll: ${question}`,
                        message: `A new poll has been created for "${event.title}". Cast your vote now!`,
                        recipientEmails: emails,
                        sentAt: new Date()
                    }
                });

                // Send emails in background
                setImmediate(async () => {
                    for (const email of emails) {
                        try {
                            await sendCustomEmail(
                                email,
                                `New Poll for ${event.title}`,
                                `<h2>New Poll Created</h2>
                <p><strong>${question}</strong></p>
                ${description ? `<p>${description}</p>` : ''}
                <p>Cast your vote at: ${process.env.FRONTEND_URL || 'https://occasio.vercel.app'}/events/${eventId}</p>
                <p>Options:</p>
                <ul>${options.map(o => `<li>${o.text}</li>`).join('')}</ul>`
                            );
                        } catch (e) {
                            console.error('Failed to send poll notification to', email);
                        }
                    }
                });
            }

            res.status(201).json(poll);
        } catch (error) {
            console.error('Create poll error:', error);
            res.status(500).json({ error: 'Failed to create poll' });
        }
    }
);

// Update poll (admin)
router.put('/admin/polls/:pollId', async (req, res) => {
    try {
        const { pollId } = req.params;
        const { question, description, isActive, endsAt } = req.body;

        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            include: { event: true }
        });

        if (!poll) return res.status(404).json({ error: 'Poll not found' });
        if (poll.event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const updated = await prisma.poll.update({
            where: { id: pollId },
            data: {
                question: question || undefined,
                description: description !== undefined ? description : undefined,
                isActive: isActive !== undefined ? isActive : undefined,
                endsAt: endsAt !== undefined ? (endsAt ? new Date(endsAt) : null) : undefined
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Update poll error:', error);
        res.status(500).json({ error: 'Failed to update poll' });
    }
});

// Delete poll (admin)
router.delete('/admin/polls/:pollId', async (req, res) => {
    try {
        const { pollId } = req.params;

        const poll = await prisma.poll.findUnique({
            where: { id: pollId },
            include: { event: true }
        });

        if (!poll) return res.status(404).json({ error: 'Poll not found' });
        if (poll.event.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await prisma.poll.delete({ where: { id: pollId } });

        res.json({ success: true, message: 'Poll deleted' });
    } catch (error) {
        console.error('Delete poll error:', error);
        res.status(500).json({ error: 'Failed to delete poll' });
    }
});

export default router;
