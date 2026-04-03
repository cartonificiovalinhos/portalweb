import { prisma } from "@/lib/prisma";
import { ExpenseForm } from "@/components/modules/gestao-finti/despesas/ExpenseForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const [categories, suppliers, costCenters] = await Promise.all([
    prisma.gestaoFintiCategoria.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    prisma.gestaoFintiFornecedor.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    prisma.gestaoFintiCentroCusto.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
  ]);

  return (
    <div className="space-y-6 p-3 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
            href="/admin/modules/gestao-finti/despesas"
            className="p-2 hover:bg-slate-100 rounded-full text-slate-600"
        >
            <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Nova Despesa</h1>
      </div>

      <ExpenseForm 
        categories={categories}
        suppliers={suppliers}
        costCenters={costCenters}
      />
    </div>
  );
}
