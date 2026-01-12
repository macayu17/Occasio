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

// ============== DESIGN CONSTANTS ==============
const TICKET_WIDTH = 595;  // A4 width in points
const TICKET_HEIGHT = 842; // A4 height in points
const MARGIN = 40;
const CONTENT_WIDTH = TICKET_WIDTH - (MARGIN * 2);

// Premium color palette
const COLORS = {
  darkBg: [15, 15, 20],
  cardBg: [25, 25, 35],
  gold: [212, 175, 55],
  goldLight: [255, 215, 100],
  white: [255, 255, 255],
  gray: [140, 140, 160],
  lightGray: [200, 200, 210],
  accent: [99, 102, 241], // Indigo
};

// ============== HELPER FUNCTIONS ==============
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
};

// Fetch image from URL
const fetchImage = async (url) => {
  if (!url) return null;
  try {
    const protocol = url.startsWith('https') ? https : http;
    return await new Promise((resolve, reject) => {
      protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirects
          fetchImage(response.headers.location).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
  } catch (err) {
    console.error('Failed to fetch image:', err);
    return null;
  }
};

// Draw rounded rectangle
const drawRoundedRect = (doc, x, y, width, height, radius, fill, stroke = null) => {
  doc.save();
  doc.moveTo(x + radius, y);
  doc.lineTo(x + width - radius, y);
  doc.quadraticCurveTo(x + width, y, x + width, y + radius);
  doc.lineTo(x + width, y + height - radius);
  doc.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  doc.lineTo(x + radius, y + height);
  doc.quadraticCurveTo(x, y + height, x, y + height - radius);
  doc.lineTo(x, y + radius);
  doc.quadraticCurveTo(x, y, x + radius, y);
  doc.closePath();

  if (fill) {
    doc.fill(fill);
  }
  if (stroke) {
    doc.lineWidth(stroke.width || 1).stroke(stroke.color);
  }
  doc.restore();
};

// Draw decorative pattern (subtle dots)
const drawPattern = (doc, x, y, width, height, color) => {
  doc.save();
  doc.opacity(0.03);
  for (let px = x; px < x + width; px += 20) {
    for (let py = y; py < y + height; py += 20) {
      doc.circle(px, py, 1).fill(color);
    }
  }
  doc.opacity(1);
  doc.restore();
};

// Draw perforated line
const drawPerforatedLine = (doc, x1, y, x2, color) => {
  doc.save();
  doc.lineWidth(1);
  doc.dash(5, { space: 5 });
  doc.moveTo(x1, y).lineTo(x2, y).stroke(color);
  doc.undash();
  doc.restore();
};

// Draw semi-circle cutouts (ticket stub effect)
const drawCutouts = (doc, y, bgColor) => {
  const cutoutRadius = 15;
  doc.save();
  // Left cutout
  doc.circle(MARGIN - 5, y, cutoutRadius).fill(bgColor);
  // Right cutout
  doc.circle(TICKET_WIDTH - MARGIN + 5, y, cutoutRadius).fill(bgColor);
  doc.restore();
};

// ============== TICKET RECORD ==============
export async function createTicketRecord(order) {
  try {
    let ticket = await prisma.ticket.findUnique({
      where: { orderId: order.id }
    });

    if (!ticket) {
      ticket = await prisma.ticket.create({
        data: {
          orderId: order.id,
          qrPayload: '{}',
          validUntil: order.registration.event.endTime
        }
      });

      const qrPayload = generateQRPayload({
        ticketId: ticket.id,
        orderId: order.id,
        eventId: order.registration.event.id,
        registrationId: order.registrationId
      });

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

// ============== PREMIUM TICKET DESIGN ==============
async function drawPremiumTicket(doc, ticket, order, qrCodeBuffer) {
  const event = order.registration.event;
  const attendee = order.registration.formResponse;
  const ticketStyle = event.ticketStyle || {};

  // Get custom colors or use premium defaults
  const primaryColor = ticketStyle.primaryColor ? hexToRgb(ticketStyle.primaryColor) : COLORS.gold;
  const accentColor = ticketStyle.accentColor ? hexToRgb(ticketStyle.accentColor) : COLORS.white;
  const bgColor = ticketStyle.backgroundColor ? hexToRgb(ticketStyle.backgroundColor) : COLORS.darkBg;

  // Get customization options with defaults
  const fontFamily = ticketStyle.fontFamily || 'Helvetica';
  const fontBold = fontFamily === 'Times-Roman' ? 'Times-Bold' :
    fontFamily === 'Courier' ? 'Courier-Bold' : 'Helvetica-Bold';
  const borderRadius = parseInt(ticketStyle.borderRadius) || 20;
  const showBorder = ticketStyle.showBorder !== false; // default true
  const showQR = ticketStyle.showQR !== false; // default true
  const showLogo = ticketStyle.showLogo !== false; // default true

  // Fetch event poster
  const posterImage = await fetchImage(event.posterUrl || ticketStyle.headerImage);

  // ===== BACKGROUND =====
  doc.rect(0, 0, TICKET_WIDTH, TICKET_HEIGHT).fill(bgColor);

  // Subtle pattern overlay
  drawPattern(doc, 0, 0, TICKET_WIDTH, TICKET_HEIGHT, COLORS.white);

  // ===== MAIN TICKET CARD =====
  const cardX = MARGIN;
  const cardY = MARGIN;
  const cardWidth = CONTENT_WIDTH;
  const cardHeight = 520;

  // Card background with gradient simulation (layered rectangles)
  drawRoundedRect(doc, cardX, cardY, cardWidth, cardHeight, borderRadius, COLORS.cardBg);

  // Accent border (conditional)
  if (showBorder) {
    doc.save();
    doc.lineWidth(2);
    drawRoundedRect(doc, cardX + 2, cardY + 2, cardWidth - 4, cardHeight - 4, borderRadius - 2, null, { color: primaryColor, width: 2 });
    doc.restore();
  }

  // ===== HEADER SECTION WITH POSTER =====
  const headerHeight = 180;

  // Clip rounded corners for header image
  doc.save();
  doc.moveTo(cardX + 20, cardY + 10);
  doc.lineTo(cardX + cardWidth - 20, cardY + 10);
  doc.quadraticCurveTo(cardX + cardWidth - 10, cardY + 10, cardX + cardWidth - 10, cardY + 25);
  doc.lineTo(cardX + cardWidth - 10, cardY + headerHeight);
  doc.lineTo(cardX + 10, cardY + headerHeight);
  doc.lineTo(cardX + 10, cardY + 25);
  doc.quadraticCurveTo(cardX + 10, cardY + 10, cardX + 20, cardY + 10);
  doc.clip();

  if (posterImage) {
    try {
      // Draw poster as header
      doc.image(posterImage, cardX + 10, cardY + 10, {
        width: cardWidth - 20,
        height: headerHeight - 10,
        fit: [cardWidth - 20, headerHeight - 10],
        align: 'center',
        valign: 'center'
      });
      // Dark overlay for text readability
      doc.save();
      doc.opacity(0.6);
      doc.rect(cardX + 10, cardY + headerHeight - 60, cardWidth - 20, 60).fill([0, 0, 0]);
      doc.opacity(1);
      doc.restore();
    } catch (e) {
      // Fallback gradient header
      doc.rect(cardX + 10, cardY + 10, cardWidth - 20, headerHeight - 10).fill(primaryColor);
    }
  } else {
    // Default gradient-style header
    doc.rect(cardX + 10, cardY + 10, cardWidth - 20, headerHeight - 10).fill(primaryColor);
    // Add subtle pattern
    drawPattern(doc, cardX + 10, cardY + 10, cardWidth - 20, headerHeight - 10, COLORS.white);
  }
  doc.restore();

  // Event badge (conditional)
  const badgeY = cardY + headerHeight - 45;
  if (showLogo) {
    doc.font(fontBold).fontSize(9)
      .fillColor(primaryColor)
      .text('* EVENT TICKET', cardX + 25, badgeY);
  }

  // Event title on header
  doc.font(fontBold).fontSize(26)
    .fillColor(accentColor)
    .text(event.title, cardX + 25, showLogo ? badgeY + 15 : badgeY, {
      width: cardWidth - 50,
      lineGap: 2
    });

  // ===== CONTENT SECTION =====
  let yPos = cardY + headerHeight + 25;
  const leftCol = cardX + 25;
  const qrSize = 140;
  const qrContainerSize = qrSize + 20;
  // Adjust layout based on QR visibility
  const rightColX = showQR ? leftCol + qrSize + 30 : leftCol;
  const rightColWidth = showQR ? cardWidth - qrSize - 80 : cardWidth - 50;

  // ===== QR CODE SECTION (Left) - Conditional =====
  if (showQR) {
    // QR background with accent border
    drawRoundedRect(doc, leftCol, yPos, qrContainerSize, qrContainerSize, 12, [30, 30, 40]);
    drawRoundedRect(doc, leftCol + 2, yPos + 2, qrContainerSize - 4, qrContainerSize - 4, 10, null, { color: primaryColor, width: 1.5 });

    // QR Code
    try {
      doc.image(qrCodeBuffer, leftCol + 10, yPos + 10, { width: qrSize, height: qrSize });
    } catch (err) {
      doc.fillColor(COLORS.gray).text('[QR]', leftCol + 50, yPos + 60);
    }

    // "Scan to enter" label below QR
    doc.font(fontFamily).fontSize(8)
      .fillColor(COLORS.gray)
      .text('SCAN TO ENTER', leftCol, yPos + qrContainerSize + 8, {
        width: qrContainerSize,
        align: 'center'
      });
  }

  // ===== EVENT DETAILS (Right of QR) =====
  let detailY = yPos;

  // Date & Time
  doc.font(fontFamily).fontSize(9).fillColor(COLORS.gray)
    .text('DATE & TIME', rightColX, detailY);
  detailY += 14;

  const eventDate = new Date(event.startTime);
  doc.font(fontBold).fontSize(14).fillColor(accentColor)
    .text(eventDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }), rightColX, detailY);
  detailY += 18;

  doc.font(fontFamily).fontSize(12).fillColor(COLORS.lightGray)
    .text(eventDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }), rightColX, detailY);
  detailY += 30;

  // Location
  doc.font(fontFamily).fontSize(9).fillColor(COLORS.gray)
    .text('VENUE', rightColX, detailY);
  detailY += 14;

  doc.font(fontBold).fontSize(12).fillColor(accentColor)
    .text(event.location || 'TBA', rightColX, detailY, {
      width: rightColWidth,
      lineGap: 2
    });
  detailY += doc.heightOfString(event.location || 'TBA', { width: rightColWidth }) + 20;

  // Ticket Number
  doc.font(fontFamily).fontSize(9).fillColor(COLORS.gray)
    .text('TICKET #', rightColX, detailY);
  detailY += 14;

  doc.font('Courier-Bold').fontSize(16).fillColor(primaryColor)
    .text(ticket.id.substring(0, 8).toUpperCase(), rightColX, detailY);

  // ===== PERFORATED LINE / TEAR-OFF SECTION =====
  const tearY = showQR ? yPos + qrContainerSize + 50 : yPos + 120;

  // Cutouts
  drawCutouts(doc, tearY, bgColor);

  // Perforated line
  drawPerforatedLine(doc, cardX + 20, tearY, cardX + cardWidth - 20, COLORS.gray);

  // ===== ATTENDEE SECTION (Below tear line) =====
  let attendeeY = tearY + 25;

  // Section header
  doc.font(fontBold).fontSize(10).fillColor(primaryColor)
    .text('ATTENDEE INFORMATION', leftCol, attendeeY);
  attendeeY += 25;

  // Two-column layout for attendee info
  const col1X = leftCol;
  const col2X = leftCol + (cardWidth - 50) / 2;
  const colWidth = (cardWidth - 50) / 2 - 10;

  // Name
  doc.font(fontFamily).fontSize(9).fillColor(COLORS.gray)
    .text('NAME', col1X, attendeeY);
  doc.font(fontBold).fontSize(13).fillColor(accentColor)
    .text(attendee.name || 'Guest', col1X, attendeeY + 14, { width: colWidth });

  // Email
  doc.font(fontFamily).fontSize(9).fillColor(COLORS.gray)
    .text('EMAIL', col2X, attendeeY);
  doc.font(fontFamily).fontSize(11).fillColor(COLORS.lightGray)
    .text(attendee.email || order.registration.userEmail || '-', col2X, attendeeY + 14, {
      width: colWidth,
      ellipsis: true
    });

  attendeeY += 55;

  // ===== FOOTER =====
  const footerY = cardY + cardHeight - 50;

  // Decorative line
  doc.moveTo(cardX + 25, footerY)
    .lineTo(cardX + cardWidth - 25, footerY)
    .lineWidth(0.5)
    .stroke([50, 50, 60]);

  // Footer text
  doc.font(fontFamily).fontSize(8).fillColor(COLORS.gray);
  doc.text('This ticket is non-transferable • Valid for single entry only',
    cardX + 25, footerY + 12, { width: cardWidth - 50, align: 'center' });

  // Issued date
  const issuedText = `Issued: ${new Date(ticket.issuedAt).toLocaleDateString()}`;
  doc.text(issuedText, cardX + 25, footerY + 25, { width: cardWidth - 50, align: 'center' });

  // ===== BOTTOM BRANDING =====
  if (showLogo) {
    const brandY = TICKET_HEIGHT - 50;
    doc.font(fontBold).fontSize(18).fillColor(primaryColor)
      .text('occasio', 0, brandY, { width: TICKET_WIDTH, align: 'center' });
    doc.font(fontFamily).fontSize(8).fillColor(COLORS.gray)
      .text('Premium Event Experience', 0, brandY + 20, { width: TICKET_WIDTH, align: 'center' });
  }
}

// ============== MAIN EXPORT FUNCTIONS ==============
export async function generateTicketPDF(order) {
  try {
    let ticket = await prisma.ticket.findUnique({
      where: { orderId: order.id }
    });

    if (!ticket) {
      ticket = await prisma.ticket.create({
        data: {
          orderId: order.id,
          qrPayload: '{}',
          validUntil: order.registration.event.endTime
        }
      });

      const qrPayload = generateQRPayload({
        ticketId: ticket.id,
        orderId: order.id,
        eventId: order.registration.event.id,
        registrationId: order.registrationId
      });

      ticket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { qrPayload: JSON.stringify(qrPayload) }
      });
    }

    // Generate QR code
    const qrCodeBuffer = await QRCode.toBuffer(ticket.qrPayload, {
      width: 300,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    const pdfBuffer = await new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Draw the premium ticket
      drawPremiumTicket(doc, ticket, order, qrCodeBuffer)
        .then(() => doc.end())
        .catch(reject);
    });

    // Upload to Cloudinary
    let ticketPdfUrl = null;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        console.log('Uploading ticket PDF to Cloudinary...');
        ticketPdfUrl = await uploadPdfToCloudinary(pdfBuffer, 'tickets');
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
      }
    }

    // Fallback to local save
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

export async function generateTicketPDFBuffer(order) {
  try {
    let ticket = await prisma.ticket.findUnique({
      where: { orderId: order.id }
    });

    if (!ticket) {
      ticket = await prisma.ticket.create({
        data: {
          orderId: order.id,
          qrPayload: '{}',
          validUntil: order.registration.event.endTime
        }
      });

      const qrPayload = generateQRPayload({
        ticketId: ticket.id,
        orderId: order.id,
        eventId: order.registration.event.id,
        registrationId: order.registrationId
      });

      ticket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { qrPayload: JSON.stringify(qrPayload) }
      });
    }

    // Generate QR code
    const qrCodeBuffer = await QRCode.toBuffer(ticket.qrPayload, {
      width: 300,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));

    const pdfBuffer = await new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Draw the premium ticket
      drawPremiumTicket(doc, ticket, order, qrCodeBuffer)
        .then(() => doc.end())
        .catch(reject);
    });

    return pdfBuffer;
  } catch (error) {
    console.error('Generate PDF buffer error:', error);
    throw error;
  }
}
