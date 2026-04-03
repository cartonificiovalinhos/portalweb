import { prisma } from "@/lib/prisma";
import { SettingsTabs } from "@/components/modules/gestao-finti/configuracoes/SettingsTabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [categories, suppliers, costCenters] = await Promise.all([
    prisma.gestaoFintiCategoria.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    prisma.gestaoFintiFornecedor.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    prisma.gestaoFintiCentroCusto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
  ]);

  return (
    <div className="space-y-6 p-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Gerencie categorias, fornecedores e centros de custo.
        </p>
      </div>

      <SettingsTabs 
        categories={categories}
        suppliers={suppliers}
        costCenters={costCenters}
      />
    </div>
  );
}
