import { Injectable, Logger } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';

export interface VoucherTicket {
  code: string;
  password: string;
  planName: string;
  durationMinutes: number;
  priceXof: number;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Generates a printable PDF sheet of voucher tickets.
   * Layout: 2 columns × N rows, each ticket 290×160 pts (≈10×5.6 cm)
   */
  async generateVoucherSheet(
    vouchers: VoucherTicket[],
    businessName = 'MikroServer WiFi',
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 20,
          autoFirstPage: true,
        });

        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const PAGE_W = doc.page.width;
        const MARGIN = 20;
        const COL = 2;
        const CARD_W = (PAGE_W - MARGIN * 2 - 10) / COL;
        const CARD_H = 160;
        const GAP = 10;

        let col = 0;
        let row = 0;
        let pageCount = 0;

        for (let i = 0; i < vouchers.length; i++) {
          const v = vouchers[i]!;
          const x = MARGIN + col * (CARD_W + GAP);
          const y = MARGIN + row * (CARD_H + GAP);

          // Auto page break
          if (y + CARD_H > doc.page.height - MARGIN) {
            doc.addPage();
            pageCount++;
            row = 0;
            col = 0;
          }

          const cx = MARGIN + col * (CARD_W + GAP);
          const cy = MARGIN + row * (CARD_H + GAP);

          // Card background + border
          doc
            .save()
            .roundedRect(cx, cy, CARD_W, CARD_H, 8)
            .fillAndStroke('#F0F7FF', '#2563EB')
            .restore();

          // Header band
          doc
            .save()
            .roundedRect(cx, cy, CARD_W, 28, 8)
            .fill('#2563EB');
          doc.rect(cx, cy + 14, CARD_W, 14).fill('#2563EB');
          doc.restore();

          // Business name
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#FFFFFF')
            .text(businessName.toUpperCase(), cx + 8, cy + 8, {
              width: CARD_W - 16,
              align: 'left',
            });

          // Plan name + duration label (top right)
          const dur = this.formatDuration(v.durationMinutes);
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#FFFFFF')
            .text(`${v.planName} · ${dur}`, cx + 8, cy + 8, {
              width: CARD_W - 16,
              align: 'right',
            });

          // CODE label
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor('#1E3A5F')
            .text('CODE D\'ACCÈS', cx + 8, cy + 36);

          // CODE value
          doc
            .font('Helvetica-Bold')
            .fontSize(14)
            .fillColor('#1E3A5F')
            .text(v.code, cx + 8, cy + 48);

          // PASSWORD
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor('#1E3A5F')
            .text('MOT DE PASSE', cx + 8, cy + 70);

          doc
            .font('Helvetica-Bold')
            .fontSize(11)
            .fillColor('#1E3A5F')
            .text(v.password, cx + 8, cy + 82);

          // Price
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor('#374151')
            .text(
              `Prix: ${v.priceXof.toLocaleString('fr-CI')} FCFA`,
              cx + 8,
              cy + 102,
            );

          // QR Code
          try {
            const qrDataUrl = await QRCode.toDataURL(v.code, {
              errorCorrectionLevel: 'M',
              width: 80,
              margin: 1,
              color: { dark: '#1E3A5F', light: '#F0F7FF' },
            });
            const qrBuffer = Buffer.from(
              qrDataUrl.replace('data:image/png;base64,', ''),
              'base64',
            );
            doc.image(qrBuffer, cx + CARD_W - 85, cy + 35, { width: 78, height: 78 });
          } catch {
            this.logger.warn(`QR code generation failed for ${v.code}`);
          }

          // Dashed cut line (bottom)
          doc
            .save()
            .moveTo(cx, cy + CARD_H)
            .lineTo(cx + CARD_W, cy + CARD_H)
            .dash(3, { space: 3 })
            .strokeColor('#9CA3AF')
            .stroke()
            .restore();

          col++;
          if (col >= COL) {
            col = 0;
            row++;
          }
        }

        doc.end();
        this.logger.log(
          `PDF generated: ${vouchers.length} tickets on ${pageCount + 1} page(s)`,
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  private formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    if (minutes < 10080) return `${Math.round(minutes / 1440)} jour(s)`;
    return `${Math.round(minutes / 10080)} semaine(s)`;
  }
}
