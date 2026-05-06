import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import prisma from '../config/db.js';
import { generateQRPayload } from '../utils/qr.util.js';
import { isCloudinaryConfigured, uploadPdfToCloudinary } from '../utils/cloudinary.util.js';
import { isR2Configured, uploadBufferToR2 } from '../utils/r2.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parseQrPayloadSafe = (rawPayload) => {
  if (!rawPayload || typeof rawPayload !== 'string') return null;
  try {
    return JSON.parse(rawPayload);
  } catch {
    return null;
  }
};

const hasUsableQrPayload = (payload, ticket, order) => {
  return Boolean(
    payload &&
    payload.ticketId === ticket.id &&
    payload.orderId === order.id &&
    payload.eventId === order.registration.event.id &&
    payload.sig
  );
};

async function ensureTicketWithQr(order) {
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
  }

  const parsedPayload = parseQrPayloadSafe(ticket.qrPayload);
  if (!hasUsableQrPayload(parsedPayload, ticket, order)) {
    const newPayload = generateQRPayload({
      ticketId: ticket.id,
      orderId: order.id,
      eventId: order.registration.event.id,
      registrationId: order.registrationId
    });

    ticket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { qrPayload: JSON.stringify(newPayload) }
    });
  }

  return ticket;
}

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
    return await ensureTicketWithQr(order);
  } catch (error) {
    console.error('Create ticket record error:', error);
    throw error;
  }
}

// ============== PREMIUM TICKET DESIGN ==============
async function drawPremiumTicket(doc, ticket, order, qrCodeBuffer) {
  const event = order.registration.event;
  const attendee = order.registration.formResponse || {};
  const ticketStyle = event.ticketStyle || {};

  const allowedFonts = ['Helvetica', 'Times-Roman', 'Courier'];
  const requestedFont = ticketStyle.fontFamily || 'Helvetica';
  const fontFamily = allowedFonts.includes(requestedFont) ? requestedFont : 'Helvetica';
  const fontBold = fontFamily === 'Times-Roman' ? 'Times-Bold' :
    fontFamily === 'Courier' ? 'Courier-Bold' : 'Helvetica-Bold';

  const primaryColor = ticketStyle.primaryColor ? hexToRgb(ticketStyle.primaryColor) : [226, 55, 68];
  const accentColor = ticketStyle.accentColor ? hexToRgb(ticketStyle.accentColor) : [255, 248, 238];
  const bgColor = ticketStyle.backgroundColor ? hexToRgb(ticketStyle.backgroundColor) : [8, 8, 10];
  const muted = [148, 145, 155];
  const panel = [22, 21, 27];
  const panelSoft = [30, 28, 36];
  const showQR = ticketStyle.showQR !== false;
  const showLogo = ticketStyle.showLogo !== false;
  const posterImage = await fetchImage(event.posterUrl || ticketStyle.headerImage);

  doc.rect(0, 0, TICKET_WIDTH, TICKET_HEIGHT).fill(bgColor);
  doc.save();
  doc.opacity(0.16);
  doc.circle(70, 80, 180).fill(primaryColor);
  doc.circle(TICKET_WIDTH - 70, 300, 150).fill([255, 255, 255]);
  doc.restore();
  drawPattern(doc, 0, 0, TICKET_WIDTH, TICKET_HEIGHT, COLORS.white);

  const cardX = 58;
  const cardY = 54;
  const cardWidth = TICKET_WIDTH - 116;
  const cardHeight = 704;
  const radius = 28;

  drawRoundedRect(doc, cardX + 8, cardY + 10, cardWidth, cardHeight, radius, [0, 0, 0]);
  doc.save();
  doc.opacity(0.86);
  drawRoundedRect(doc, cardX, cardY, cardWidth, cardHeight, radius, panel);
  doc.restore();
  drawRoundedRect(doc, cardX + 1.5, cardY + 1.5, cardWidth - 3, cardHeight - 3, radius - 2, null, { color: primaryColor, width: 1.8 });

  const heroX = cardX + 22;
  const heroY = cardY + 24;
  const heroW = cardWidth - 44;
  const heroH = 210;

  doc.save();
  drawRoundedRect(doc, heroX, heroY, heroW, heroH, 20, [12, 12, 16]);
  doc.clip();
  if (posterImage) {
    try {
      doc.image(posterImage, heroX, heroY, {
        cover: [heroW, heroH],
        align: 'center',
        valign: 'center'
      });
    } catch {
      doc.rect(heroX, heroY, heroW, heroH).fill(panelSoft);
    }
  } else {
    doc.rect(heroX, heroY, heroW, heroH).fill(panelSoft);
  }
  doc.save();
  doc.opacity(0.62);
  doc.rect(heroX, heroY, heroW, heroH).fill([0, 0, 0]);
  doc.restore();
  doc.restore();

  doc.font(fontBold).fontSize(9).fillColor(primaryColor)
    .text('EVENT PASS', heroX + 22, heroY + 24, { characterSpacing: 1.6 });
  doc.font(fontBold).fontSize(33).fillColor(accentColor)
    .text(event.title || 'Event Ticket', heroX + 22, heroY + 142, {
      width: heroW - 44,
      lineGap: -2,
      ellipsis: true
    });

  const eventDate = new Date(event.startTime);
  const dateText = eventDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeText = eventDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const metaY = heroY + heroH + 22;
  const metaGap = 14;
  const metaW = (heroW - metaGap) / 2;
  drawInfoBlock(doc, heroX, metaY, metaW, 'DATE & TIME', `${dateText}\n${timeText}`, fontFamily, fontBold, primaryColor, accentColor, muted);
  drawInfoBlock(doc, heroX + metaW + metaGap, metaY, metaW, 'VENUE', event.location || 'TBA', fontFamily, fontBold, primaryColor, accentColor, muted);

  const mainY = metaY + 104;
  const qrSize = 152;
  const qrBox = qrSize + 24;
  const detailsX = showQR ? heroX + qrBox + 26 : heroX;
  const detailsW = showQR ? heroW - qrBox - 26 : heroW;

  if (showQR) {
    drawRoundedRect(doc, heroX, mainY, qrBox, qrBox, 22, [255, 255, 255]);
    drawRoundedRect(doc, heroX + 6, mainY + 6, qrBox - 12, qrBox - 12, 16, null, { color: primaryColor, width: 2 });
    try {
      doc.image(qrCodeBuffer, heroX + 12, mainY + 12, { width: qrSize, height: qrSize });
    } catch {
      doc.font(fontBold).fontSize(18).fillColor([20, 20, 20]).text('QR', heroX + 64, mainY + 72);
    }
    doc.font(fontBold).fontSize(8).fillColor(muted)
      .text('SCAN AT ENTRY', heroX, mainY + qrBox + 10, { width: qrBox, align: 'center', characterSpacing: 1.2 });
  }

  doc.font(fontBold).fontSize(9).fillColor(primaryColor)
    .text('TICKET NUMBER', detailsX, mainY + 2, { characterSpacing: 1.4 });
  doc.font('Courier-Bold').fontSize(24).fillColor(accentColor)
    .text(ticket.id.substring(0, 8).toUpperCase(), detailsX, mainY + 22, { width: detailsW });

  drawMiniDivider(doc, detailsX, mainY + 68, detailsW);

  doc.font(fontBold).fontSize(9).fillColor(muted)
    .text('ATTENDEE', detailsX, mainY + 88, { characterSpacing: 1.2 });
  doc.font(fontBold).fontSize(18).fillColor(accentColor)
    .text(attendee.name || 'Guest', detailsX, mainY + 108, { width: detailsW, ellipsis: true });
  doc.font(fontFamily).fontSize(10).fillColor(COLORS.lightGray)
    .text(attendee.email || order.registration.userEmail || '-', detailsX, mainY + 134, { width: detailsW, ellipsis: true });

  const tearY = mainY + qrBox + 58;
  drawCutouts(doc, tearY, bgColor);
  drawPerforatedLine(doc, cardX + 24, tearY, cardX + cardWidth - 24, [110, 108, 122]);

  const footerY = tearY + 30;
  drawRoundedRect(doc, heroX, footerY, heroW, 76, 18, [17, 16, 21]);
  doc.font(fontBold).fontSize(9).fillColor(primaryColor)
    .text('IMPORTANT', heroX + 20, footerY + 18, { characterSpacing: 1.3 });
  doc.font(fontFamily).fontSize(9.5).fillColor(COLORS.lightGray)
    .text('This pass is valid for one entry only. Keep the QR code clearly visible at the gate.', heroX + 20, footerY + 38, {
      width: heroW - 40,
      lineGap: 2
    });

  if (showLogo) {
    doc.font(fontBold).fontSize(14).fillColor(primaryColor)
      .text('Occasio', 0, TICKET_HEIGHT - 52, { width: TICKET_WIDTH, align: 'center' });
  }

  doc.font(fontFamily).fontSize(8).fillColor(muted)
    .text(`Issued ${new Date(ticket.issuedAt).toLocaleDateString('en-IN')}`, 0, TICKET_HEIGHT - 32, {
      width: TICKET_WIDTH,
      align: 'center'
    });
}

function drawInfoBlock(doc, x, y, width, label, value, fontFamily, fontBold, primaryColor, accentColor, muted) {
  drawRoundedRect(doc, x, y, width, 82, 18, [17, 16, 21]);
  doc.font(fontBold).fontSize(8).fillColor(primaryColor)
    .text(label, x + 16, y + 15, { width: width - 32, characterSpacing: 1.2 });
  doc.font(fontBold).fontSize(12).fillColor(accentColor)
    .text(value, x + 16, y + 35, { width: width - 32, lineGap: 2, ellipsis: true });
  doc.font(fontFamily).fontSize(1).fillColor(muted);
}

function drawMiniDivider(doc, x, y, width) {
  doc.save();
  doc.lineWidth(0.6).strokeColor([62, 60, 70]);
  doc.moveTo(x, y).lineTo(x + width, y).stroke();
  doc.restore();
}

// ============== MAIN EXPORT FUNCTIONS ==============
export async function generateTicketPDF(order) {
  try {
    let ticket = await ensureTicketWithQr(order);

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

    // Upload to R2
    let ticketPdfUrl = null;
    if (isR2Configured()) {
      try {
        const key = `tickets/${order.registration.event.id}/${ticket.id}.pdf`;
        ticketPdfUrl = await uploadBufferToR2({
          buffer: pdfBuffer,
          key,
          contentType: 'application/pdf',
        });
      } catch (uploadError) {
        console.error('R2 upload failed:', uploadError);
      }
    }

    // Fallback to Cloudinary
    if (!ticketPdfUrl && isCloudinaryConfigured()) {
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
    const ticket = await ensureTicketWithQr(order);

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
