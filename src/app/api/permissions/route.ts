import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const uid = session?.user ? Number((session.user as any).id) : undefined;
    let activeEntityId = (session as any)?.entityId ?? (session as any)?.activeEntityId ?? null;
    if (activeEntityId) activeEntityId = Number(activeEntityId);
    if (!uid) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    // Entidades do usuário (usar Prisma para evitar incompatibilidades de SQL)
    const entities = await prisma.entity.findMany({
      where: { isActive: true, userEntities: { some: { userId: uid } } },
      select: { id: true, cnpj: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Módulos e programas permitidos na entidade ativa
    const modules: any[] = [];
    if (activeEntityId) {
      const entityModules = await prisma.entityModule.findMany({
        where: {
          entityId: activeEntityId,
          module: { isActive: true }
        },
        include: {
          module: true
        },
        orderBy: {
          module: { name: 'asc' }
        }
      });

      for (const em of entityModules) {
        const mod = em.module;
        
        const uemRows = await prisma
          .$queryRawUnsafe<any[]>(
            `SELECT uem.id as id, uem.allowed as allowed
             FROM userentitymodule uem
             JOIN userentity ue ON ue.id = uem.userEntityId
             WHERE ue.userId = ? AND ue.entityId = ? AND uem.moduleId = ? AND uem.id IS NOT NULL
             ORDER BY uem.id DESC
             LIMIT 1`,
            uid,
            activeEntityId,
            mod.id,
          )
          .catch(() => []);
        const userEntityModuleAllowedRaw = uemRows?.[0]?.allowed;
        const userEntityModuleAllowed = userEntityModuleAllowedRaw === null || userEntityModuleAllowedRaw === undefined ? null : Boolean(userEntityModuleAllowedRaw);
        if (userEntityModuleAllowed === false) continue;
        const userEntityModuleId = uemRows?.[0]?.id ? Number(uemRows[0].id) : null;
        const hasUserEntityModuleId = Boolean(userEntityModuleId && Number.isFinite(userEntityModuleId));

        // 3. Buscar programas do módulo (Program)
        // Devem estar ativos, showInMenu=true, e permitidos na entidade (EntityModuleProgram)
        const allPrograms = await prisma.program.findMany({
          where: {
            moduleId: mod.id,
            isActive: true,
            showInMenu: true
          },
          orderBy: { name: 'asc' }
        });

        const allowedPrograms: any[] = [];

        const programIds = allPrograms.map((p) => p.id);
        const empRows = programIds.length
          ? await prisma
              .$queryRawUnsafe<any[]>(
                `SELECT programId, allowed
                 FROM entitymoduleprogram
                 WHERE entityModuleId = ? AND programId IN (${programIds.map(() => '?').join(',')})`,
                em.id,
                ...programIds,
              )
              .catch(() => [])
          : [];
        const entityAllowedByProgramId = new Map<number, boolean>();
        for (const r of empRows || []) {
          const pid = r?.programId;
          const allowed = r?.allowed;
          const pNum = pid === null || pid === undefined ? NaN : Number(pid);
          if (!Number.isFinite(pNum)) continue;
          entityAllowedByProgramId.set(Math.trunc(pNum), Boolean(allowed));
        }

        const userAllowedByProgramId = new Map<number, boolean>();
        if (hasUserEntityModuleId && programIds.length) {
          const uempRows = await prisma
            .$queryRawUnsafe<any[]>(
              `SELECT t.programId as programId, t.allowed as allowed
               FROM userentitymoduleprogram t
               JOIN (
                 SELECT programId, MAX(id) as maxId
                 FROM userentitymoduleprogram
                 WHERE userEntityModuleId = ? AND id IS NOT NULL AND programId IN (${programIds.map(() => '?').join(',')})
                 GROUP BY programId
               ) x ON x.maxId = t.id`,
              userEntityModuleId,
              ...programIds,
            )
            .catch(() => []);
          for (const r of uempRows || []) {
            const pid = r?.programId;
            const allowed = r?.allowed;
            const pNum = pid === null || pid === undefined ? NaN : Number(pid);
            if (!Number.isFinite(pNum)) continue;
            const key = Math.trunc(pNum);
            userAllowedByProgramId.set(key, Boolean(allowed));
          }
        }

        for (const prog of allPrograms) {
          const isEntityAllowed = entityAllowedByProgramId.has(prog.id) ? Boolean(entityAllowedByProgramId.get(prog.id)) : true;
          if (!isEntityAllowed) continue;

          const isUserAllowed = hasUserEntityModuleId ? (userAllowedByProgramId.has(prog.id) ? Boolean(userAllowedByProgramId.get(prog.id)) : true) : true;
          if (isUserAllowed) {
            allowedPrograms.push({
              id: prog.id,
              code: prog.code,
              name: prog.name
            });
          }
        }

        if (allowedPrograms.length > 0) {
          modules.push({
            id: mod.id,
            code: mod.code,
            name: mod.name,
            programs: allowedPrograms
          });
        }
      }
    }

    return NextResponse.json({ activeEntityId, entities, modules });
  } catch (err: any) {
    console.error("Permissions API Error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
