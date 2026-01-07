import QRCode from 'qrcode';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../config/db.js';
import { generateQRPayload } from '../utils/qr.util.js';
import { uploadToS3 } from '../utils/s3.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateTicketPDF(order) {
  try {
    // Create or find ticket
    let ticket = await prisma.ticket.findUnique({
      where: { orderId: order.id }
    });

    if (!ticket) {
      // First create the ticket to get the actual ID
      ticket = await prisma.ticket.create({
        data: {
          orderId: order.id,
          qrPayload: '{}', // Placeholder, will update after
          validUntil: order.registration.event.endTime
        }
      });

      // Now generate QR payload with the actual ticket ID
      const qrPayload = generateQRPayload({
        ticketId: ticket.id, // Use the actual ticket ID!
        orderId: order.id,
        eventId: order.registration.event.id,
        registrationId: order.registrationId
      });

      // Update ticket with the correct QR payload
      ticket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { qrPayload: JSON.stringify(qrPayload) }
      });
    }

    // Generate QR code image
    const qrCodeDataURL = await QRCode.toDataURL(ticket.qrPayload, {
      width: 300,
      margin: 2
    });

    // Generate HTML for ticket
    const html = generateTicketHTML(order, ticket, qrCodeDataURL);

    // Generate PDF - use chromium for serverless environments
    const isProduction = process.env.NODE_ENV === 'production';

    const browser = await puppeteer.launch({
      args: isProduction ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath: isProduction ? await chromium.executablePath() : undefined,
      headless: isProduction ? chromium.headless : 'new',
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    // Save PDF
    const uploadDir = path.join(__dirname, '../../uploads/tickets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `ticket-${ticket.id}.pdf`;
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, pdfBuffer);

    // Upload to S3 in production
    let ticketPdfUrl;
    if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
      ticketPdfUrl = await uploadToS3({
        path: filepath,
        filename: filename,
        mimetype: 'application/pdf'
      });
    } else {
      ticketPdfUrl = `/uploads/tickets/${filename}`;
    }

    // Update ticket with PDF URL
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { ticketPdfUrl }
    });

    return updatedTicket;
  } catch (error) {
    console.error('Generate ticket PDF error:', error);
    throw error;
  }
}

function generateTicketHTML(order, ticket, qrCodeDataURL) {
  const event = order.registration.event;
  const attendee = order.registration.formResponse;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Arial', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px;
        }
        .ticket {
          background: white;
          border-radius: 20px;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #667eea;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #333;
          font-size: 32px;
          margin-bottom: 10px;
        }
        .header p {
          color: #666;
          font-size: 18px;
        }
        .event-info {
          margin: 30px 0;
        }
        .info-row {
          display: flex;
          padding: 15px 0;
          border-bottom: 1px solid #eee;
        }
        .info-label {
          font-weight: bold;
          color: #667eea;
          width: 200px;
        }
        .info-value {
          color: #333;
          flex: 1;
        }
        .qr-section {
          text-align: center;
          margin: 40px 0;
          padding: 30px;
          background: #f8f9fa;
          border-radius: 10px;
        }
        .qr-section img {
          max-width: 300px;
          height: auto;
        }
        .qr-section p {
          margin-top: 15px;
          color: #666;
          font-size: 14px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #eee;
          color: #999;
          font-size: 12px;
        }
        .ticket-id {
          font-family: monospace;
          background: #f0f0f0;
          padding: 5px 10px;
          border-radius: 5px;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="header">
          <h1>🎟️ Event Ticket</h1>
          <p>Your pass to an amazing experience</p>
        </div>

        <div class="event-info">
          <div class="info-row">
            <div class="info-label">Event:</div>
            <div class="info-value">${event.title}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Location:</div>
            <div class="info-value">${event.location}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Date & Time:</div>
            <div class="info-value">${new Date(event.startTime).toLocaleString()}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Attendee Name:</div>
            <div class="info-value">${attendee.name || 'N/A'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Email:</div>
            <div class="info-value">${attendee.email || order.registration.userEmail}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Ticket ID:</div>
            <div class="info-value"><span class="ticket-id">${ticket.id.substring(0, 8).toUpperCase()}</span></div>
          </div>
        </div>

        <div class="qr-section">
          <h3 style="margin-bottom: 20px; color: #333;">Scan at Venue</h3>
          <img src="${qrCodeDataURL}" alt="QR Code" />
          <p>Please present this QR code at the venue entrance</p>
        </div>

        <div class="footer">
          <p>Ticket issued on ${new Date(ticket.issuedAt).toLocaleString()}</p>
          <p style="margin-top: 10px;">This ticket is non-transferable and valid for one entry only</p>
          <p style="margin-top: 5px;">For support, contact: support@eventmanagement.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
