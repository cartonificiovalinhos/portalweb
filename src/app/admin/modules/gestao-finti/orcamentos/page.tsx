import { getCategories, getBudgets } from "@/app/admin/modules/gestao-finti/orcamentos/actions";
import { BudgetForm } from "@/components/modules/gestao-finti/orcamentos/BudgetForm";

export const dynamic = "force-dynamic";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const year = params.year ? parseInt(params.year) : today.getFullYear();
  const month = params.month ? parseInt(params.month) : today.getMonth() + 1;

  const [categories, budgets] = await Promise.all([
    getCategories(),
    getBudgets(year, month),
  ]);

  // Convert budgets to match form interface
  const formattedBudgets = budgets.map((b) => ({
    categoryId: b.categoriaId,
    amount: Number(b.valorPlanejado)
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Orçamento Planejado
        </h1>
        <p className="text-slate-500">
          Defina o orçamento previsto para cada categoria no período.
        </p>
      </div>

      <BudgetForm 
        categories={categories} 
        initialBudgets={formattedBudgets} 
        year={year} 
        month={month} 
      />
    </div>
  );
}
