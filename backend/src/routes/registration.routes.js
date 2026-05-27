import express from 'express';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import crypto from 'crypto';
import prisma from '../config/db.js';
import { createRazorpayOrder, createPhonePePayment, checkPhonePePaymentStatus } from '../services/payment.service.js';
import { completePaidOrder, mergePaymentData } from '../services/order-completion.service.js';
import {
  buildTicketTierSnapshot,
  calculateDiscountedAmountCents,
  isDiscountUsable,
  normalizeDiscountCode,
  resolveSelectedTicketTier
} from '../utils/registration-pricing.util.js';

const router = express.Router();
const ajv = new Ajv();
addFormats(ajv);

// Register for an event
router.post('/events/:id/register', async (req, res) => {
  try {
    const { id } = req.params;
    const { formResponse, discountCode, paymentGateway, tierId } = req.body;
    const selectedGateway = paymentGateway === 'PHONEPE' ? 'PHONEPE' : 'RAZORPAY';

    // Get event and form
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        form: true,
        ticketTiers: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event.published) {
      return res.status(400).json({ error: 'Event is not published' });
    }

    if (event.capacity > 0) {
      const reservedCount = await prisma.registration.count({
        where: {
          eventId: id,
          status: { not: 'CANCELLED' }
        }
      });

      if (reservedCount >= event.capacity) {
        return res.status(409).json({ error: 'Event is sold out' });
      }
    }

    const tierSelection = resolveSelectedTicketTier(event.ticketTiers, tierId);
    if (tierSelection.error) {
      return res.status(tierSelection.statusCode).json({ error: tierSelection.error });
    }
    const selectedTier = tierSelection.selectedTier;

    // Get form schema - use default if no custom form exists
    let formSchema;
    if (event.form) {
      formSchema = event.form.schemaJson;
    } else {
      // Use default schema
      formSchema = {
        title: 'Registration Form',
        fields: [
          { key: 'name', type: 'text', label: 'Full Name', required: true },
          { key: 'email', type: 'email', label: 'Email', required: true },
          { key: 'phone', type: 'tel', label: 'Phone Number', required: false }
        ]
      };
    }

    // Validate form response
    const validate = ajv.compile(convertFormSchemaToAjv(formSchema));

    if (!validate(formResponse)) {
      console.error('Form validation failed:', validate.errors);
      return res.status(400).json({
        error: 'Invalid form data',
        details: validate.errors
      });
    }

    // Extract email from form response
    const userEmail = formResponse.email;

    if (!userEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Create registration
    const registration = await prisma.registration.create({
      data: {
        eventId: id,
        userEmail,
        formResponse,
        status: 'PENDING'
      }
    });

    // Calculate Amount & Validate Discount
    const baseAmountCents = selectedTier ? selectedTier.priceCents : event.priceCents;
    let amountCents = baseAmountCents;
    let validDiscount = null;

    const normalizedDiscountCode = normalizeDiscountCode(discountCode);

    if (normalizedDiscountCode && baseAmountCents > 0) {
      const code = await prisma.discountCode.findUnique({
        where: { eventId_code: { eventId: id, code: normalizedDiscountCode } }
      });

      if (isDiscountUsable(code)) {
        validDiscount = code;
        amountCents = calculateDiscountedAmountCents(baseAmountCents, code);
      }
    }

    if (event.type === 'RSVP') {
      amountCents = 0;
    }

    // Create order with selected payment gateway
    const order = await prisma.order.create({
      data: {
        registrationId: registration.id,
        amountCents: amountCents,
        currency: event.currency,
        provider: selectedGateway,
        status: 'CREATED',
        discountCodeId: validDiscount ? validDiscount.id : undefined,
        paymentData: buildTicketTierSnapshot(selectedTier)
      }
    });

    // If free event (or became free via discount) or RSVP
    if (amountCents === 0 || event.type === 'RSVP') {
      const regStatus = event.type === 'RSVP' ? 'CONFIRMED' : 'PAID';

      const completion = await completePaidOrder(order.id, {}, { registrationStatus: regStatus });

      return res.json({
        registration: { ...registration, status: regStatus },
        order: completion.order,
        requiresPayment: false
      });
    }

    res.json({
      registration,
      order,
      requiresPayment: true
    });
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    res.status(error.statusCode || 500).json({
      error: 'Registration failed',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create payment session
router.post('/orders/:id/create-checkout-session', async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        registration: {
          include: {
            event: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID') {
      return res.status(400).json({ error: 'Order already paid' });
    }

    // Handle based on payment provider
    if (order.provider === 'PHONEPE') {
      // PhonePe redirect-based flow
      const callbackUrl = `${process.env.FRONTEND_URL}/payment/phonepe/callback?orderId=${order.id}`;
      const phonePeResponse = await createPhonePePayment(order, callbackUrl);

      // Update order with transaction ID
      await prisma.order.update({
        where: { id },
        data: {
          providerOrderId: phonePeResponse.transactionId,
          paymentData: mergePaymentData(order.paymentData, {
            phonePe: { transactionId: phonePeResponse.transactionId }
          })
        }
      });

      return res.json({
        provider: 'PHONEPE',
        paymentUrl: phonePeResponse.paymentUrl,
        transactionId: phonePeResponse.transactionId
      });
    }

    // Razorpay popup-based flow (default)
    const paymentOrder = await createRazorpayOrder(order);

    // Update order with provider order ID
    await prisma.order.update({
      where: { id },
      data: {
        providerOrderId: paymentOrder.id,
        paymentData: mergePaymentData(order.paymentData, {
          razorpayOrder: paymentOrder
        })
      }
    });

    res.json({
      provider: 'RAZORPAY',
      orderId: paymentOrder.id,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Failed to create checkout session',
      ...(error.gatewayCode ? { gatewayCode: error.gatewayCode } : {})
    });
  }
});

// Verify PhonePe payment status (called after redirect)
router.post('/orders/:id/verify-phonepe', async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { registration: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'PAID') {
      return res.json({ success: true, message: 'Payment already verified' });
    }

    // Check payment status with PhonePe
    const statusResponse = await checkPhonePePaymentStatus(order.providerOrderId);

    if (statusResponse.success && statusResponse.paymentState === 'COMPLETED') {
      await completePaidOrder(order.id, {
        phonePeStatus: statusResponse
      });

      return res.json({
        success: true,
        message: 'Payment verified successfully',
        eventId: order.registration.eventId,
        orderId: order.id
      });
    }

    if (statusResponse.paymentState === 'PENDING') {
      return res.status(202).json({ success: false, message: 'Payment pending', state: 'PENDING' });
    }

    return res.status(400).json({ success: false, message: 'Payment failed', state: statusResponse.paymentState });
  } catch (error) {
    console.error('PhonePe verification error:', error);
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Failed to verify PhonePe payment'
    });
  }
});

// Verify and complete payment (for manual verification after Razorpay success)
router.post('/orders/:id/verify-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        registration: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    await completePaidOrder(order.id, {
      razorpayPayment: {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature
      }
    });

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Failed to verify payment'
    });
  }
});

// Helper function to convert form schema to AJV schema
function convertFormSchemaToAjv(formSchema) {
  const properties = {};
  const required = [];

  formSchema.fields.forEach(field => {
    let type = 'string';

    switch (field.type) {
      case 'email':
        properties[field.key] = { type: 'string', format: 'email' };
        break;
      case 'tel':
        // Allow any phone number format (more flexible)
        properties[field.key] = { type: 'string', minLength: 1 };
        break;
      case 'number':
        properties[field.key] = { type: 'number' };
        break;
      default:
        properties[field.key] = { type: 'string' };
    }

    if (field.required) {
      required.push(field.key);
    }
  });

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: true
  };
}

export default router;
