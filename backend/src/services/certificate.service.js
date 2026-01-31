import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fetch from 'node-fetch';

export const generateCertificate = async (templateUrl, mapping, data) => {
  try {
    // 1. Fetch the template
    const existingPdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer());

    // 2. Load PDF
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // 3. Draw fields
    for (const field of mapping) {
      const { fieldId, x, y, fontSize = 12, color = '#000000' } = field;
      
      let text = '';
      if (fieldId === 'userName') text = data.userName || '';
      if (fieldId === 'eventName') text = data.eventName || '';
      if (fieldId === 'date') text = data.date || '';
      
      // Convert hex color to rgb
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;

      firstPage.drawText(text, {
        x: x * width,
        y: (1 - y) * height, // PDF y-axis starts from bottom, but DOM usually top
        size: fontSize,
        font: font,
        color: rgb(r, g, b),
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
