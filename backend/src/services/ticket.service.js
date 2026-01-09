import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../config/db.js';
import { generateQRPayload } from '../utils/qr.util.js';
import { uploadPdfToCloudinary } from '../utils/cloudinary.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create just the ticket record (no PDF generation)
 * Used for background jobs to quickly create the ticket
 * PDF is generated on-demand when downloading or emailing
 */
export async function createTicketRecord(order) {
  try {
    let ticket = await prisma.ticket.findUnique({
      where: { orderId: order.id }
    });

    if (!ticket) {
      // Create the ticket
      ticket = await prisma.ticket.create({
        data: {
          orderId: order.id,
          qrPayload: '{}',
          validUntil: order.registration.event.endTime
        }
      });

      // Generate QR payload with the actual ticket ID
      const qrPayload = generateQRPayload({
        ticketId: ticket.id,
        orderId: order.id,
        eventId: order.registration.event.id,
        registrationId: order.registrationId
      });

      // Update ticket with correct QR payload
      ticket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { qrPayload: JSON.stringify(qrPayload) }
      });
    }

    return ticket;
  } catch (error) {
    console.error('Create ticket record error:', error);
    throw error;
  }
}

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
        ticketPdfUrl = await uploadPdfToCloudinary(pdfBuffer, 'tickets');
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

/**
 * Generate a PDF buffer for direct download (skips Cloudinary)
 * This is used for the download endpoint to bypass Cloudinary restrictions
 */
export async function generateTicketPDFBuffer(order) {
  try {
    // Find or create ticket record
    let ticket = await prisma.ticket.findUnique({
      where: { orderId: order.id }
    });

    if (!ticket) {
      // Create the ticket first
      ticket = await prisma.ticket.create({
        data: {
          orderId: order.id,
          qrPayload: '{}',
          validUntil: order.registration.event.endTime
        }
      });

      // Generate QR payload with the actual ticket ID
      const qrPayload = generateQRPayload({
        ticketId: ticket.id,
        orderId: order.id,
        eventId: order.registration.event.id,
        registrationId: order.registrationId
      });

      // Update ticket with correct QR payload
      ticket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { qrPayload: JSON.stringify(qrPayload) }
      });
    }

    // Generate QR code as Buffer
    const qrCodeBuffer = await QRCode.toBuffer(ticket.qrPayload, {
      width: 300,
      margin: 2
    });

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    // Generate PDF buffer
    const pdfBuffer = await new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const event = order.registration.event;
      const attendee = order.registration.formResponse;

      // Default styles if not set
      const styles = event.ticketStyle || {
        template: 'modern',
        primaryColor: '#E23744',
        accentColor: '#ffffff'
      };

      const primaryColor = styles.primaryColor || '#E23744';
      const accentColor = styles.accentColor || '#ffffff';

      // --- Draw Ticket Design based on Template ---

      if (styles.template === 'minimal') {
        // === MINIMAL TEMPLATE ===

        // Clean white look with simple border
        doc.rect(20, 20, 555, 750)
          .lineWidth(2)
          .stroke(primaryColor);

        // Top Logo Area
        doc.fontSize(24).font('Helvetica-Bold').fillColor(primaryColor)
          .text('EVENT TICKET', 0, 50, { align: 'center' });

        doc.fontSize(10).font('Helvetica').fillColor('#666666')
          .text('Admit One', 0, 80, { align: 'center' });

        // Event Title - Large and Central
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#000000')
          .text(event.title, 50, 130, { align: 'center', width: 500 });

        // Info Grid
        let yPos = 200;

        // Date
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#999999').text('DATE & TIME', 50, yPos);
        doc.fontSize(12).font('Helvetica').fillColor('#000000').text(new Date(event.startTime).toLocaleString(), 50, yPos + 15);

        // Location
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#999999').text('LOCATION', 300, yPos);
        doc.fontSize(12).font('Helvetica').fillColor('#000000').text(event.location, 300, yPos + 15, { width: 250 });

        yPos += 80;

        // Attendee
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#999999').text('ATTENDEE', 50, yPos);
        doc.fontSize(12).font('Helvetica').fillColor('#000000').text(attendee.name || 'N/A', 50, yPos + 15);

        // Ticket ID
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#999999').text('TICKET ID', 300, yPos);
        doc.fontSize(12).font('Courier').fillColor('#000000').text(ticket.id.substring(0, 8).toUpperCase(), 300, yPos + 15);

        // QR Code
        const qrWidth = 180;
        const pageCenter = (595.28 - qrWidth) / 2;
        try {
          doc.image(qrCodeBuffer, pageCenter, 450, { width: qrWidth });
        } catch (err) {
          doc.text('[QR Code Missing]', pageCenter, 450);
        }

        // Validity text
        doc.fontSize(10).font('Helvetica').fillColor('#666666')
          .text('Scan this code at the entrance.', 0, 640, { align: 'center' });

      } else if (styles.template === 'classic') {
        // === CLASSIC TEMPLATE ===

        // "Paper ticket" look with dashed line stub

        // Main Ticket Border
        doc.rect(40, 40, 515, 250)
          .strokeColor('#333333').lineWidth(1).stroke();

        // Stub Line (Dashed)
        doc.moveTo(400, 40).lineTo(400, 290)
          .dash(5, { space: 3 })
          .stroke();
        doc.undash(); // Reset dash

        // == Left Side (Main) ==
        // Header Bar
        doc.rect(41, 41, 358, 40).fill(primaryColor);
        doc.fontSize(16).font('Helvetica-Bold').fillColor(accentColor)
          .text('EVENT PASS', 55, 53);

        // Content
        doc.fillColor('#000000');

        // Event Title
        doc.fontSize(14).font('Helvetica-Bold').text(event.title, 55, 100, { width: 330 });

        // Details
        let leftY = 140;
        doc.fontSize(9).font('Helvetica-Bold').text('WHEN', 55, leftY);
        doc.font('Helvetica').text(new Date(event.startTime).toLocaleString(), 55, leftY + 12);

        leftY += 35;
        doc.font('Helvetica-Bold').text('WHERE', 55, leftY);
        doc.font('Helvetica').text(event.location, 55, leftY + 12, { width: 330 });

        leftY += 45;
        doc.font('Helvetica-Bold').text('ISSUED TO', 55, leftY);
        doc.font('Helvetica').text(attendee.name, 55, leftY + 12);

        // == Right Side (Stub) ==
        // QR Code Small
        try {
          doc.image(qrCodeBuffer, 415, 60, { width: 120 });
        } catch (err) { }

        doc.fontSize(8).font('Courier').fillColor('#333333')
          .text(ticket.id.substring(0, 8).toUpperCase(), 415, 190, { width: 120, align: 'center' });

        doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor)
          .text('ADMIT ONE', 400, 230, { width: 155, align: 'center' });

      } else {
        // === MODERN TEMPLATE (Default) ===

        // Header Background
        doc.rect(0, 0, 600, 150).fill(primaryColor);

        // Header Text
        doc.fontSize(28).fillColor(accentColor)
          .text('Event Ticket', 50, 50, { align: 'center', width: 500 });
        doc.fontSize(14)
          .text('Your pass to an amazing experience', 50, 90, { align: 'center', width: 500 });

        // Reset color based on brightness of background? safely assume dark text for body
        doc.fillColor('#333333');

        // Event Details Section
        let yPos = 180;
        const xLabel = 50;
        const xValue = 200;
        doc.fontSize(12);

        doc.font('Helvetica-Bold').text('Event:', xLabel, yPos);
        doc.font('Helvetica').text(event.title, xValue, yPos);
        yPos += 30;

        doc.font('Helvetica-Bold').text('Location:', xLabel, yPos);
        doc.font('Helvetica').text(event.location, xValue, yPos, { width: 350 });
        const locationHeight = doc.heightOfString(event.location, { width: 350 });
        yPos += locationHeight + 15;

        doc.font('Helvetica-Bold').text('Date & Time:', xLabel, yPos);
        doc.font('Helvetica').text(new Date(event.startTime).toLocaleString(), xValue, yPos);
        yPos += 30;

        doc.font('Helvetica-Bold').text('Attendee:', xLabel, yPos);
        doc.font('Helvetica').text(attendee.name || 'N/A', xValue, yPos);
        yPos += 30;

        doc.font('Helvetica-Bold').text('Email:', xLabel, yPos);
        doc.font('Helvetica').text(attendee.email || order.registration.userEmail, xValue, yPos);
        yPos += 30;

        doc.font('Helvetica-Bold').text('Ticket ID:', xLabel, yPos);
        doc.font('Courier').text(ticket.id.substring(0, 8).toUpperCase(), xValue, yPos);
        yPos += 50;

        // QR Code Section
        doc.font('Helvetica-Bold').fontSize(16).text('Scan at Venue', 50, yPos, { align: 'center', width: 500 });
        yPos += 30;

        const qrWidth = 150;
        const pageCenter = (595.28 - qrWidth) / 2;
        try {
          doc.image(qrCodeBuffer, pageCenter, yPos, { width: qrWidth });
        } catch (err) {
          doc.text('[QR Code Missing]', pageCenter, yPos);
        }
        yPos += qrWidth + 20;

        doc.font('Helvetica').fontSize(10).text('Please present this QR code at the venue entrance', 50, yPos, { align: 'center', width: 500 });
      }

      // Shared Footer
      const bottomY = 750;
      doc.fillColor('#999999');
      doc.fontSize(8).text(`Ticket issued on ${new Date(ticket.issuedAt).toLocaleString()}`, 50, bottomY, { align: 'center', width: 500 });
      doc.text('This ticket is non-transferable and valid for one entry only', 50, bottomY + 12, { align: 'center', width: 500 });

      doc.end();
    });

    return pdfBuffer;
  } catch (error) {
    console.error('Generate PDF buffer error:', error);
    throw error;
  }
}
