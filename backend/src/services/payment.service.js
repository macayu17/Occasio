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

// Official PhonePe Sandbox Test Credentials (2024-2025)
// Using PGTESTPAYUAT86 as recommended - PGTESTPAYUAT may have rate limits
const PHONEPE_SANDBOX_CREDENTIALS = {
  merchantId: 'PGTESTPAYUAT86',
  saltKey: '96434309-7796-489d-8924-ab56988a6076',
  saltIndex: '1'
};

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

function getPhonePeCredentials() {
  const env = process.env.PHONEPE_ENV || 'sandbox';

  if (env === 'sandbox') {
    // Use official sandbox test credentials
    return {
      merchantId: PHONEPE_SANDBOX_CREDENTIALS.merchantId,
      saltKey: PHONEPE_SANDBOX_CREDENTIALS.saltKey,
      saltIndex: PHONEPE_SANDBOX_CREDENTIALS.saltIndex
    };
  }

  // Production uses user's credentials
  return {
    merchantId: process.env.PHONEPE_CLIENT_ID,
    saltKey: process.env.PHONEPE_CLIENT_SECRET,
    saltIndex: process.env.PHONEPE_SALT_INDEX || '1'
  };
}

function getPhonePeBaseUrl() {
  const env = process.env.PHONEPE_ENV || 'sandbox';
  return PHONEPE_CONFIG[env]?.baseUrl || PHONEPE_CONFIG.sandbox.baseUrl;
}

function generatePhonePeChecksum(base64Payload, endpoint, saltKey, saltIndex) {
  const stringToHash = base64Payload + endpoint + saltKey;
  const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
  return sha256Hash + '###' + saltIndex;
}

export async function createPhonePePayment(order, callbackUrl) {
  try {
    const creds = getPhonePeCredentials();
    const merchantTransactionId = order.id.replace(/-/g, '').slice(0, 35);

    const payload = {
      merchantId: creds.merchantId,
      merchantTransactionId,
      merchantUserId: 'USER' + Date.now(),
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
    const checksum = generatePhonePeChecksum(base64Payload, endpoint, creds.saltKey, creds.saltIndex);

    console.log('PhonePe payment request:', {
      merchantId: creds.merchantId,
      merchantTransactionId,
      amount: order.amountCents,
      env: process.env.PHONEPE_ENV || 'sandbox'
    });

    const response = await fetch(`${getPhonePeBaseUrl()}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum
      },
      body: JSON.stringify({ request: base64Payload })
    });

    const data = await response.json();
    console.log('PhonePe response:', data);

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
    const creds = getPhonePeCredentials();

    const endpoint = `/pg/v1/status/${creds.merchantId}/${merchantTransactionId}`;
    const stringToHash = endpoint + creds.saltKey;
    const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = sha256Hash + '###' + creds.saltIndex;

    const response = await fetch(`${getPhonePeBaseUrl()}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': creds.merchantId
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
      paymentState: data.data?.state,
      paymentInstrument: data.data?.paymentInstrument
    };
  } catch (error) {
    console.error('PhonePe status check error:', error);
    throw error;
  }
}

export function verifyPhonePeCallback(xVerifyHeader, responseBody) {
  try {
    const creds = getPhonePeCredentials();

    const stringToHash = responseBody + '/pg/v1/status' + creds.saltKey;
    const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const expectedChecksum = sha256Hash + '###' + creds.saltIndex;

    return xVerifyHeader === expectedChecksum;
  } catch (error) {
    console.error('PhonePe callback verification error:', error);
    return false;
  }
}

