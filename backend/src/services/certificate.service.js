import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadCloudinaryBuffer } from '../utils/cloudinary.util.js';
import { getR2ObjectBuffer, isR2TemplateRef } from '../utils/r2.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Certificate types
export const CERTIFICATE_TYPES = {
  PARTICIPATION: 'participation',
  FIRST_PRIZE: 'first_prize',
  SECOND_PRIZE: 'second_prize',
  THIRD_PRIZE: 'third_prize',
};

export const CERTIFICATE_TYPE_LABELS = {
  [CERTIFICATE_TYPES.PARTICIPATION]: 'Participation',
  [CERTIFICATE_TYPES.FIRST_PRIZE]: '1st Prize',
  [CERTIFICATE_TYPES.SECOND_PRIZE]: '2nd Prize',
  [CERTIFICATE_TYPES.THIRD_PRIZE]: '3rd Prize',
};

/**
 * Fetches PDF template bytes from various sources:
 * - base64 data URL
 * - HTTP/HTTPS URL
 * - Local file path (relative to uploads dir)
 */
async function fetchTemplateBytes(templateUrl) {
  if (!templateUrl) {
    throw new Error('No template URL provided');
  }

  // Handle base64 data URL
  if (templateUrl.startsWith('data:')) {
    const base64Data = templateUrl.split(',')[1];
    return Buffer.from(base64Data, 'base64');
  }

  // Handle private R2 object refs (r2://bucket/key)
  if (isR2TemplateRef(templateUrl)) {
    return getR2ObjectBuffer(templateUrl);
  }

  // Handle HTTP/HTTPS URL (using native fetch, Node 18+)
  if (templateUrl.startsWith('http://') || templateUrl.startsWith('https://')) {
    // For Cloudinary URLs, use the dedicated download helper (bypasses CDN auth)
    if (templateUrl.includes('cloudinary.com')) {
      const buffer = await downloadCloudinaryBuffer(templateUrl);
      if (buffer) return buffer;
      throw new Error('Failed to download template from Cloudinary');
    }

    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  // Handle local file path (e.g., /uploads/file-xxx.pdf)
  let localPath = templateUrl;
  if (localPath.startsWith('/uploads/')) {
    localPath = path.join(__dirname, '../../', localPath);
  } else if (!path.isAbsolute(localPath)) {
    localPath = path.join(__dirname, '../../uploads/', localPath);
  }

  if (!fs.existsSync(localPath)) {
    throw new Error(`Template file not found at: ${localPath}`);
  }

  return fs.readFileSync(localPath);
}

/**
 * Resolves field value from data based on fieldId
 */
function resolveFieldValue(fieldId, data) {
  switch (fieldId) {
    case 'userName': return data.userName || '';
    case 'eventName': return data.eventName || '';
    case 'date': return data.date || '';
    case 'certificateType': return data.certificateType || '';
    case 'rank': return data.rank || '';
    case 'qrCode': return data.qrCode || '';
    default: return '';
  }
}

/**
 * Parse hex color to pdf-lib rgb
 */
function parseColor(hexColor) {
  const hex = (hexColor || '#000000').replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Generates a certificate PDF from a template and field mappings
 * @param {string} templateUrl - URL, data URL, or local path to PDF template
 * @param {Array} mapping - Array of field placement objects
 * @param {Object} data - Data to fill in (userName, eventName, date, certificateType, rank, qrCode)
 * @returns {Uint8Array} generated PDF bytes
 */
export const generateCertificate = async (templateUrl, mapping, data) => {
  try {
    // 1. Fetch the template
    const existingPdfBytes = await fetchTemplateBytes(templateUrl);

    // 2. Load PDF
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // 3. Draw fields
    for (const field of (mapping || [])) {
      const { fieldId, x, y, fontSize = 12, color = '#000000', bold = false } = field;
      
      const text = resolveFieldValue(fieldId, data);
      if (!text) continue;

      const selectedFont = bold ? boldFont : font;
      const textWidth = selectedFont.widthOfTextAtSize(text, fontSize);

      firstPage.drawText(text, {
        x: (x * width) - (textWidth / 2), // Center text on the placement point
        y: (1 - y) * height,
        size: fontSize,
        font: selectedFont,
        color: parseColor(color),
      });
    }

    // 4. Save
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    console.error('Certificate generation error:', error);
    throw error;
  }
};

/**
 * Generate certificate for a specific type from event config
 * @param {Object} event - Event object with certificateConfigs
 * @param {string} certType - Certificate type (participation, first_prize, etc.)
 * @param {Object} data - Data to fill in
 * @returns {Uint8Array} generated PDF bytes
 */
export const generateTypedCertificate = async (event, certType, data) => {
  const configs = event.certificateConfigs || {};
  const config = configs[certType];

  if (!config || !config.templateUrl) {
    // Fallback to legacy fields for participation certificates
    if (certType === CERTIFICATE_TYPES.PARTICIPATION && event.certificateTemplateUrl) {
      return generateCertificate(
        event.certificateTemplateUrl,
        event.certificateMapping || [],
        { ...data, certificateType: CERTIFICATE_TYPE_LABELS[certType] }
      );
    }
    throw new Error(`No template configured for certificate type: ${certType}`);
  }

  return generateCertificate(
    config.templateUrl,
    config.mapping || [],
    { ...data, certificateType: CERTIFICATE_TYPE_LABELS[certType], rank: getRankLabel(certType) }
  );
};

function getRankLabel(certType) {
  switch (certType) {
    case CERTIFICATE_TYPES.FIRST_PRIZE: return '1st Place';
    case CERTIFICATE_TYPES.SECOND_PRIZE: return '2nd Place';
    case CERTIFICATE_TYPES.THIRD_PRIZE: return '3rd Place';
    default: return '';
  }
}
