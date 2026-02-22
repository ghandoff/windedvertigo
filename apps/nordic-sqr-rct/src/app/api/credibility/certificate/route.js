import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || 'Reviewer';
    const reviews = searchParams.get('reviews') || '0';
    const institution = searchParams.get('institution') || '';

    const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    const pacificColor = '#024a87';
    const goldColor = '#B8860B';
    const width = doc.page.width;
    const height = doc.page.height;
    const centerX = width / 2;

    // Top decorative border
    doc
      .strokeColor(pacificColor)
      .lineWidth(3)
      .moveTo(50, 50)
      .lineTo(width - 50, 50)
      .stroke();

    // Bottom decorative border
    doc
      .strokeColor(pacificColor)
      .lineWidth(3)
      .moveTo(50, height - 50)
      .lineTo(width - 50, height - 50)
      .stroke();

    // Left decorative border
    doc
      .strokeColor(pacificColor)
      .lineWidth(2)
      .moveTo(50, 50)
      .lineTo(50, height - 50)
      .stroke();

    // Right decorative border
    doc
      .strokeColor(pacificColor)
      .lineWidth(2)
      .moveTo(width - 50, 50)
      .lineTo(width - 50, height - 50)
      .stroke();

    // Decorative corner elements
    const cornerSize = 20;
    // Top-left corner
    doc
      .fillColor(pacificColor)
      .rect(50, 50, cornerSize, cornerSize)
      .fill();
    // Top-right corner
    doc.rect(width - 50 - cornerSize, 50, cornerSize, cornerSize).fill();
    // Bottom-left corner
    doc.rect(50, height - 50 - cornerSize, cornerSize, cornerSize).fill();
    // Bottom-right corner
    doc.rect(width - 50 - cornerSize, height - 50 - cornerSize, cornerSize, cornerSize).fill();

    // Reset fill color for text
    doc.fillColor(pacificColor);

    // Title
    doc
      .font('Helvetica-Bold')
      .fontSize(48)
      .text('Certificate of Contribution', centerX - 250, 100, { width: 500, align: 'center' });

    // Subtitle
    doc
      .font('Helvetica')
      .fontSize(18)
      .fillColor(goldColor)
      .text('SQR-RCT Platform — Nordic Naturals', centerX - 250, 165, { width: 500, align: 'center' });

    // Decorative line
    doc
      .strokeColor(goldColor)
      .lineWidth(1.5)
      .moveTo(centerX - 100, 195)
      .lineTo(centerX + 100, 195)
      .stroke();

    // Reset to pacific color for body text
    doc.fillColor(pacificColor);

    // Preamble text
    doc
      .font('Helvetica')
      .fontSize(14)
      .text(
        'This certifies that',
        centerX - 300,
        240,
        { width: 600, align: 'center', lineGap: 8 }
      );

    // Recipient name - highlighted
    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .text(name, centerX - 300, 270, { width: 600, align: 'center' });

    // Institution if available
    if (institution) {
      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor('#666666')
        .text(`of ${institution}`, centerX - 300, 305, { width: 600, align: 'center' });
    }

    // Main certification text
    doc
      .fillColor(pacificColor)
      .font('Helvetica')
      .fontSize(13)
      .text(
        `has served as an expert reviewer on the Systematic Quality Review of Randomized Controlled Trials (SQR-RCT) Platform, completing ${reviews} review${
          reviews === '1' ? '' : 's'
        } in service of evidence-based research quality standards.`,
        centerX - 280,
        institution ? 345 : 310,
        { width: 560, align: 'center', lineGap: 6 }
      );

    // Date
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor('#666666')
      .text(`Date: ${dateStr}`, centerX - 250, 420, { width: 500, align: 'center' });

    // Signature line
    const signatureY = 450;
    doc
      .strokeColor(pacificColor)
      .lineWidth(1)
      .moveTo(centerX - 120, signatureY)
      .lineTo(centerX + 120, signatureY)
      .stroke();

    // Signature placeholder
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#999999')
      .text('Nordic Naturals Signature', centerX - 120, signatureY + 10, {
        width: 240,
        align: 'center',
      });

    // Footer text
    doc
      .font('Helvetica-Oblique')
      .fontSize(10)
      .fillColor('#999999')
      .text(
        'This certificate recognizes significant contribution to advancing research quality standards.',
        centerX - 300,
        height - 90,
        { width: 600, align: 'center', lineGap: 4 }
      );

    // Complete PDF generation
    doc.end();

    // Wait for doc to finish and collect all chunks
    const pdfBuffer = await new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);
    });

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="SQR-RCT-Certificate.pdf"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Certificate generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate certificate' },
      { status: 500 }
    );
  }
}
