import { prisma } from "../lib/prisma";
import DashboardCards from "../components/DashboardCards";
import DashboardCharts from "../components/DashboardCharts";
import DashboardTabs from "../components/DashboardTabs";
import { getServerSession } from "next-auth";
import { authOptions } from "../lib/auth";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const uid = session?.user ? Number((session.user as any).id) : null;
  const activeEntityId = (session as any)?.entityId ? Number((session as any).entityId) : ((session as any)?.activeEntityId ? Number((session as any).activeEntityId) : null);

  let modules: Array<{ id: number; code: string; name: string }> = [];

  if (uid && activeEntityId) {
    const rows = await prisma
      .$queryRawUnsafe<any[]>(
        `SELECT DISTINCT m.id, m.code, m.name
         FROM module m
         JOIN entitymodule em ON em.moduleId = m.id AND em.entityId = ?
         JOIN userentity ue ON ue.userId = ? AND ue.entityId = ?
         JOIN userentitymodule uem ON uem.userEntityId = ue.id AND uem.moduleId = m.id AND uem.allowed = 1 AND uem.id IS NOT NULL
         WHERE m.showDashboardTab = 1 AND m.isActive = 1
         ORDER BY m.name ASC`,
        Math.trunc(activeEntityId),
        Math.trunc(uid),
        Math.trunc(activeEntityId),
      )
      .catch(() => []);

    modules = (rows || [])
      .map((r) => ({
        id: Number(r?.id),
        code: String(r?.code || ''),
        name: String(r?.name || ''),
      }))
      .filter((m) => Number.isFinite(m.id) && m.id > 0 && m.code && m.name);
  }

  return (
    <div className="space-y-4">
      <DashboardTabs 
        modules={modules} 
        maintenanceContent={
          <div className="space-y-6">
            <DashboardCards />
            <DashboardCharts />
          </div>
        } 
      />
    </div>
  );
}
