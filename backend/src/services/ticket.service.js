import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../config/db.js';
import { generateQRPayload } from '../utils/qr.util.js';
import { uploadToCloudinary } from '../utils/cloudinary.util.js';

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

    // Generate QR code as Buffer (for PDFKit)
    const qrCodeBuffer = await QRCode.toBuffer(ticket.qrPayload, {
      width: 300,
      margin: 2
    });

    // Create a new PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    // Wait for the PDF to be fully generated
    const pdfBuffer = await new Promise((resolve, reject) => {
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', reject);

      // --- Draw Ticket Design ---

      const event = order.registration.event;
      const attendee = order.registration.formResponse;

      // Header Background (Simulated with a colored rectangle)
      doc.rect(0, 0, 600, 150)
        .fill('#667eea'); // Purple-ish blue

      // Header Text
      doc.fontSize(28)
        .fillColor('white')
        .text('Event Ticket', 50, 50, { align: 'center', width: 500 });

      doc.fontSize(14)
        .text('Your pass to an amazing experience', 50, 90, { align: 'center', width: 500 });

      // Reset color
      doc.fillColor('#333333');

      // Event Details Section
      let yPos = 180;
      const xLabel = 50;
      const xValue = 200;

      doc.fontSize(12);

      // Title
      doc.font('Helvetica-Bold').text('Event:', xLabel, yPos);
      doc.font('Helvetica').text(event.title, xValue, yPos);
      yPos += 30;

      // Location
      doc.font('Helvetica-Bold').text('Location:', xLabel, yPos);
      doc.font('Helvetica').text(event.location, xValue, yPos, { width: 350 });

      // Adjust yPos based on height of location text
      const locationHeight = doc.heightOfString(event.location, { width: 350 });
      yPos += locationHeight + 15;

      // Date
      doc.font('Helvetica-Bold').text('Date & Time:', xLabel, yPos);
      doc.font('Helvetica').text(new Date(event.startTime).toLocaleString(), xValue, yPos);
      yPos += 30;

      // Attendee
      doc.font('Helvetica-Bold').text('Attendee:', xLabel, yPos);
      doc.font('Helvetica').text(attendee.name || 'N/A', xValue, yPos);
      yPos += 30;

      // Email
      doc.font('Helvetica-Bold').text('Email:', xLabel, yPos);
      doc.font('Helvetica').text(attendee.email || order.registration.userEmail, xValue, yPos);
      yPos += 30;

      // Ticket ID
      doc.font('Helvetica-Bold').text('Ticket ID:', xLabel, yPos);
      doc.font('Courier').text(ticket.id.substring(0, 8).toUpperCase(), xValue, yPos);
      yPos += 50;

      // QR Code Section
      doc.font('Helvetica-Bold').fontSize(16).text('Scan at Venue', 50, yPos, { align: 'center', width: 500 });
      yPos += 30;

      // Center QR Image
      const qrWidth = 150;
      const pageCenter = (595.28 - qrWidth) / 2; // A4 width is ~595 pts

      try {
        doc.image(qrCodeBuffer, pageCenter, yPos, { width: qrWidth });
      } catch (err) {
        console.error('Error adding QR image to PDF:', err);
        doc.text('[QR Code Missing]', pageCenter, yPos);
      }
      yPos += qrWidth + 20;

      doc.font('Helvetica').fontSize(10).text('Please present this QR code at the venue entrance', 50, yPos, { align: 'center', width: 500 });

      // Footer
      const bottomY = 750;
      doc.fontSize(10).text(`Ticket issued on ${new Date(ticket.issuedAt).toLocaleString()}`, 50, bottomY, { align: 'center', width: 500 });
      doc.text('This ticket is non-transferable and valid for one entry only', 50, bottomY + 15, { align: 'center', width: 500 });

      // Finalize PDF file
      doc.end();
    });

    // Upload directly to Cloudinary using buffer
    let ticketPdfUrl = null;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        console.log('Uploading ticket PDF to Cloudinary...');
        ticketPdfUrl = await uploadToCloudinary(pdfBuffer, 'tickets');
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        // Fallback to local save
      }
    }

    // If upload failed or not configured, save locally (works primarily in dev)
    if (!ticketPdfUrl) {
      const uploadDir = path.join(__dirname, '../../uploads/tickets');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filename = `ticket-${ticket.id}.pdf`;
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, pdfBuffer);
      ticketPdfUrl = `/uploads/tickets/${filename}`;
    }

    // Update ticket with PDF URL
    ticket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { ticketPdfUrl }
    });

    return ticket;
  } catch (error) {
    console.error('Generate ticket error:', error);
    throw error;
  }
}
