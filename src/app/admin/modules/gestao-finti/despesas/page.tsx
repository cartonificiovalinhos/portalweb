import Link from "next/link";
import { Plus } from "lucide-react";
import { ExpenseTable } from "@/components/modules/gestao-finti/despesas/ExpenseTable";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const expenses = await prisma.gestaoFintiDespesa.findMany({
    include: {
      categoria: true,
      fornecedor: true,
      centroCusto: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6 p-3">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Despesas</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/modules/gestao-finti/despesas/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Despesa
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <ExpenseTable expenses={expenses as any} />
      </div>
    </div>
  );
}
