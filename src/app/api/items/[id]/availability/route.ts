import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

// GET: estrutura de disponibilidade do item por entidade/módulo
export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const itemId = Number(params.id);
    if (!itemId || Number.isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const entities = await prisma.entity.findMany({
      include: { entityModules: { include: { module: true, itemLinks: { where: { inventoryItemId: itemId } } } } },
      orderBy: { name: 'asc' }
    });
    const result = entities.map((e) => ({
      id: e.id,
      name: e.name,
      modules: e.entityModules.map((em: any) => ({
        entityModuleId: em.id,
        moduleId: em.module.id,
        moduleCode: em.module.code,
        moduleName: em.module.name,
        allowed: (em.itemLinks || []).some((l: any) => l.inventoryItemId === itemId && l.allowed),
      }))
    }));
    return NextResponse.json({ entities: result });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

  // POST: atualizar disponibilidade (permitir ou remover ligação)
  // body: { entityId?: number, moduleId?: number, entityModuleId?: number, allowed: boolean }
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const itemId = Number(params.id);
    if (!itemId || Number.isNaN(itemId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const body = await request.json();
    const entityId = body.entityId !== undefined ? Number(body.entityId) : undefined;
    const moduleId = body.moduleId !== undefined ? Number(body.moduleId) : undefined;
    const entityModuleId = body.entityModuleId !== undefined ? Number(body.entityModuleId) : undefined;
    const allowed = Boolean(body.allowed);
    let em: any = null;
    if (entityModuleId && Number.isFinite(entityModuleId)) {
      em = await prisma.entityModule.findUnique({ where: { id: entityModuleId } });
    } else if (entityId && moduleId) {
      // findFirst é mais tolerante em alguns setups de introspecção
      em = await prisma.entityModule.findFirst({ where: { entityId, moduleId } });
    }
    if (!em) return NextResponse.json({ error: 'EntityModule não encontrado' }, { status: 404 });
    if (allowed) {
      const link = await prisma.entityModuleItem.upsert({
        where: { entityModuleId_inventoryItemId: { entityModuleId: em.id, inventoryItemId: itemId } },
        update: { allowed: true },
        create: { entityModuleId: em.id, inventoryItemId: itemId, allowed: true },
      });
      return NextResponse.json(link);
    } else {
      const existing = await prisma.entityModuleItem.findUnique({
        where: { entityModuleId_inventoryItemId: { entityModuleId: em.id, inventoryItemId: itemId } }
      }).catch(() => null);
      if (existing) {
        await prisma.entityModuleItem.delete({ where: { id: existing.id } });
      }
      return NextResponse.json({ ok: true });
    }
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}