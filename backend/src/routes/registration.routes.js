import express from 'express';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import crypto from 'crypto';
import prisma from '../config/db.js';
import { createRazorpayOrder } from '../services/payment.service.js';
import { enqueueTicketGeneration } from '../services/queue.service.js';

const router = express.Router();
const ajv = new Ajv();
addFormats(ajv);

// Register for an event
router.post('/events/:id/register', async (req, res) => {
  try {
    const { id } = req.params;
    const { formResponse } = req.body;

    // Get event and form
    const event = await prisma.event.findUnique({
      where: { id },
      include: { form: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event.published) {
      return res.status(400).json({ error: 'Event is not published' });
    }

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

    // Create order
    const order = await prisma.order.create({
      data: {
        registrationId: registration.id,
        amountCents: event.priceCents,
        currency: event.currency,
        provider: 'RAZORPAY',
        status: 'CREATED'
      }
    });

    // If free event, mark as paid immediately
    if (event.priceCents === 0) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAID' }
      });

      await prisma.registration.update({
        where: { id: registration.id },
        data: { status: 'PAID' }
      });

      // Generate ticket
      await enqueueTicketGeneration(order.id);

      return res.json({
        registration,
        order,
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
    res.status(500).json({ 
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

    // Create payment gateway order
    const paymentOrder = await createRazorpayOrder(order);

    // Update order with provider order ID
    await prisma.order.update({
      where: { id },
      data: {
        providerOrderId: paymentOrder.id,
        paymentData: paymentOrder
      }
    });

    res.json({
      orderId: paymentOrder.id,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
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

    // Update order status
    await prisma.order.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentData: {
          razorpay_payment_id,
          razorpay_order_id,
          razorpay_signature
        }
      }
    });

    // Update registration status
    await prisma.registration.update({
      where: { id: order.registrationId },
      data: { status: 'PAID' }
    });

    // Enqueue ticket generation
    await enqueueTicketGeneration(order.id);

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
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
