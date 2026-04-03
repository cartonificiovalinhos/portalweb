import { ExpenseBarChart, ExpensePieChart } from "@/components/modules/gestao-finti/analise/ExpenseChart";
import { getChartData, getDashboardData } from "@/app/admin/modules/gestao-finti/analise/actions";
import { formatCurrency } from "@/app/admin/modules/gestao-finti/utils";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const { categoryData: pieData, barData } = await getChartData();
  const { totalFixed, totalMonth, annualProjection } = await getDashboardData();

  const fixedPercentage = totalMonth > 0 ? ((totalFixed / totalMonth) * 100).toFixed(1) : "0.0";
  const variablePercentage = totalMonth > 0 ? (100 - Number(fixedPercentage)).toFixed(1) : "0.0";

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">Análise Estratégica</h1>

      {/* Strategic Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Custo Mensal Total</h3>
          <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(totalMonth)}</p>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-blue-600 font-medium">{fixedPercentage}% Fixo</span>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-purple-600 font-medium">{variablePercentage}% Variável</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Projeção Anual</h3>
          <p className="mt-2 text-3xl font-bold text-slate-900">{formatCurrency(annualProjection)}</p>
          <p className="mt-2 text-sm text-slate-500">Estimado com base no mês atual</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Média Semestral</h3>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {formatCurrency(
              barData.reduce((acc, curr) => acc + (Number(curr.fixed) + Number(curr.occasional)), 0) / (barData.length || 1)
            )}
          </p>
          <p className="mt-2 text-sm text-slate-500">Baseado nos últimos 6 meses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold mb-4 text-slate-800">Composição de Gastos (Mês Atual)</h2>
          <ExpensePieChart data={pieData} />
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold mb-4 text-slate-800">Evolução Semestral</h2>
          <ExpenseBarChart data={barData} />
        </div>
      </div>
    </div>
  );
}
