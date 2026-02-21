import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Get the QR payload for 2FBF033A
const ticket = await p.ticket.findFirst({
  where: { id: { startsWith: '2fbf033a' } },
  select: { id: true, qrPayload: true }
});

console.log('Ticket ID:', ticket.id);
console.log('QR Payload (raw string):', ticket.qrPayload);
console.log('QR Payload (parsed):', JSON.parse(ticket.qrPayload));

// Now simulate what the scanner sends by calling the verify endpoint
const loginRes = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'anayush1406@gmail.com', password: 'test1234' })
});
const loginData = await loginRes.json();
console.log('\nLogin status:', loginRes.status);

if (loginData.token) {
  // Simulate scan: send the raw QR payload string just like the scanner would
  const qrPayloadStr = ticket.qrPayload;
  console.log('\nSending to verify:', JSON.stringify({ qrPayload: qrPayloadStr }));
  
  const verifyRes = await fetch('http://localhost:5000/api/tickets/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`
    },
    body: JSON.stringify({ qrPayload: qrPayloadStr })
  });
  
  const verifyData = await verifyRes.json();
  console.log('Verify status:', verifyRes.status);
  console.log('Verify response:', JSON.stringify(verifyData, null, 2));
} else {
  console.log('Login failed:', loginData);
}

await p.$disconnect();
