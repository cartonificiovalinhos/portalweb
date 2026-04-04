import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { differenceInMinutes } from 'date-fns';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = Number(params.id);
  const wo = await prisma.workOrder.findUnique({ where: { id }, include: { asset: true, attachments: true } });
  return NextResponse.json(wo);
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = Number(params.id);
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  const userId = session?.user ? Number((session.user as any).id) : undefined;
  const body = await request.json();
  const action = body.action as string | undefined;

  // Use current WO for calculations when needed
  const current = await prisma.workOrder.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });

  // If an action is provided, handle workflow actions
  if (action) {
    // Restrict execution to assigned technician when applicable
    if (role === 'TECH') {
      const assignedUserId = (current as any)?.assignedUserId as number | null | undefined;
      if (!userId || assignedUserId !== userId) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
      }
    }

    if (action === 'start') {
      const updated = await prisma.workOrder.update({
        where: { id },
        data: { startedAt: new Date(), status: 'IN_PROGRESS' },
      });
      return NextResponse.json(updated);
    }

    if (action === 'complete') {
      const completedAtStr = body.completedAt as string | undefined;
      const usedEquipment = body.usedEquipment ?? null;
      const maintainedComponents = body.maintainedComponents ?? null;
      const executionDescription = body.executionDescription ?? null;
      const observations = body.observations ?? null;
      const technicianSignature = body.technicianSignature ?? null;

      const completedAt = completedAtStr ? new Date(completedAtStr) : new Date();
      const startedAt = (current as any)?.startedAt as Date | null | undefined;
      const mttr = startedAt ? differenceInMinutes(completedAt, startedAt) : null;
      const updated = await prisma.workOrder.update({
        where: { id },
        data: ({
          completedAt,
          status: 'COMPLETED',
          mttr,
          usedEquipment,
          maintainedComponents,
          executionDescription,
          observations,
          technicianSignature,
        } as any),
      });
      return NextResponse.json(updated);
    }

    if (action === 'close') {
      // Only Manager/Planner/Admin can close
      if (role === 'TECH' || role === 'REQUESTER') {
        return NextResponse.json({ error: 'Somente gestor/planejador pode encerrar' }, { status: 403 });
      }
      const closedAtStr = body.closedAt as string | undefined;
      const closedAt = closedAtStr ? new Date(closedAtStr) : new Date();

      // Compute MTTR if not already computed
      const startedAt = (current as any)?.startedAt as Date | null | undefined;
      const completedAtCur = (current as any)?.completedAt as Date | null | undefined;
      const mttr = startedAt && completedAtCur
        ? differenceInMinutes(completedAtCur, startedAt)
        : startedAt
          ? differenceInMinutes(closedAt, startedAt)
          : null;

      const updated = await prisma.workOrder.update({
        where: { id },
        data: { closedAt, status: 'CLOSED', mttr },
      });

      // Optional: consume inventory if provided
      const consume: Array<{ sku: string; qty: number }> | undefined = body.consume;
      if (consume && Array.isArray(consume)) {
        for (const c of consume) {
          if (!c?.sku || !c?.qty) continue;
          const item = await prisma.inventoryItem.findUnique({ where: { sku: c.sku } }).catch(() => null);
          if (!item) continue;
          const newQty = Math.max(0, (item.quantity ?? 0) - Number(c.qty));
          await prisma.inventoryItem.update({ where: { id: item.id }, data: { quantity: newQty } });
          const reorderPoint = (item as any).reorderPoint ?? item.minStock ?? 0;
          if (newQty <= reorderPoint) {
            await prisma.$executeRawUnsafe(
              'INSERT INTO "Notification" (type, message, role) VALUES (?, ?, ?)',
              'INVENTORY_REORDER',
              `SKU ${item.sku} atingiu ponto de ressuprimento (qty=${newQty} ≤ RP=${reorderPoint})`,
              'InventoryManager'
            );
          }
        }
      }
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  }

  // No action: generic update handler for UI edits and Kanban status moves
  const data = body;
  const updateData: any = { ...data };

  // Normalizar tasks: aceitar array de strings ou string simples
  if (Object.prototype.hasOwnProperty.call(updateData, 'tasks')) {
    const tasksVal = updateData.tasks;
    if (Array.isArray(tasksVal)) {
      const clean = tasksVal.map((t: any) => String(t).trim()).filter(Boolean);
      updateData.tasks = clean.length ? clean.join('\n') : null;
    } else if (typeof tasksVal === 'string') {
      const s = tasksVal.trim();
      updateData.tasks = s.length ? s : null;
    } else {
      updateData.tasks = null;
    }
  }
  // Normalize sector and maintenanceType empties to null
  if (data.sector !== undefined) updateData.sector = data.sector || null;
  if (data.maintenanceType !== undefined) updateData.maintenanceType = data.maintenanceType || null;
  // Parse scheduledAt string to Date or null
  if (data.scheduledAt !== undefined) {
    if (data.scheduledAt) {
      const d = new Date(data.scheduledAt);
      if (!Number.isNaN(d.getTime())) updateData.scheduledAt = d;
    } else {
      updateData.scheduledAt = null;
    }
  }
  // Support code updates if provided
  if (data.code !== undefined) updateData.code = data.code || null;
  if (data.status === 'IN_PROGRESS' && !data.startedAt) {
    updateData.startedAt = new Date();
  }
  if (data.status === 'COMPLETED' && !data.completedAt) {
    updateData.completedAt = new Date();
  }
  if (data.status === 'CLOSED') {
    const startedAt = (current as any)?.startedAt as Date | null | undefined;
    const completedAtCur = (current as any)?.completedAt as Date | null | undefined;
    if (startedAt && completedAtCur) {
      updateData.mttr = differenceInMinutes(completedAtCur, startedAt);
    }
    updateData.closedAt = new Date();
    // Optional inventory consumption
    const consume: Array<{ sku: string; qty: number }> | undefined = data.consume;
    if (consume && Array.isArray(consume)) {
      for (const c of consume) {
        if (!c?.sku || !c?.qty) continue;
        const item = await prisma.inventoryItem.findUnique({ where: { sku: c.sku } }).catch(() => null);
        if (!item) continue;
        const newQty = Math.max(0, (item.quantity ?? 0) - Number(c.qty));
        await prisma.inventoryItem.update({ where: { id: item.id }, data: { quantity: newQty } });
        const reorderPoint = (item as any).reorderPoint ?? item.minStock ?? 0;
        if (newQty <= reorderPoint) {
          await prisma.$executeRawUnsafe(
            'INSERT INTO "Notification" (type, message, role) VALUES (?, ?, ?)',
            'INVENTORY_REORDER',
            `SKU ${item.sku} atingiu ponto de ressuprimento (qty=${newQty} ≤ RP=${reorderPoint})`,
            'InventoryManager'
          );
        }
      }
    }
  }
  const updated = await prisma.workOrder.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}
