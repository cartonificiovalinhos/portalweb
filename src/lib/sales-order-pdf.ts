import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import path from 'path';

/**
 * Espelho de pedido: layout A4 retrato baseado no modelo pedvenda184587_153013.rtf.
 * Este arquivo e o unico ponto de renderizacao: preview, link publico e e-mail
 * continuam usando renderSalesOrderPdf e salesOrderPdfFileName, sem alterar as rotas.
 */

function normalizeDoc(value: unknown): string {
  return String(value ?? '').replace(/\D+/g, '');
}

function firstValue(...values: unknown[]): string {
  for (const value of values) {
    if (value == null || typeof value === 'object') continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function finiteNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function fmtDecimal(value: number, digits = 2): string {
  return finiteNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtDate(value: unknown): string {
  if (!value) return '';
  const str = String(value);
  const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (dateOnly && !(value instanceof Date)) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }
  const date = value instanceof Date ? value : new Date(str);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
}

function familyName(item: any): string {
  const family = item?.inventoryItem?.commercialFamily;
  let name = firstValue(family?.description, family?.name);
  if (!name) {
    const itemName = String(item?.name || '').toUpperCase();
    if (itemName.includes('CHAPA')) name = 'CHAPAS';
    else if (itemName.includes('MIOL')) name = 'MIOLO';
    else name = 'Outras famílias';
  }
  return name.toUpperCase();
}

function computeWeightKgFromFields(item: any): number {
  const width = finiteNumber(item?.width);
  const length = finiteNumber(item?.length);
  const grammage = finiteNumber(item?.grammage);
  const quantity = finiteNumber(item?.quantity);
  if (width > 0 && length > 0 && grammage > 0 && quantity > 0) {
    return ((length / 1000) * (width / 1000) * grammage * quantity) / 1000;
  }
  // Quando o pedido ja tem peso total calculado pelo backend, aproveita-o.
  // Nao usa "weight" generico, que pode representar peso unitario.
  const provided = finiteNumber(item?.weightKg ?? item?.totalWeightKg);
  return provided > 0 ? provided : 0;
}

function itemDescription(item: any): string {
  const original = firstValue(item?.name, item?.description, item?.inventoryItem?.description, item?.sku) || '-';
  const width = finiteNumber(item?.width);
  const length = finiteNumber(item?.length);
  const dimension = width > 0 && length > 0 ? `${fmtDecimal(width, 0)} x ${fmtDecimal(length, 0)}` : '';
  // Exibir a dimensao apenas quando ela ainda nao integra a descricao.
  if (
    dimension &&
    !original.includes(dimension) &&
    !(new RegExp(`${Math.round(width)}\\s*[xX×]\\s*${Math.round(length)}`).test(original))
  ) {
    return `${original} | ${dimension}`;
  }
  return original;
}

function orderRemarks(order: any): string {
  return firstValue(
    order?.customerNotes,
    order?.orderNotes,
    order?.notes,
    order?.observation,
    order?.observations,
    order?.remarks,
  );
}

export function salesOrderPdfFileName(order: any): string {
  const code = String(order?.code || order?.id || 'pedido');
  return `espelho_${code.replace(/[^A-Za-z0-9_-]+/g, '_')}.pdf`;
}

/** Calcula o mesmo valor da linha exibido em Vl Total, para usar no Preco/KG. */
function calculateItem(item: any) {
  const quantity = finiteNumber(item?.quantity);
  const unitPrice = finiteNumber(item?.unitPrice);
  const discountPct = finiteNumber(item?.discountPct);
  const unit = firstValue(item?.unit).toUpperCase();
  const weight = computeWeightKgFromFields(item);
  const gross = unit === 'KG' ? weight * unitPrice : quantity * unitPrice;
  const discount = gross * (discountPct / 100);
  const total = gross - discount;
  const unitPricePerPiece = unit === 'KG'
    ? (quantity > 0 ? (weight / quantity) * unitPrice : 0)
    : unitPrice;
  // Uma divisao por zero NUNCA deve imprimir NaN ou Infinity no PDF.
  const pricePerKg = weight > 0 ? total / weight : null;
  const ipiValue = hasValue(item?.ipiValue)
    ? finiteNumber(item.ipiValue)
    : hasValue(item?.ipiAmount)
      ? finiteNumber(item.ipiAmount)
      : hasValue(item?.ipiTotal)
        ? finiteNumber(item.ipiTotal)
        : null;
  return {
    quantity,
    unitPrice,
    discountPct,
    unit,
    weight,
    gross,
    discount,
    total,
    pricePerKg,
    unitPricePerPiece,
    ipiValue,
  };
}

export async function renderSalesOrderPdf(order: any): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 18,
    bufferPages: true,
    info: { Title: `Espelho do pedido ${String(order?.code || order?.id || '')}` },
  });

  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.on('error', reject);
  });
  doc.pipe(stream);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const pageLeft = 18;
  const contentWidth = pageWidth - 36;
  const pageRight = pageLeft + contentWidth;
  const pageBottom = pageHeight - 39;
  const headerTop = 63;
  const headerDividerY = 137;
  const headerBottom = 267;
  const tableTop = 284;

  const entity = order?.entity || {};
  const client = order?.client || {};
  const clientAddress = client?.address && typeof client.address === 'object' ? client.address : {};
  const customerName = firstValue(order?.customerName, client?.name, client?.companyName);
  const customerDoc = normalizeDoc(firstValue(client?.doc, client?.cnpj, order?.customerDoc));
  const customerCode = firstValue(order?.customerCode, client?.code, client?.customerCode);
  const customerOrder = firstValue(
    order?.customerOrderCode,
    order?.customerOrderNumber,
    order?.clientOrderNumber,
    order?.clientOrderCode,
    order?.purchaseOrderNumber,
    order?.customerReference,
  );
  const companyName = firstValue(entity?.name) || 'CARTONIFICIO VALINHOS S/A';
  const isCartonificio = /cartonif[ií]cio\s+valinhos/i.test(companyName);
  const website = firstValue(entity?.website, entity?.site, isCartonificio ? 'www.cartonificiovalinhos.com.br' : '');
  const orderCode = firstValue(order?.code, order?.id) || '-';
  const orderDate = fmtDate(order?.orderDate);
  const implementationDate = fmtDate(order?.implementationDate || order?.createdAt || order?.orderDate);
  const deliveryDate = fmtDate(order?.deliveryDate);
  const paymentTerms = firstValue(order?.paymentTerms, order?.paymentCondition?.description);
  const status = firstValue(order?.status);

  const logoModel = path.join(process.cwd(), 'public', 'icons', 'logo-espelho-pedido.png');
  const logoCurrent = path.join(process.cwd(), 'public', 'icons', 'logo cartonificio.png');

  type Align = 'left' | 'right' | 'center';
  type Column = { key: string; label: string; width: number; align: Align };
  // As 11 colunas seguem rigorosamente a sequencia do Word, com Preco/KG apos Peso.
  const columns: Column[] = [
    { key: 'sku', label: 'Item', width: 50, align: 'center' },
    { key: 'unit', label: 'Un', width: 22, align: 'center' },
    { key: 'description', label: 'Descrição do Material / Referencia', width: 118, align: 'center' },
    { key: 'quality', label: 'Qualid', width: 32, align: 'center' },
    { key: 'unitPrice', label: 'Preço Unit.', width: 44, align: 'right' },
    { key: 'quantity', label: 'Qtd.', width: 45, align: 'right' },
    { key: 'weight', label: 'Peso', width: 48, align: 'right' },
    { key: 'pricePerKg', label: 'Preço/KG', width: 48, align: 'right' },
    { key: 'total', label: 'Vl Total', width: 50, align: 'right' },
    { key: 'ipi', label: 'Vl. IPI', width: 39, align: 'right' },
    { key: 'delivery', label: 'Dt Entr', width: 63, align: 'center' },
  ];
  columns[2].width += contentWidth - columns.reduce((sum, col) => sum + col.width, 0);

  function text(
    value: unknown,
    x: number,
    y: number,
    width: number,
    options: { font?: string; size?: number; align?: Align; height?: number; color?: string } = {},
  ) {
    const { font = 'Times-Roman', size = 9.5, align = 'left', height = 13, color = '#111111' } = options;
    doc.font(font).fontSize(size).fillColor(color);
    doc.text(String(value ?? ''), x, y, {
      width,
      height,
      align,
      lineBreak: false,
      ellipsis: true,
    });
  }

  function line(x1: number, y1: number, x2: number, y2: number, width = 0.5) {
    doc.save().strokeColor('#242424').lineWidth(width).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
  }

  // Cada campo tem um bloco proprio: label alinhado a direita, seguido de ":",
  // e valor alinhado a esquerda na mesma linha. Limites impedem sobreposicao.
  type InfoColumn = 'left' | 'middle' | 'right';
  const infoColumns: Record<InfoColumn, { labelX: number; valueX: number; endX: number }> = {
    left: {
      labelX: pageLeft + 9,
      valueX: pageLeft + 101,
      endX: pageLeft + 204,
    },
    middle: {
      labelX: pageLeft + 210,
      valueX: pageLeft + 285,
      endX: pageLeft + 406,
    },
    right: {
      labelX: pageLeft + 410,
      valueX: pageLeft + 467,
      endX: pageRight - 7,
    },
  };

  function field(label: string, value: string, column: InfoColumn, y: number, endX?: number, valueSize = 9.2) {
    const slot = infoColumns[column];
    const normalizedLabel = label.endsWith(':') ? label : `${label}:`;
    text(normalizedLabel, slot.labelX, y, slot.valueX - slot.labelX - 4, {
      font: 'Times-Bold',
      size: 9.2,
      align: 'right',
    });
    text(value, slot.valueX, y, Math.max(1, (endX ?? slot.endX) - slot.valueX), {
      size: valueSize,
      align: 'left',
    });
  }

  function drawPageHeading() {
    doc.save().lineWidth(0.6).strokeColor('#242424')
      .rect(pageLeft, headerTop, contentWidth, headerBottom - headerTop).stroke().restore();
    line(pageLeft, headerDividerY, pageRight, headerDividerY);
    const splitX = pageLeft + contentWidth * 0.62;
    line(splitX, headerTop, splitX, headerDividerY);

    try {
      // O PNG preto foi extraido da imagem incorporada no proprio Word de referencia.
      doc.image(isCartonificio ? logoModel : logoCurrent, pageLeft + 6, headerTop + 3, {
        fit: [115, 65],
        align: 'center',
        valign: 'center',
      });
    } catch {
      try {
        doc.image(logoCurrent, pageLeft + 7, headerTop + 8, { fit: [75, 50] });
      } catch {
        // Sem imagem, os dados continuam visiveis.
      }
    }

    text(companyName.toUpperCase(), pageLeft + 133, headerTop + 18, splitX - pageLeft - 141, {
      font: 'Times-Bold',
      size: 10.6,
      align: 'center',
      height: 30,
    });
    text(website, pageLeft + 124, headerTop + 49, splitX - pageLeft - 130, {
      font: 'Times-Bold',
      size: 9.8,
      align: 'center',
    });

    text('PEDIDO DE VENDA', splitX + 4, headerTop + 4, pageRight - splitX - 8, {
      font: 'Times-Bold',
      size: 11.4,
    });
    text(`Pedido Nº: ${orderCode}`, splitX + 4, headerTop + 30, pageRight - splitX - 8, {
      font: 'Times-Bold',
      size: 11.3,
    });
    text(`Ped do Cliente: ${customerOrder}`, splitX + 4, headerTop + 45, pageRight - splitX - 8, {
      font: 'Times-Bold',
      size: 10.2,
    });
    if (status) {
      text(`Situação: ${status}`, splitX + 4, headerTop + 61, pageRight - splitX - 8, { size: 7.9 });
    }

    // Posicoes fixas em tres colunas: labels alinhados a direita dentro
    // do espaco reservado; valores a esquerda, com largura independente.
    const rowY = (index: number) => headerDividerY + 3 + index * 14;
    const fullRowEnd = pageRight - 7;
    const beforeRight = infoColumns.right.labelX - 7;
    const idLine = [customerCode, customerDoc].filter(Boolean).join(' - ');
    const customerLine = [idLine, customerName].filter(Boolean).join(' ');

    field('Cód.Cli/Nome', customerLine, 'left', rowY(0), fullRowEnd, 9.0);
    field(
      'Endereço',
      firstValue(
        order?.customerAddress,
        clientAddress?.street,
        client?.street,
        typeof client?.address === 'string' ? client.address : '',
        client?.addressLine1,
      ),
      'left',
      rowY(1),
      fullRowEnd,
    );
    field(
      'Bairro',
      firstValue(clientAddress?.neighborhood, client?.neighborhood, order?.customerNeighborhood),
      'left',
      rowY(2),
      fullRowEnd,
    );
    field('Estado', firstValue(clientAddress?.state, client?.state, client?.uf, order?.customerState), 'left', rowY(3));
    field('Cidade', firstValue(clientAddress?.city, client?.city, order?.customerCity), 'middle', rowY(3));
    field('Contato', firstValue(client?.contactName, order?.contactName, client?.contact), 'right', rowY(3), undefined, 8.5);
    field('Telefone', firstValue(client?.phone, client?.phoneNumber, order?.customerPhone), 'left', rowY(4));
    field(
      'CEP',
      firstValue(clientAddress?.zipCode, client?.zipCode, client?.postalCode, order?.customerZipCode),
      'middle',
      rowY(4),
      fullRowEnd,
    );
    field(
      'Nat.Operação',
      firstValue(order?.operationNature, order?.natureOfOperation, order?.operation?.description),
      'left',
      rowY(5),
      fullRowEnd,
    );
    field(
      'Cód.Repres',
      firstValue(
        order?.salesRepresentative?.name,
        order?.representative?.name,
        order?.representativeName,
        order?.sellerName,
      ),
      'left',
      rowY(6),
      beforeRight,
    );
    field('Operador', firstValue(order?.operatorName, order?.createdBy?.name, order?.user?.name), 'right', rowY(6), undefined, 8.5);
    field('Emissão', orderDate, 'left', rowY(7));
    field('Implantação', implementationDate, 'middle', rowY(7), fullRowEnd);
    field(
      'Transportador',
      firstValue(order?.carrier?.name, order?.transportCompany, order?.carrierName, order?.transporter),
      'left',
      rowY(8),
    );
    field('Cond.Pagto', paymentTerms, 'middle', rowY(8), fullRowEnd);
  }

  function tableGrid(y: number, height: number) {
    doc.save().strokeColor('#252525').lineWidth(0.45).rect(pageLeft, y, contentWidth, height).stroke().restore();
    let x = pageLeft;
    for (let i = 0; i < columns.length - 1; i++) {
      x += columns[i].width;
      line(x, y, x, y + height, 0.45);
    }
  }

  function drawTableHeader(y: number) {
    tableGrid(y, 15);
    let x = pageLeft;
    for (const col of columns) {
      text(col.label, x + 1.5, y + 4.1, col.width - 3, {
        font: 'Helvetica-Bold',
        size: col.key === 'description' ? 6.1 : 6.6,
        align: col.key === 'description' ? 'center' : col.align,
        height: 10,
      });
      x += col.width;
    }
  }

  function drawTableRow(y: number, values: Record<string, string>, height = 15, bold = false, secondaryDescription = '') {
    tableGrid(y, height);
    let x = pageLeft;
    for (const col of columns) {
      const value = values[col.key] || '';
      const contentY = y + (height === 15 ? 4 : 3);
      text(value, x + 1.8, contentY, col.width - 3.6, {
        font: bold ? 'Helvetica-Bold' : 'Helvetica',
        size: col.key === 'description' ? 6.5 : 6.6,
        align: col.align,
        height: 11,
      });
      if (col.key === 'description' && secondaryDescription) {
        text(secondaryDescription, x + 1.8, y + 12.5, col.width - 3.6, {
          font: 'Helvetica',
          size: 5.7,
          align: 'center',
          height: 8,
          color: '#444444',
        });
      }
      x += col.width;
    }
  }

  let y = tableTop;
  function startNewPage(withTableHeader = true) {
    doc.addPage();
    drawPageHeading();
    y = tableTop;
    if (withTableHeader) {
      drawTableHeader(y);
      y += 15;
    }
  }

  drawPageHeading();
  drawTableHeader(y);
  y += 15;

  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const groupedItems = new Map<string, any[]>();
  for (const item of items) {
    const name = familyName(item);
    if (!groupedItems.has(name)) groupedItems.set(name, []);
    groupedItems.get(name)!.push(item);
  }
  const groups = [...groupedItems.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const showGroups = groups.length > 1;

  let sumQuantity = 0;
  let sumWeight = 0;
  let sumTotal = 0;
  let sumGross = 0;
  let sumDiscount = 0;
  let sumIpi = 0;
  let hasIpi = false;

  for (const [name, groupItems] of groups) {
    if (showGroups) {
      if (y + 29 > pageBottom) startNewPage();
      doc.save().fillColor('#F4F4F4').rect(pageLeft, y, contentWidth, 13).fill().restore();
      tableGrid(y, 13);
      text(`FAMÍLIA: ${name}`, pageLeft + 5, y + 3, contentWidth - 10, {
        font: 'Helvetica-Bold',
        size: 7.5,
        height: 11,
      });
      y += 13;
    }
    for (const item of groupItems) {
      const calculated = calculateItem(item);
      sumQuantity += calculated.quantity;
      sumWeight += calculated.weight;
      sumTotal += calculated.total;
      sumGross += calculated.gross;
      sumDiscount += calculated.discount;
      if (calculated.ipiValue != null) {
        hasIpi = true;
        sumIpi += calculated.ipiValue;
      }

      const sku = firstValue(item?.sku, item?.inventoryItem?.sku, item?.inventoryItem?.code, item?.code);
      const unit = firstValue(item?.inventoryItem?.unit, item?.itemUnit, item?.unit) || '-';
      const quality = firstValue(item?.quality, item?.qualityCode, item?.inventoryItem?.quality);
      const itemDelivery = fmtDate(item?.itemDeliveryDate) || deliveryDate;
      const details = [
        calculated.unit === 'KG' && calculated.unitPricePerPiece > 0
          ? `Preço/PC: ${fmtDecimal(calculated.unitPricePerPiece, 4)}`
          : '',
        calculated.discountPct !== 0 ? `Desc.: ${fmtDecimal(calculated.discountPct)}%` : '',
      ].filter(Boolean).join('  |  ');
      const rowHeight = details ? 23 : 15;
      if (y + rowHeight > pageBottom) startNewPage();
      drawTableRow(y, {
        sku,
        unit,
        description: itemDescription(item),
        quality,
        unitPrice: fmtDecimal(calculated.unitPrice, 4),
        quantity: fmtDecimal(calculated.quantity, 4),
        weight: calculated.weight > 0 ? fmtDecimal(calculated.weight, 4) : '',
        pricePerKg: calculated.pricePerKg == null ? '' : fmtDecimal(calculated.pricePerKg, 4),
        total: fmtDecimal(calculated.total, 2),
        ipi: calculated.ipiValue == null ? '' : fmtDecimal(calculated.ipiValue, 2),
        delivery: itemDelivery,
      }, rowHeight, false, details);
      y += rowHeight;
    }
  }

  // Confirmacao, observacoes e assinatura aparecem somente ao final do pedido.
  // Aproximar o espaco livre do modelo Word (duas linhas vazias antes de TOTAL).
  const remarks = orderRemarks(order);
  const remarksWidth = contentWidth - 12;
  doc.font('Times-Roman').fontSize(10);
  const remarkHeight = remarks ? doc.heightOfString(remarks, { width: remarksWidth, lineGap: 2 }) : 0;
  const estimatedFooterHeight = 323 + Math.max(0, remarkHeight - 28);
  if (y + 15 + 18 + estimatedFooterHeight > pageBottom) startNewPage();
  for (let i = 0; i < 2; i++) {
    if (y + 15 + estimatedFooterHeight <= pageBottom) {
      drawTableRow(y, {});
      y += 15;
    }
  }
  if (y + 15 + 315 > pageBottom) startNewPage();

  drawTableRow(y, {
    description: 'TOTAL',
    quantity: fmtDecimal(sumQuantity, 4),
    weight: fmtDecimal(sumWeight, 4),
    // Media ponderada: soma do Vl Total / soma dos pesos.
    pricePerKg: sumWeight > 0 ? fmtDecimal(sumTotal / sumWeight, 4) : '',
    total: fmtDecimal(sumTotal, 2),
    ipi: hasIpi ? fmtDecimal(sumIpi, 2) : '',
  }, 15, true);
  y += 15;

  // Contexto preservado do renderer antigo: os descontos continuam abatidos
  // de Vl Total. Quando existem descontos, informa-se o valor sem criar coluna.
  if (sumDiscount !== 0) {
    text(`Subtotal: R$ ${fmtDecimal(sumGross)}  |  Descontos: R$ ${fmtDecimal(sumDiscount)}`, pageLeft + 5, y + 3, contentWidth - 10, {
      font: 'Helvetica',
      size: 6.7,
      height: 10,
      color: '#444444',
    });
    y += 12;
  }

  y += 18;
  function ensureRoom(height: number, withTableHeader = false) {
    if (y + height > pageBottom) startNewPage(withTableHeader);
  }

  ensureRoom(89);
  text('Confirmação de Pedido: Embalagens de Papelão Ondulado', pageLeft + 24, y, contentWidth - 48, {
    font: 'Times-Bold',
    size: 10.7,
    height: 16,
  });
  y += 29;
  text('Prezado Cliente:', pageLeft + 24, y, contentWidth - 48, { size: 10.7, height: 16 });
  y += 26;
  const confirmationText = 'É com satisfação que confirmamos o pedido, estando de acordo favor confirmar por e-mail. Não sendo confirmado, consideramos o pedido como aceito.';
  doc.font('Times-Roman').fontSize(10.7);
  const textHeight = doc.heightOfString(confirmationText, { width: contentWidth - 48, lineGap: 2 });
  ensureRoom(textHeight + 15);
  doc.fillColor('#111111').text(confirmationText, pageLeft + 24, y, {
    width: contentWidth - 48,
    lineGap: 2,
  });
  y += textHeight + 18;

  /** Desenha os quadros do Word; anotacoes extensas continuam em novas paginas. */
  function drawTextBox(title: string, fullText: string, minimumHeight: number) {
    let remaining = fullText.replace(/\r\n?/g, '\n').trim();
    let partIndex = 0;
    do {
      ensureRoom(Math.min(minimumHeight, 70));
      const maxContentHeight = pageBottom - y - 28;
      const width = contentWidth - 10;
      let part = remaining;
      doc.font('Times-Roman').fontSize(10);
      const heightOf = (value: string) =>
        value ? doc.heightOfString(value, { width, lineGap: 1.5 }) : 0;
      if (heightOf(part) > maxContentHeight) {
        // Dividir nas quebras de palavra, preservando todo o conteudo.
        let low = 1;
        let high = remaining.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (heightOf(remaining.slice(0, mid)) <= maxContentHeight) low = mid;
          else high = mid - 1;
        }
        const split = remaining.lastIndexOf(' ', low);
        const splitAt = split > 0 ? split : Math.max(1, low);
        part = remaining.slice(0, splitAt).trimEnd();
      }
      const naturalHeight = heightOf(part) + 25;
      const boxHeight = Math.max(partIndex === 0 ? minimumHeight : 40, naturalHeight);
      doc.save().lineWidth(0.55).strokeColor('#252525')
        .rect(pageLeft, y, contentWidth, boxHeight).stroke().restore();
      line(pageLeft, y + 16, pageRight, y + 16);
      text(`${title}${partIndex ? ' (continuação)' : ''}`, pageLeft + 4, y + 2, contentWidth - 8, {
        font: title === 'Observação:' ? 'Times-Bold' : 'Times-Roman',
        size: 10.7,
      });
      if (part) {
        doc.fillColor('#111111').font('Times-Roman').fontSize(10)
          .text(part, pageLeft + 4, y + 20, { width, lineGap: 1.5 });
      }
      y += boxHeight + 13;
      remaining = remaining.slice(part.length).trimStart();
      partIndex++;
      if (remaining) startNewPage(false);
    } while (remaining);
  }

  drawTextBox('Observação do Pedido:', remarks, 67);
  const generalNotes = [
    '1º - Considerar pedido atendido, aquela cuja quantidade for inferior ou superior a 10% da quantidade solicitada.',
    '2º - No preço acima está incluso, ICMS conforme legislação em cada estado.',
    '',
    'Atenciosamente,',
    '',
    'Cartonifício Valinhos',
    '',
    'Área Comercial: vendas.caixas@cartonificiovalinhos.com.br ou pedidos.caixas@cartonificiovalinhos.com.br',
  ].join('\n');
  drawTextBox('Observação:', generalNotes, 142);

  // PDFKit bufferPages permite numerar corretamente mesmo em pedidos de varias paginas.
  const pages = doc.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index++) {
    doc.switchToPage(index);
    text(`Pag: ${index - pages.start + 1} de ${pages.count}`, pageLeft + 24, 49, 130, { size: 10.5 });
  }

  doc.end();
  return await done;
}
