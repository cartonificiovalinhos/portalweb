import { prisma } from "@/lib/prisma";
import { PaymentTable } from "@/components/modules/gestao-finti/pagamentos/PaymentTable";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const payments = await prisma.gestaoFintiParcela.findMany({
    include: {
      despesa: {
        include: {
          categoria: true,
          fornecedor: true,
        }
      }
    },
    orderBy: { dataVencimento: 'asc' }
  });

  return (
    <div className="space-y-6 p-3">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">
          Pagamentos
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-100">
        <PaymentTable payments={payments as any} />
      </div>
    </div>
  );
}
