import express from 'express';
import crypto from 'crypto';
import prisma from '../config/db.js';
import { verifyRazorpaySignature } from '../services/payment.service.js';
import { enqueueTicketGeneration } from '../services/queue.service.js';

const router = express.Router();

// Razorpay webhook
router.post('/payments', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    // Verify signature
    const isValid = verifyRazorpaySignature(body, signature);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(body.toString());

    if (event.event === 'payment.captured') {
      const paymentId = event.payload.payment.entity.id;
      const orderId = event.payload.payment.entity.order_id;
      const amount = event.payload.payment.entity.amount;

      // Find order
      const order = await prisma.order.findFirst({
        where: { providerOrderId: orderId }
      });

      if (!order) {
        console.error('Order not found:', orderId);
        return res.status(404).json({ error: 'Order not found' });
      }

      // Update order status
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paymentData: event.payload.payment.entity
        }
      });

      // Update registration status
      await prisma.registration.update({
        where: { id: order.registrationId },
        data: { status: 'PAID' }
      });

      // Enqueue ticket generation
      await enqueueTicketGeneration(order.id);

      console.log('Payment processed successfully:', orderId);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Stripe webhook (alternative)
router.post('/stripe', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const body = req.body;

    // Verify Stripe signature
    // Implementation would go here

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
