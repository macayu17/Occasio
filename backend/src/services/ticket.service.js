import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
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

    // Get custom styles or use defaults
    const event = order.registration.event;
    const attendee = order.registration.formResponse;
    const ticketStyle = event.ticketStyle || {};
    const primaryColor = ticketStyle.primaryColor || '#E23744';
    const accentColor = ticketStyle.accentColor || '#ffffff';
    const backgroundColor = ticketStyle.backgroundColor || '#18181b';
    const headerImage = ticketStyle.headerImage || '';
    // Validate font - only allow PDF built-in fonts, fallback to Helvetica
    const VALID_FONTS = ['Helvetica', 'Times-Roman', 'Courier'];
    const rawFont = ticketStyle.fontFamily || 'Helvetica';
    const fontFamily = VALID_FONTS.includes(rawFont) ? rawFont : 'Helvetica';
    const fontBold = fontFamily === 'Times-Roman' ? 'Times-Bold' :
      fontFamily === 'Courier' ? 'Courier-Bold' : 'Helvetica-Bold';
    const showQR = ticketStyle.showQR !== false;
    const showLogo = ticketStyle.showLogo !== false;
    const showBorder = ticketStyle.showBorder !== false;

    // Helper to convert hex to RGB for PDFKit
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [0, 0, 0];
    };

    const [bgR, bgG, bgB] = hexToRgb(backgroundColor);
    const [primaryR, primaryG, primaryB] = hexToRgb(primaryColor);
    const [accentR, accentG, accentB] = hexToRgb(accentColor);

    // Fetch header image if provided (before PDF generation)
    let headerImageBuffer = null;
    if (headerImage) {
      try {
        const protocol = headerImage.startsWith('https') ? https : http;
        headerImageBuffer = await new Promise((resolve, reject) => {
          protocol.get(headerImage, (response) => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
          }).on('error', reject);
        });
      } catch (imgErr) {
        console.error('Failed to load header image:', imgErr);
      }
    }

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

      // Background
      doc.rect(0, 0, 595, 842).fill([bgR, bgG, bgB]);

      // Border (if enabled)
      if (showBorder) {
        doc.rect(30, 30, 535, 782)
          .lineWidth(2)
          .stroke([primaryR, primaryG, primaryB]);
      }

      // Header - use image if available, otherwise solid color
      if (headerImageBuffer) {
        try {
          doc.image(headerImageBuffer, 40, 40, { width: 515, height: 100 });
        } catch (e) {
          doc.rect(40, 40, 515, 100).fill([primaryR, primaryG, primaryB]);
        }
      } else {
        doc.rect(40, 40, 515, 100).fill([primaryR, primaryG, primaryB]);
      }

      // Event Title
      doc.fontSize(28)
        .fillColor([accentR, accentG, accentB])
        .font(fontBold)
        .text(event.title, 60, 60, { width: 400 });

      doc.fontSize(12)
        .font(fontFamily)
        .text('Event Ticket', 60, 110, { width: 400 });

      // Logo placeholder (if enabled)
      if (showLogo) {
        doc.rect(470, 55, 70, 70)
          .fill([accentR, accentG, accentB]);
        doc.fontSize(32)
          .fillColor([primaryR, primaryG, primaryB])
          .font(fontBold)
          .text('O', 490, 75);
      }

      // Event Details Section
      let yPos = 170;
      const xLabel = 60;
      const xValue = 200;

      doc.fillColor([accentR, accentG, accentB]);
      doc.fontSize(11);

      // Date & Time
      doc.font('Helvetica-Bold').text('Date & Time', xLabel, yPos);
      doc.font('Helvetica').text(new Date(event.startTime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }), xValue, yPos);
      yPos += 35;

      // Location
      doc.font('Helvetica-Bold').text('Venue', xLabel, yPos);
      doc.font('Helvetica').text(event.location, xValue, yPos, { width: 350 });
      const locationHeight = doc.heightOfString(event.location, { width: 350 });
      yPos += Math.max(35, locationHeight + 15);

      // Divider
      doc.moveTo(60, yPos).lineTo(535, yPos).lineWidth(0.5).stroke([primaryR, primaryG, primaryB]);
      yPos += 25;

      // Attendee Info
      doc.font('Helvetica-Bold').text('Attendee', xLabel, yPos);
      doc.font('Helvetica').text(attendee.name || 'N/A', xValue, yPos);
      yPos += 30;

      doc.font('Helvetica-Bold').text('Email', xLabel, yPos);
      doc.font('Helvetica').text(attendee.email || order.registration.userEmail, xValue, yPos);
      yPos += 30;

      doc.font('Helvetica-Bold').text('Ticket #', xLabel, yPos);
      doc.font('Courier-Bold').fillColor([primaryR, primaryG, primaryB])
        .text(ticket.id.substring(0, 8).toUpperCase(), xValue, yPos);
      yPos += 50;

      // Divider
      doc.fillColor([accentR, accentG, accentB]);
      doc.moveTo(60, yPos).lineTo(535, yPos).lineWidth(0.5).stroke([primaryR, primaryG, primaryB]);
      yPos += 30;

      // QR Code Section (if enabled)
      if (showQR) {
        doc.font('Helvetica-Bold').fontSize(14)
          .fillColor([primaryR, primaryG, primaryB])
          .text('SCAN AT VENUE', 50, yPos, { align: 'center', width: 495 });
        yPos += 30;

        // QR Code background
        const qrWidth = 180;
        const pageCenter = (595 - qrWidth - 20) / 2;
        doc.rect(pageCenter, yPos, qrWidth + 20, qrWidth + 20)
          .fill([primaryR, primaryG, primaryB]);

        try {
          doc.image(qrCodeBuffer, pageCenter + 10, yPos + 10, { width: qrWidth });
        } catch (err) {
          console.error('Error adding QR image to PDF:', err);
          doc.fillColor([accentR, accentG, accentB]).text('[QR Code Missing]', pageCenter, yPos + 70);
        }
        yPos += qrWidth + 40;

        doc.font('Helvetica').fontSize(10)
          .fillColor([accentR, accentG, accentB])
          .text('Present this QR code at the venue entrance', 50, yPos, { align: 'center', width: 495 });
      }

      // Footer
      const bottomY = 780;
      doc.fontSize(8)
        .fillColor([accentR, accentG, accentB])
        .text(`Issued: ${new Date(ticket.issuedAt).toLocaleString()}  •  Valid until: ${new Date(event.endTime).toLocaleString()}`, 50, bottomY, { align: 'center', width: 495 });
      doc.text('This ticket is non-transferable and valid for one entry only', 50, bottomY + 12, { align: 'center', width: 495 });

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

    // Get custom styles
    const event = order.registration.event;
    const attendee = order.registration.formResponse;
    const styles = event.ticketStyle || {};
    const primaryColor = styles.primaryColor || '#E23744';
    const accentColor = styles.accentColor || '#ffffff';
    const backgroundColor = styles.backgroundColor || '#18181b';
    const headerImage = styles.headerImage || '';
    // Validate font - only allow PDF built-in fonts, fallback to Helvetica
    const VALID_FONTS = ['Helvetica', 'Times-Roman', 'Courier'];
    const rawFont = styles.fontFamily || 'Helvetica';
    const fontFamily = VALID_FONTS.includes(rawFont) ? rawFont : 'Helvetica';
    const fontBold = fontFamily === 'Times-Roman' ? 'Times-Bold' :
      fontFamily === 'Courier' ? 'Courier-Bold' : 'Helvetica-Bold';
    const showQR = styles.showQR !== false;
    const showLogo = styles.showLogo !== false;
    const showBorder = styles.showBorder !== false;

    // Helper to convert hex to RGB for PDFKit
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ] : [0, 0, 0];
    };

    const [bgR, bgG, bgB] = hexToRgb(backgroundColor);
    const [primaryR, primaryG, primaryB] = hexToRgb(primaryColor);
    const [accentR, accentG, accentB] = hexToRgb(accentColor);

    // Fetch header image if provided (before PDF generation)
    let headerImageBuffer = null;
    if (headerImage) {
      try {
        const protocol = headerImage.startsWith('https') ? https : http;
        headerImageBuffer = await new Promise((resolve, reject) => {
          protocol.get(headerImage, (response) => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
          }).on('error', reject);
        });
      } catch (imgErr) {
        console.error('Failed to load header image:', imgErr);
      }
    }

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    // Generate PDF buffer
    const pdfBuffer = await new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Background
      doc.rect(0, 0, 595, 842).fill([bgR, bgG, bgB]);

      // Border (if enabled)
      if (showBorder) {
        doc.rect(30, 30, 535, 782)
          .lineWidth(2)
          .stroke([primaryR, primaryG, primaryB]);
      }

      // Header - use image if available, otherwise solid color
      if (headerImageBuffer) {
        try {
          doc.image(headerImageBuffer, 40, 40, { width: 515, height: 100 });
        } catch (e) {
          doc.rect(40, 40, 515, 100).fill([primaryR, primaryG, primaryB]);
        }
      } else {
        doc.rect(40, 40, 515, 100).fill([primaryR, primaryG, primaryB]);
      }

      // Event Title
      doc.fontSize(28)
        .fillColor([accentR, accentG, accentB])
        .font(fontBold)
        .text(event.title, 60, 60, { width: 400 });

      doc.fontSize(12)
        .font(fontFamily)
        .text('Event Ticket', 60, 110, { width: 400 });

      // Logo placeholder (if enabled)
      if (showLogo) {
        doc.rect(470, 55, 70, 70)
          .fill([accentR, accentG, accentB]);
        doc.fontSize(32)
          .fillColor([primaryR, primaryG, primaryB])
          .font(fontBold)
          .text('O', 490, 75);
      }

      // Event Details Section
      let yPos = 170;
      const xLabel = 60;
      const xValue = 200;

      doc.fillColor([accentR, accentG, accentB]);
      doc.fontSize(11);

      // Date & Time
      doc.font('Helvetica-Bold').text('Date & Time', xLabel, yPos);
      doc.font('Helvetica').text(new Date(event.startTime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }), xValue, yPos);
      yPos += 35;

      // Location
      doc.font('Helvetica-Bold').text('Venue', xLabel, yPos);
      doc.font('Helvetica').text(event.location, xValue, yPos, { width: 350 });
      const locationHeight = doc.heightOfString(event.location, { width: 350 });
      yPos += Math.max(35, locationHeight + 15);

      // Divider
      doc.moveTo(60, yPos).lineTo(535, yPos).lineWidth(0.5).stroke([primaryR, primaryG, primaryB]);
      yPos += 25;

      // Attendee Info
      doc.font('Helvetica-Bold').text('Attendee', xLabel, yPos);
      doc.font('Helvetica').text(attendee.name || 'N/A', xValue, yPos);
      yPos += 30;

      doc.font('Helvetica-Bold').text('Email', xLabel, yPos);
      doc.font('Helvetica').text(attendee.email || order.registration.userEmail, xValue, yPos);
      yPos += 30;

      doc.font('Helvetica-Bold').text('Ticket #', xLabel, yPos);
      doc.font('Courier-Bold').fillColor([primaryR, primaryG, primaryB])
        .text(ticket.id.substring(0, 8).toUpperCase(), xValue, yPos);
      yPos += 50;

      // Divider
      doc.fillColor([accentR, accentG, accentB]);
      doc.moveTo(60, yPos).lineTo(535, yPos).lineWidth(0.5).stroke([primaryR, primaryG, primaryB]);
      yPos += 30;

      // QR Code Section (if enabled)
      if (showQR) {
        doc.font('Helvetica-Bold').fontSize(14)
          .fillColor([primaryR, primaryG, primaryB])
          .text('SCAN AT VENUE', 50, yPos, { align: 'center', width: 495 });
        yPos += 30;

        // QR Code background
        const qrWidth = 180;
        const pageCenter = (595 - qrWidth - 20) / 2;
        doc.rect(pageCenter, yPos, qrWidth + 20, qrWidth + 20)
          .fill([primaryR, primaryG, primaryB]);

        try {
          doc.image(qrCodeBuffer, pageCenter + 10, yPos + 10, { width: qrWidth });
        } catch (err) {
          console.error('Error adding QR image to PDF:', err);
          doc.fillColor([accentR, accentG, accentB]).text('[QR Code Missing]', pageCenter, yPos + 70);
        }
        yPos += qrWidth + 40;

        doc.font('Helvetica').fontSize(10)
          .fillColor([accentR, accentG, accentB])
          .text('Present this QR code at the venue entrance', 50, yPos, { align: 'center', width: 495 });
      }

      // Footer
      const bottomY = 780;
      doc.fontSize(8)
        .fillColor([accentR, accentG, accentB])
        .text(`Issued: ${new Date(ticket.issuedAt).toLocaleString()}  •  Valid until: ${new Date(event.endTime).toLocaleString()}`, 50, bottomY, { align: 'center', width: 495 });
      doc.text('This ticket is non-transferable and valid for one entry only', 50, bottomY + 12, { align: 'center', width: 495 });

      doc.end();
    });

    return pdfBuffer;
  } catch (error) {
    console.error('Generate PDF buffer error:', error);
    throw error;
  }
}
