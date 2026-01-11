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

// ============================================
// PHONEPE PAYMENT GATEWAY
// ============================================

const PHONEPE_CONFIG = {
  sandbox: {
    baseUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    // Test phone/OTP for sandbox testing
    testPhone: '9999999999',
    testOtp: '123456'
  },
  production: {
    baseUrl: 'https://api.phonepe.com/apis/pg'
  }
};

function getPhonePeBaseUrl() {
  const env = process.env.PHONEPE_ENV || 'sandbox';
  return PHONEPE_CONFIG[env]?.baseUrl || PHONEPE_CONFIG.sandbox.baseUrl;
}

function generatePhonePeChecksum(base64Payload, endpoint) {
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
  const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';

  const stringToHash = base64Payload + endpoint + clientSecret;
  const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');

  return sha256Hash + '###' + saltIndex;
}

export async function createPhonePePayment(order, callbackUrl) {
  try {
    const clientId = process.env.PHONEPE_CLIENT_ID;
    const clientSecret = process.env.PHONEPE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('PhonePe credentials not configured');
    }

    const merchantTransactionId = order.id.replace(/-/g, '').slice(0, 35); // PhonePe limit: 35 chars

    const payload = {
      merchantId: clientId,
      merchantTransactionId,
      merchantUserId: order.registration?.userEmail?.replace(/[^a-zA-Z0-9]/g, '') || 'guest',
      amount: order.amountCents, // Amount in paise
      redirectUrl: callbackUrl,
      redirectMode: 'REDIRECT',
      callbackUrl: callbackUrl,
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const endpoint = '/pg/v1/pay';
    const checksum = generatePhonePeChecksum(base64Payload, endpoint);

    console.log('PhonePe payment request:', { clientId, merchantTransactionId, amount: order.amountCents });

    const response = await fetch(`${getPhonePeBaseUrl()}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum
      },
      body: JSON.stringify({ request: base64Payload })
    });

    const data = await response.json();
    console.log('PhonePe payment initiation failed:', data);

    if (data.success && data.data?.instrumentResponse?.redirectInfo?.url) {
      return {
        success: true,
        transactionId: merchantTransactionId,
        paymentUrl: data.data.instrumentResponse.redirectInfo.url
      };
    }

    console.error('PhonePe payment initiation failed:', data);
    throw new Error(data.message || 'Failed to initiate PhonePe payment');
  } catch (error) {
    console.error('PhonePe payment creation error:', error);
    throw error;
  }
}

export async function checkPhonePePaymentStatus(merchantTransactionId) {
  try {
    const clientId = process.env.PHONEPE_CLIENT_ID;
    const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';

    const endpoint = `/pg/v1/status/${clientId}/${merchantTransactionId}`;
    const stringToHash = endpoint + clientSecret;
    const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = sha256Hash + '###' + saltIndex;

    const response = await fetch(`${getPhonePeBaseUrl()}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': clientId
      }
    });

    const data = await response.json();
    console.log('PhonePe status check response:', data);

    return {
      success: data.success,
      code: data.code,
      transactionId: data.data?.transactionId,
      merchantTransactionId: data.data?.merchantTransactionId,
      amount: data.data?.amount,
      paymentState: data.data?.state, // COMPLETED, PENDING, FAILED
      paymentInstrument: data.data?.paymentInstrument
    };
  } catch (error) {
    console.error('PhonePe status check error:', error);
    throw error;
  }
}

export function verifyPhonePeCallback(xVerifyHeader, responseBody) {
  try {
    const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';

    const stringToHash = responseBody + '/pg/v1/status' + clientSecret;
    const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const expectedChecksum = sha256Hash + '###' + saltIndex;

    return xVerifyHeader === expectedChecksum;
  } catch (error) {
    console.error('PhonePe callback verification error:', error);
    return false;
  }
}
