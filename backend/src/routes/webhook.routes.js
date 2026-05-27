import express from 'express';
import prisma from '../config/db.js';
import { verifyRazorpaySignature } from '../services/payment.service.js';
import { completePaidOrder } from '../services/order-completion.service.js';

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
      const orderId = event.payload.payment.entity.order_id;
      // Find order
      const order = await prisma.order.findFirst({
        where: { providerOrderId: orderId }
      });

      if (!order) {
        console.error('Order not found:', orderId);
        return res.status(404).json({ error: 'Order not found' });
      }

      await completePaidOrder(order.id, {
        razorpayWebhook: event.payload.payment.entity
      });

      console.log('Payment processed successfully:', orderId);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Webhook processing failed'
    });
  }
});

// Stripe webhook (alternative)
router.post('/stripe', (req, res) => {
  res.status(501).json({
    error: 'Stripe webhooks are not implemented. Use Razorpay or PhonePe for payments.'
  });
});

export default router;
