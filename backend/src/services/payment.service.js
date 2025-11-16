import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export async function createRazorpayOrder(order) {
  try {
    const options = {
      amount: order.amountCents, // amount in paise
      currency: order.currency,
      receipt: order.id,
      notes: {
        orderId: order.id,
        registrationId: order.registrationId,
        eventId: order.registration.eventId
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);
    return razorpayOrder;
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw error;
  }
}

export function verifyRazorpaySignature(body, signature) {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export async function createStripeCheckoutSession(order) {
  // Stripe implementation
  // This is a placeholder for Stripe integration
  throw new Error('Stripe integration not implemented yet');
}
