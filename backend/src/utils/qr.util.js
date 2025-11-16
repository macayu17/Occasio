import crypto from 'crypto';

export function generateQRPayload(data) {
  const payload = {
    ticketId: data.ticketId || crypto.randomUUID(),
    eventId: data.eventId,
    orderId: data.orderId,
    registrationId: data.registrationId,
    issuedAt: Math.floor(Date.now() / 1000)
  };

  // Generate HMAC signature
  const signature = generateQRSignature(payload);
  
  return {
    ...payload,
    sig: signature
  };
}

export function generateQRSignature(payload) {
  const data = JSON.stringify({
    ticketId: payload.ticketId,
    eventId: payload.eventId,
    orderId: payload.orderId,
    issuedAt: payload.issuedAt
  });

  return crypto
    .createHmac('sha256', process.env.QR_SECRET_KEY)
    .update(data)
    .digest('hex');
}

export function verifyQRSignature(payload) {
  if (!payload.sig) {
    return false;
  }

  const expectedSignature = generateQRSignature(payload);
  return crypto.timingSafeEqual(
    Buffer.from(payload.sig),
    Buffer.from(expectedSignature)
  );
}
