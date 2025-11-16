import { Queue, Worker } from 'bullmq';
import redisClient from '../config/redis.js';
import { generateTicketPDF } from './ticket.service.js';
import { sendTicketEmail } from './email.service.js';
import prisma from '../config/db.js';

const connection = redisClient;

// Create queues
export const ticketQueue = new Queue('ticket-generation', { connection });
export const emailQueue = new Queue('email-sending', { connection });

// Ticket generation worker
const ticketWorker = new Worker(
  'ticket-generation',
  async (job) => {
    const { orderId } = job.data;
    
    console.log(`Processing ticket generation for order: ${orderId}`);

    try {
      // Get order details
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

      // Generate ticket and PDF
      const ticket = await generateTicketPDF(order);

      // Enqueue email sending
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

// Helper functions
export async function enqueueTicketGeneration(orderId) {
  await ticketQueue.add('generate-ticket', { orderId }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
}

export async function enqueueEmailSending(ticketId, email) {
  await emailQueue.add('send-ticket-email', { ticketId, email }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
}
