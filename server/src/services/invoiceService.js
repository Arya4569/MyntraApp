const PDFDocument = require('pdfkit');

class InvoiceService {
  /**
   * Builds structured invoice metadata from verified order data
   */
  static getInvoiceData(order) {
    if (!order) return null;

    const invoiceNumber = order.invoiceNumber || `INV-${order.id}`;
    const orderDate = new Date(order.date || order.createdAt || Date.now());
    const formattedDate = orderDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    // Follow existing business configuration where configured; avoid inventing fake GSTINs
    const configuredSellerName = process.env.SELLER_BUSINESS_NAME || 'Omni Retail Fashion Pvt Ltd';
    const configuredGstin = process.env.SELLER_GSTIN || null; // Only include if actually configured

    const items = (order.items || []).map((item, idx) => {
      const prod = item.product || {};
      const unitPrice = Number(item.unitPrice || prod.price || 0);
      const qty = Number(item.quantity || 1);
      const lineTotal = Number(item.subtotal || unitPrice * qty);

      return {
        srNo: idx + 1,
        name: prod.name || 'Apparel & Fashion',
        brand: prod.brand || 'MYNTRA',
        size: item.size || 'M',
        color: item.color || 'Standard',
        seller: prod.seller?.name || configuredSellerName,
        quantity: qty,
        unitPrice,
        subtotal: lineTotal,
      };
    });

    const taxNote = 'Prices are inclusive of all applicable Goods and Services Taxes (GST).';

    return {
      invoiceNumber,
      orderId: order.id,
      orderDate: formattedDate,
      invoiceDate: formattedDate,
      seller: {
        name: configuredSellerName,
        address: 'Myntra Commerce Logistics, Sector 18, Gurugram, Haryana - 122015',
        gstin: configuredGstin,
      },
      buyer: {
        userId: order.userId,
        shippingAddress: order.shippingAddress || 'Customer Address, Mumbai - 400001',
      },
      items,
      pricing: {
        totalMRP: order.totalMRP || 0,
        discountAmount: order.discountAmount || 0,
        couponCode: order.appliedCoupon || null,
        couponDiscount: order.couponDiscount || 0,
        deliveryFee: order.deliveryFee || 0,
        totalAmount: order.totalAmount || 0,
      },
      payment: {
        method: order.paymentMethod || 'UPI / Online',
        status: order.paymentStatus || 'Paid',
      },
      taxNote,
      footerNote: 'This is a computer-generated tax invoice. No signature is required.',
    };
  }

  /**
   * Streams a professional vector PDF invoice to an Express response stream
   */
  static generatePdf(order, res) {
    return new Promise((resolve, reject) => {
      try {
        const data = this.getInvoiceData(order);
        if (!data) {
          throw new Error('Order not found or invalid.');
        }

        const doc = new PDFDocument({
          margin: 40,
          size: 'A4',
          info: {
            Title: `Invoice ${data.invoiceNumber}`,
            Author: 'Myntra Fashion',
            Subject: `Invoice for Order #${data.orderId}`,
          },
        });

        const safeOrderId = String(data.orderId).replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="Invoice-${safeOrderId}.pdf"`
        );
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        doc.on('error', (err) => {
          console.error('PDFKit stream error:', err);
          if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Failed to generate PDF invoice.' });
          }
          reject(err);
        });

        res.on('finish', () => resolve(true));
        res.on('error', (err) => {
          console.error('Express response error during PDF streaming:', err);
          reject(err);
        });

        doc.pipe(res);

        // Header Section
        doc
          .fillColor('#ff3f6c')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('MYNTRA', 40, 40)
          .fillColor('#282c3f')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('TAX INVOICE / RETAIL BILL OF SUPPLY', 300, 42, { align: 'right' });

        doc
          .strokeColor('#eaeaec')
          .lineWidth(1)
          .moveTo(40, 70)
          .lineTo(555, 70)
          .stroke();

        // Invoice Metadata Grid
        let y = 82;
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#535766')
          .text('INVOICE NUMBER:', 40, y)
          .font('Helvetica')
          .fillColor('#282c3f')
          .text(data.invoiceNumber, 140, y);

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#535766')
          .text('ORDER ID:', 340, y)
          .font('Helvetica')
          .fillColor('#282c3f')
          .text(`#${data.orderId}`, 440, y);

        y += 16;
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#535766')
          .text('INVOICE DATE:', 40, y)
          .font('Helvetica')
          .fillColor('#282c3f')
          .text(data.invoiceDate, 140, y);

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#535766')
          .text('ORDER DATE:', 340, y)
          .font('Helvetica')
          .fillColor('#282c3f')
          .text(data.orderDate, 440, y);

        y += 24;
        doc
          .strokeColor('#eaeaec')
          .lineWidth(1)
          .moveTo(40, y)
          .lineTo(555, y)
          .stroke();

        // Seller & Buyer Address Boxes
        y += 12;
        const colWidth = 240;

        // Seller Box
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#282c3f')
          .text('SOLD BY:', 40, y)
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#ff3f6c')
          .text(data.seller.name, 40, y + 14)
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#535766')
          .text(data.seller.address, 40, y + 26, { width: colWidth });

        if (data.seller.gstin) {
          doc
            .font('Helvetica-Bold')
            .fontSize(8.5)
            .fillColor('#282c3f')
            .text(`GSTIN: ${data.seller.gstin}`, 40, y + 54);
        }

        // Buyer Box
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#282c3f')
          .text('SHIPPING & BILLING ADDRESS:', 320, y)
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#535766')
          .text(data.buyer.shippingAddress, 320, y + 14, { width: 235 });

        // Table Header
        y = 200;
        doc
          .rect(40, y, 515, 22)
          .fillColor('#f5f5f6')
          .fill();

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#282c3f')
          .text('#', 48, y + 6)
          .text('ITEM DESCRIPTION', 70, y + 6)
          .text('SIZE', 310, y + 6)
          .text('QTY', 360, y + 6)
          .text('PRICE', 415, y + 6)
          .text('TOTAL', 490, y + 6, { width: 60, align: 'right' });

        y += 22;

        // Table Rows
        data.items.forEach((item) => {
          doc
            .font('Helvetica')
            .fontSize(8.5)
            .fillColor('#282c3f')
            .text(String(item.srNo), 48, y + 6)
            .font('Helvetica-Bold')
            .text(`${item.brand} - ${item.name}`, 70, y + 6, { width: 230 })
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#7e818c')
            .text(`Color: ${item.color} | Seller: ${item.seller}`, 70, y + 18, { width: 230 })
            .font('Helvetica')
            .fontSize(8.5)
            .fillColor('#282c3f')
            .text(item.size, 310, y + 6)
            .text(String(item.quantity), 360, y + 6)
            .text(`INR ${item.unitPrice}`, 415, y + 6)
            .font('Helvetica-Bold')
            .text(`INR ${item.subtotal}`, 490, y + 6, { width: 60, align: 'right' });

          y += 34;
          doc
            .strokeColor('#f0f0f2')
            .lineWidth(0.5)
            .moveTo(40, y)
            .lineTo(555, y)
            .stroke();

          // If table row nears bottom of page, add new page with table header
          if (y > 700) {
            doc.addPage();
            y = 40;
            doc.rect(40, y, 515, 22).fillColor('#f5f5f6').fill();
            doc
              .font('Helvetica-Bold')
              .fontSize(8.5)
              .fillColor('#282c3f')
              .text('#', 48, y + 6)
              .text('ITEM DESCRIPTION', 70, y + 6)
              .text('SIZE', 310, y + 6)
              .text('QTY', 360, y + 6)
              .text('PRICE', 415, y + 6)
              .text('TOTAL', 490, y + 6, { width: 60, align: 'right' });
            y += 22;
          }
        });

        // Ensure summary and footer have enough space or start new page
        if (y > 640) {
          doc.addPage();
          y = 40;
        } else {
          y += 10;
        }

        // Financial Breakdown Table
        const summaryX = 350;
        const valX = 480;

        const addRow = (label, value, bold = false, color = '#282c3f') => {
          doc
            .font(bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(9)
            .fillColor(color)
            .text(label, summaryX, y)
            .text(value, valX, y, { width: 70, align: 'right' });
          y += 15;
        };

        addRow('Total MRP:', `INR ${data.pricing.totalMRP}`);

        if (data.pricing.discountAmount > 0) {
          addRow('Discount on MRP:', `- INR ${data.pricing.discountAmount}`, false, '#047857');
        }

        if (data.pricing.couponCode) {
          addRow(`Coupon (${data.pricing.couponCode}):`, `- INR ${data.pricing.couponDiscount}`, false, '#047857');
        }

        addRow(
          'Delivery Fee:',
          data.pricing.deliveryFee === 0 ? 'FREE' : `INR ${data.pricing.deliveryFee}`,
          false,
          data.pricing.deliveryFee === 0 ? '#047857' : '#282c3f'
        );

        doc
          .strokeColor('#282c3f')
          .lineWidth(1)
          .moveTo(summaryX, y)
          .lineTo(555, y)
          .stroke();
        y += 6;

        addRow('TOTAL AMOUNT PAID:', `INR ${data.pricing.totalAmount}`, true, '#ff3f6c');

        y += 10;

        // Payment Info Box
        doc
          .rect(40, y, 270, 48)
          .fillColor('#f9f9fa')
          .strokeColor('#eaeaec')
          .lineWidth(0.8)
          .fillAndStroke();

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#282c3f')
          .text('PAYMENT DETAILS', 50, y + 8)
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#535766')
          .text(`Payment Mode: ${data.payment.method}`, 50, y + 20)
          .text(`Payment Status: ${data.payment.status.toUpperCase()}`, 50, y + 32);

        // Tax Declaration Note
        y += 60;
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#7e818c')
          .text(`* ${data.taxNote}`, 40, y)
          .text(`* ${data.footerNote}`, 40, y + 12);

        doc.end();
      } catch (err) {
        console.error('Invoice PDF generation error:', err);
        reject(err);
      }
    });
  }

  /**
   * Generates clean HTML invoice suitable for web preview and browser printing
   */
  static generateHtml(order) {
    const data = this.getInvoiceData(order);
    if (!data) return '<h3>Invoice data unavailable</h3>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${data.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #282c3f; background: #fff; }
    .invoice-card { max-width: 720px; margin: 0 auto; border: 1px solid #eaeaec; border-radius: 8px; padding: 28px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ff3f6c; padding-bottom: 16px; margin-bottom: 20px; }
    .logo { font-size: 26px; font-weight: 900; color: #ff3f6c; letter-spacing: 1px; }
    .doc-title { font-size: 13px; font-weight: 700; color: #535766; text-transform: uppercase; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 20px; }
    .meta-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #f0f0f2; }
    .meta-label { color: #7e818c; font-weight: 600; }
    .meta-val { font-weight: 600; color: #282c3f; }
    .addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; background: #f9f9fa; padding: 14px; border-radius: 6px; font-size: 12px; }
    .address-title { font-weight: 700; color: #282c3f; margin-bottom: 6px; }
    .seller-name { color: #ff3f6c; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    th { background: #f5f5f6; color: #282c3f; padding: 10px 8px; text-align: left; font-weight: 700; }
    td { padding: 10px 8px; border-bottom: 1px solid #f0f0f2; }
    .text-right { text-align: right; }
    .pricing-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
    .pricing-box { width: 280px; font-size: 12px; }
    .pricing-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .total-row { border-top: 2px solid #282c3f; font-size: 14px; font-weight: 800; color: #ff3f6c; padding-top: 8px; margin-top: 6px; }
    .footer-note { font-size: 10px; color: #94969f; line-height: 1.5; border-top: 1px solid #f0f0f2; padding-top: 12px; }
    @media print {
      body { padding: 0; }
      .invoice-card { border: none; padding: 0; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div class="logo">MYNTRA</div>
      <div class="doc-title">Tax Invoice / Bill of Supply</div>
    </div>

    <div class="meta-grid">
      <div class="meta-row"><span class="meta-label">Invoice No:</span><span class="meta-val">${data.invoiceNumber}</span></div>
      <div class="meta-row"><span class="meta-label">Order ID:</span><span class="meta-val">#${data.orderId}</span></div>
      <div class="meta-row"><span class="meta-label">Invoice Date:</span><span class="meta-val">${data.invoiceDate}</span></div>
      <div class="meta-row"><span class="meta-label">Order Date:</span><span class="meta-val">${data.orderDate}</span></div>
    </div>

    <div class="addresses">
      <div>
        <div class="address-title">SOLD BY:</div>
        <div class="seller-name">${data.seller.name}</div>
        <div>${data.seller.address}</div>
        ${data.seller.gstin ? `<div><strong>GSTIN:</strong> ${data.seller.gstin}</div>` : ''}
      </div>
      <div>
        <div class="address-title">DELIVERY ADDRESS:</div>
        <div>${data.buyer.shippingAddress}</div>
        <div style="margin-top: 6px;"><strong>Payment Method:</strong> ${data.payment.method} (${data.payment.status.toUpperCase()})</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>Size</th>
          <th>Qty</th>
          <th>Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.items
          .map(
            (item) => `<tr>
          <td>${item.srNo}</td>
          <td>
            <strong>${item.brand}</strong> - ${item.name}<br>
            <small style="color: #7e818c;">Color: ${item.color} | Seller: ${item.seller}</small>
          </td>
          <td>${item.size}</td>
          <td>${item.quantity}</td>
          <td>₹${item.unitPrice}</td>
          <td class="text-right"><strong>₹${item.subtotal}</strong></td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div class="pricing-wrap">
      <div class="pricing-box">
        <div class="pricing-row"><span>Total MRP:</span><span>₹${data.pricing.totalMRP}</span></div>
        ${
          data.pricing.discountAmount > 0
            ? `<div class="pricing-row" style="color: #047857;"><span>Discount on MRP:</span><span>-₹${data.pricing.discountAmount}</span></div>`
            : ''
        }
        ${
          data.pricing.couponCode
            ? `<div class="pricing-row" style="color: #047857;"><span>Coupon (${data.pricing.couponCode}):</span><span>-₹${data.pricing.couponDiscount}</span></div>`
            : ''
        }
        <div class="pricing-row"><span>Delivery Fee:</span><span>${data.pricing.deliveryFee === 0 ? 'FREE' : '₹' + data.pricing.deliveryFee}</span></div>
        <div class="pricing-row total-row"><span>FINAL AMOUNT:</span><span>₹${data.pricing.totalAmount}</span></div>
      </div>
    </div>

    <div class="footer-note">
      <div>* ${data.taxNote}</div>
      <div>* ${data.footerNote}</div>
    </div>
  </div>
</body>
</html>`;
  }
}

module.exports = InvoiceService;
