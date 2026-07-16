import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import path from 'path';

function normalizeDoc(doc: string): string {
  return (doc || '').replace(/\D+/g, '');
}

function familyName(it: any): string {
  const cf: any = it?.inventoryItem?.commercialFamily;
  let fam = String(cf?.description || cf?.name || '').trim();
  if (!fam) {
    const name = String(it?.name || '').toUpperCase();
    if (name.includes('CHAPA') || name.includes('CHAPAS')) fam = 'CHAPAS';
    else if (name.includes('MIOL')) fam = 'MIOLO';
    else fam = 'Outras famílias';
  }
  return fam.toUpperCase();
}

function computeWeightKgFromFields(it: any): number {
  const w = Number(it?.width ?? 0);
  const l = Number(it?.length ?? 0);
  const g = Number(it?.grammage ?? 0);
  const q = Number(it?.quantity ?? 0);
  if (w > 0 && l > 0 && g > 0 && q > 0) {
    const areaM2 = (l / 1000) * (w / 1000);
    const weightKg = (areaM2 * g * q) / 1000;
    return weightKg;
  }
  return 0;
}

function fmtMoney(n: any): string {
  const v = Number(n ?? 0);
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCurrency(n: any): string {
  const v = Number(n ?? 0);
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtInt(n: any): string {
  const v = Number(n ?? 0);
  const safe = Number.isFinite(v) ? v : 0;
  return Math.round(safe).toLocaleString('pt-BR');
}

function fmtDate(n: any): string {
  if (!n) return '';
  const d = n instanceof Date ? n : new Date(n);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

export function salesOrderPdfFileName(order: any): string {
  const code = String(order?.code || order?.id || 'pedido');
  const safeName = code.replace(/[^A-Za-z0-9_-]+/g, '_');
  return `espelho_${safeName}.pdf`;
}

export async function renderSalesOrderPdf(order: any): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  doc.pipe(stream);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const left = doc.page.margins.left;
  const right = pageW - doc.page.margins.right;
  const top = doc.page.margins.top;
  const bottom = pageH - doc.page.margins.bottom;

  const code = String(order?.code || order?.id || '');
  const orderDate = order?.orderDate ? new Date(order.orderDate) : null;
  const orderDateStr = orderDate && !isNaN(orderDate.getTime()) ? orderDate.toLocaleDateString('pt-BR') : '';

  const entityName = String(order?.entity?.name || '').trim();
  const entityDoc = normalizeDoc(String(order?.entity?.cnpj || order?.entityCnpj || order?.entityDoc || ''));
  const companyLine = `${entityName || '-'}${entityDoc ? ` • CNPJ: ${entityDoc}` : ''}`;

  const customerName = String(order?.customerName || '').trim();
  const customerDocRaw = String(order?.client?.doc || order?.customerDoc || '');
  const customerDoc = normalizeDoc(customerDocRaw);
  const deliveryDate = order?.deliveryDate ? new Date(order.deliveryDate) : null;
  const deliveryDateStr = deliveryDate && !isNaN(deliveryDate.getTime()) ? deliveryDate.toLocaleDateString('pt-BR') : '';
  const paymentTerms = String(order?.paymentTerms || '').trim();
  const status = String(order?.status || '').trim();

  const logoPath = path.join(process.cwd(), 'public', 'icons', 'logo cartonificio.png');
  try {
    doc.image(logoPath, left, top, { fit: [160, 52] });
  } catch {
    doc.fontSize(22).font('Helvetica-Bold').text('Pedido', left, top);
  }

  doc.font('Helvetica-Bold').fontSize(11).text(`Pedido: ${code}`, right - 220, top, { width: 220, align: 'right' });
  doc.font('Helvetica').fontSize(10).text(`Data: ${orderDateStr}`, right - 220, top + 16, { width: 220, align: 'right' });

  const headerLineY = top + 62;
  doc.moveTo(left, headerLineY).lineTo(right, headerLineY).lineWidth(1).strokeColor('#D0D0D0').stroke();

  let infoY = headerLineY + 10;
  const labelW = 90;
  const rowH = 16;
  const infoX = left;
  const infoValueX = left + labelW;
  const infoWidth = right - left;

  const infoRow = (label: string, value: string) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text(label, infoX, infoY, { width: labelW });
    doc.font('Helvetica').fontSize(9).fillColor('#000000').text(value || '-', infoValueX, infoY, { width: infoWidth - labelW });
    infoY += rowH;
  };

  infoRow('Empresa:', companyLine);
  infoRow('Cliente:', customerName);
  infoRow('Documento:', customerDoc || '-');
  infoRow('Situação:', status || '-');
  infoRow('Entrega:', deliveryDateStr || '-');
  infoRow('Cond. Pgto:', paymentTerms || '-');

  const tableTopY = infoY + 10;
  const tableX = left;
  const tableW = right - left;
  const colDefs = [
    { key: 'name', label: 'Item', w: 255, align: 'left' as const },
    { key: 'sku', label: 'SKU', w: 48, align: 'left' as const },
    { key: 'itemDeliveryDate', label: 'Dt Entrega', w: 62, align: 'left' as const },
    { key: 'width', label: 'Larg.', w: 38, align: 'right' as const },
    { key: 'length', label: 'Compr.', w: 42, align: 'right' as const },
    { key: 'grammage', label: 'Gram.', w: 38, align: 'right' as const },
    { key: 'itemUnit', label: 'UM', w: 22, align: 'left' as const },
    { key: 'quantity', label: 'Qtd', w: 40, align: 'right' as const },
    { key: 'weightKg', label: 'Peso (KG)', w: 54, align: 'right' as const },
    { key: 'priceUnit', label: 'UM', w: 22, align: 'left' as const },
    { key: 'unitPrice', label: 'Preço', w: 48, align: 'right' as const },
    { key: 'pricePerPc', label: 'Preço/PC', w: 50, align: 'right' as const },
    { key: 'discountPct', label: 'Desc (%)', w: 40, align: 'right' as const },
  ];

  const fixedW = colDefs.reduce((s, c) => s + c.w, 0);
  if (fixedW !== tableW) {
    const delta = tableW - fixedW;
    colDefs[0].w = Math.max(160, colDefs[0].w + delta);
  }

  const drawHeader = (y: number) => {
    doc.save();
    doc.rect(tableX, y, tableW, 20).fill('#F3F4F6');
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8.5);
    let x = tableX;
    for (const c of colDefs) {
      doc.text(c.label, x + 2, y + 6, { width: c.w - 4, align: c.align });
      x += c.w;
    }
    doc.restore();
    doc.moveTo(tableX, y + 20).lineTo(tableX + tableW, y + 20).lineWidth(1).strokeColor('#D0D0D0').stroke();
  };

  const drawGroupRow = (y: number, label: string) => {
    doc.save();
    doc.rect(tableX, y, tableW, 18).fill('#FFFFFF');
    doc.fillColor('#4B5563').font('Helvetica-Bold').fontSize(9).text(label, tableX + 4, y + 5, { width: tableW - 8 });
    doc.restore();
    doc.moveTo(tableX, y + 18).lineTo(tableX + tableW, y + 18).lineWidth(1).strokeColor('#E5E7EB').stroke();
  };

  const drawRow = (y: number, row: any) => {
    doc.save();
    doc.rect(tableX, y, tableW, 18).fill('#FFFFFF');
    doc.fillColor('#111827').font('Helvetica').fontSize(8.2);
    let x = tableX;
    for (const c of colDefs) {
      const v = row[c.key];
      const txt = v == null ? '' : String(v);
      doc.text(txt, x + 2, y + 5, { width: c.w - 4, align: c.align, ellipsis: true });
      x += c.w;
    }
    doc.restore();
    doc.moveTo(tableX, y + 18).lineTo(tableX + tableW, y + 18).lineWidth(1).strokeColor('#E5E7EB').stroke();
  };

  let y = tableTopY;
  drawHeader(y);
  y += 20;

  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const byGroup = new Map<string, any[]>();
  for (const it of items) {
    const key = familyName(it);
    const arr = byGroup.get(key) || [];
    arr.push(it);
    byGroup.set(key, arr);
  }
  const groups = Array.from(byGroup.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  let subtotal = 0;
  let discountTotal = 0;
  let totalWeight = 0;

  for (const [groupLabel, list] of groups) {
    if (y + 18 > bottom - 90) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader(y);
      y += 20;
    }
    drawGroupRow(y, groupLabel);
    y += 18;

    for (const it of list) {
      if (y + 18 > bottom - 90) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader(y);
        y += 20;
      }

      const qty = Number(it?.quantity ?? 0);
      const unitPrice = Number(it?.unitPrice ?? 0);
      const discPct = Number(it?.discountPct ?? 0);
      const priceUnit = String(it?.unit || '').trim().toUpperCase();
      const itemUnit = String(it?.inventoryItem?.unit || '').trim() || String(it?.unit || '').trim() || '-';
      const weightKg = computeWeightKgFromFields(it);
      const base = priceUnit === 'KG' ? weightKg * unitPrice : qty * unitPrice;
      const lineDisc = base * (discPct / 100);
      const pricePerPc = priceUnit === 'KG' ? (qty > 0 ? (weightKg / qty) * unitPrice : 0) : unitPrice;

      subtotal += base;
      discountTotal += lineDisc;
      totalWeight += weightKg;

      drawRow(y, {
        name: String(it?.name || ''),
        sku: String(it?.sku || it?.inventoryItem?.sku || ''),
        itemDeliveryDate: fmtDate(it?.itemDeliveryDate),
        width: it?.width ? fmtInt(it.width) : '',
        length: it?.length ? fmtInt(it.length) : '',
        grammage: it?.grammage ? fmtInt(it.grammage) : '',
        itemUnit,
        quantity: qty ? fmtInt(qty) : '',
        weightKg: weightKg > 0 ? fmtMoney(weightKg) : '',
        priceUnit: String(it?.unit || '').trim() || '',
        unitPrice: unitPrice > 0 ? fmtMoney(unitPrice) : '',
        pricePerPc: pricePerPc > 0 ? fmtMoney(pricePerPc) : '',
        discountPct: discPct ? fmtMoney(discPct) : '0,00',
      });
      y += 18;
    }
  }

  const total = subtotal - discountTotal;

  const totalsY = Math.max(y + 10, bottom - 75);
  doc.moveTo(tableX, totalsY).lineTo(tableX + tableW, totalsY).lineWidth(1).strokeColor('#D0D0D0').stroke();

  const labelX = tableX + tableW - 260;
  const totalsValueX = tableX + tableW - 10;
  let ty = totalsY + 10;

  const totalsRow = (label: string, value: string) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(label, labelX, ty, { width: 180, align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor('#111827').text(value, totalsValueX - 70, ty, { width: 70, align: 'right' });
    ty += 14;
  };

  totalsRow('Subtotal:', fmtCurrency(subtotal));
  totalsRow('Descontos:', fmtCurrency(discountTotal));
  totalsRow('Total:', fmtCurrency(total));
  doc.font('Helvetica').fontSize(9).fillColor('#4B5563').text(`Total Peso (KG): ${fmtMoney(totalWeight)}`, tableX + 4, totalsY + 10, { width: 260 });

  doc.end();
  return await done;
}
