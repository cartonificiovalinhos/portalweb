import nodemailer from 'nodemailer';
import { prisma } from './prisma';

export async function sendEmail(options: { to: string; subject: string; html: string }) {
  // Fetch SMTP settings
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: { in: ['senderEmail', 'smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpSsl', 'smtpTls'] }
    }
  });

  const config: Record<string, string> = {};
  settings.forEach(s => config[s.key] = s.value);

  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    console.log('[Email] SMTP não configurado. Simulando envio:');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Content: ${options.html}`);
    return false;
  }

  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: Number(config.smtpPort) || 587,
    secure: config.smtpSsl === 'true',
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    const info = await transport.sendMail({
      from: config.senderEmail || config.smtpUser,
      to: options.to,
      subject: options.subject,
      html: options.html
    });
    console.log('[Email] Enviado:', info.messageId);
    return true;
  } catch (err) {
    console.error('[Email] Erro ao enviar:', err);
    throw err;
  }
}

export async function sendOrderStatusChangeNotification(params: { orderId: number; status: string }) {
  const orderId = Number(params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) return;

  const status = String(params.status ?? '').trim();
  if (!status) return;

  const order = await prisma.salesOrder.findUnique({
    where: { id: Math.trunc(orderId) },
    select: {
      id: true,
      code: true,
      status: true,
      orderDate: true,
      customerName: true,
      customerDoc: true,
      total: true,
      clientId: true,
      client: { select: { name: true, doc: true } },
      items: {
        select: {
          sku: true,
          name: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          discountPct: true,
        },
      },
    },
  });
  if (!order?.clientId) return;

  const contacts = await prisma.clientContact.findMany({
    where: {
      clientId: order.clientId,
      email: { not: null },
      statuses: { some: { status } },
    },
    select: {
      id: true,
      description: true,
      email: true,
    },
  });
  if (!contacts.length) return;

  const subj = `Pedido ${order.code || order.id} • Status: ${status}`;
  const title = `Pedido ${order.code || order.id} atualizado para "${status}"`;
  const clientName = order.client?.name || order.customerName || '';
  const clientDoc = (order.client?.doc || order.customerDoc || '').replace(/\D+/g, '');

  const itemsHtml = (order.items || [])
    .map((it) => {
      const sku = String(it.sku || '').trim();
      const name = String(it.name || '').trim();
      const qty = Number(it.quantity || 0);
      const unit = String(it.unit || '').trim();
      const unitPrice = Number(it.unitPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const disc = Number(it.discountPct || 0);
      return `<tr>
        <td style="padding:6px 8px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif;font-size:12px;">${sku || '-'}</td>
        <td style="padding:6px 8px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif;font-size:12px;">${name || '-'}</td>
        <td style="padding:6px 8px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif;font-size:12px;text-align:right;">${qty}</td>
        <td style="padding:6px 8px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif;font-size:12px;">${unit || '-'}</td>
        <td style="padding:6px 8px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif;font-size:12px;text-align:right;">${unitPrice}</td>
        <td style="padding:6px 8px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif;font-size:12px;text-align:right;">${disc.toFixed(2)}%</td>
      </tr>`;
    })
    .join('');

  const orderDate = order.orderDate ? new Date(order.orderDate).toLocaleDateString('pt-BR') : '-';
  const total = Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:14px;font-weight:700;margin-bottom:8px;">${title}</div>
      <div style="font-size:12px;color:#333;margin-bottom:12px;">
        <div><b>Cliente:</b> ${clientName || '-'}</div>
        <div><b>CPF/CNPJ:</b> ${clientDoc || '-'}</div>
        <div><b>Data:</b> ${orderDate}</div>
        <div><b>Total:</b> ${total}</div>
      </div>
      <div style="font-size:12px;font-weight:700;margin-bottom:6px;">Itens</div>
      <table style="border-collapse:collapse;width:100%;max-width:900px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;background:#f6f6f6;font-size:12px;">SKU</th>
            <th style="text-align:left;padding:6px 8px;background:#f6f6f6;font-size:12px;">Descrição</th>
            <th style="text-align:right;padding:6px 8px;background:#f6f6f6;font-size:12px;">Qtd</th>
            <th style="text-align:left;padding:6px 8px;background:#f6f6f6;font-size:12px;">UN</th>
            <th style="text-align:right;padding:6px 8px;background:#f6f6f6;font-size:12px;">Preço</th>
            <th style="text-align:right;padding:6px 8px;background:#f6f6f6;font-size:12px;">Desc</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || `<tr><td colspan="6" style="padding:8px;border-top:1px solid #eee;font-size:12px;color:#666;">Sem itens</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  for (const c of contacts) {
    const to = String(c.email || '').trim();
    if (!to) continue;
    try {
      await sendEmail({ to, subject: subj, html });
    } catch (err) {
      console.error('[Email] Falha ao notificar contato:', { contactId: c.id, to, err });
    }
  }
}
