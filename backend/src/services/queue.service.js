import { Queue, Worker } from 'bullmq';
import { generateTicketPDF } from './ticket.service.js';
import { sendTicketEmail } from './email.service.js';
import prisma from '../config/db.js';

let connection = null;
let ticketQueue = null;
let emailQueue = null;
let isRedisAvailable = false;

// Try to connect to Redis
async function initializeRedis() {
  try {
    const { default: redisClient } = await import('../config/redis.js');
    connection = redisClient;

    // Test connection
    await redisClient.ping();
    isRedisAvailable = true;

    // Create queues
    ticketQueue = new Queue('ticket-generation', { connection });
    emailQueue = new Queue('email-sending', { connection });

    // Ticket generation worker
    const ticketWorker = new Worker(
      'ticket-generation',
      async (job) => {
        const { orderId } = job.data;
        console.log(`Processing ticket generation for order: ${orderId}`);

        try {
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
              registration: {
                include: {
                  event: true
                }
              }
            }
          });

          if (!order) {
            throw new Error('Order not found');
          }

          const ticket = await generateTicketPDF(order);

          await emailQueue.add('send-ticket-email', {
            ticketId: ticket.id,
            email: order.registration.userEmail
          });

          console.log(`Ticket generated successfully for order: ${orderId}`);
          return { success: true, ticketId: ticket.id };
        } catch (error) {
          console.error('Ticket generation failed:', error);
          throw error;
        }
      },
      { connection }
    );

    // Email sending worker
    const emailWorker = new Worker(
      'email-sending',
      async (job) => {
        const { ticketId, email } = job.data;
        console.log(`Sending ticket email to: ${email}`);

        try {
          await sendTicketEmail(ticketId, email);
          console.log(`Ticket email sent successfully to: ${email}`);
          return { success: true };
        } catch (error) {
          console.error('Email sending failed:', error);
          throw error;
        }
      },
      { connection }
    );

    // Event listeners
    ticketWorker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    ticketWorker.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });

    emailWorker.on('completed', (job) => {
      console.log(`Email job ${job.id} completed successfully`);
    });

    emailWorker.on('failed', (job, err) => {
      console.error(`Email job ${job.id} failed:`, err);
    });

    console.log('✅ Redis queues initialized');
  } catch (error) {
    console.warn('⚠️ Redis not available - background jobs will run synchronously');
    isRedisAvailable = false;
  }
}

// Initialize on module load
initializeRedis();

// Helper functions with fallback
export async function enqueueTicketGeneration(orderId) {
  if (isRedisAvailable && ticketQueue) {
    await ticketQueue.add('generate-ticket', { orderId }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  } else {
    // Fallback: process synchronously
    console.log('Processing ticket synchronously (Redis not available)');
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          registration: {
            include: {
              event: true
            }
          }
        }
      });

      if (order) {
        const ticket = await generateTicketPDF(order);
        console.log(`Ticket generated synchronously: ${ticket.id}`);

        // Try to send email
        try {
          await sendTicketEmail(ticket.id, order.registration.userEmail);
          console.log(`Email sent to: ${order.registration.userEmail}`);
        } catch (emailErr) {
          console.warn('Email sending failed (check SMTP settings):', emailErr.message);
        }
      }
    } catch (error) {
      console.error('Synchronous ticket generation failed:', error);
    }
  }
}

export async function enqueueEmailSending(ticketId, email) {
  if (isRedisAvailable && emailQueue) {
    await emailQueue.add('send-ticket-email', { ticketId, email }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  } else {
    // Fallback: send synchronously
    console.log('Sending email synchronously (Redis not available)');
    try {
      await sendTicketEmail(ticketId, email);
      console.log(`Email sent synchronously to: ${email}`);
    } catch (error) {
      console.warn('Email sending failed (check SMTP settings):', error.message);
    }
  }
}

export { ticketQueue, emailQueue };
