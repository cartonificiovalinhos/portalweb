"use client";
import { useEffect, useState } from "react";

type Metrics = {
  workOrders: number;
  open: number;
  inProgress: number;
  completed: number;
  assets: number;
  inventoryItems: number;
};

export default function DashboardCards() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const safeFetch = (url: string) =>
      fetch(url)
        .then(async (r) => {
          if (!r.ok) {
            const txt = await r.text().catch(() => "");
            throw new Error(txt || `HTTP ${r.status}`);
          }
          const txt = await r.text().catch(() => "");
          if (!txt) return [];
          try {
            return JSON.parse(txt);
          } catch {
            return [];
          }
        });

    Promise.all([
      safeFetch("/api/work-orders"),
      safeFetch("/api/assets"),
      safeFetch("/api/items"),
    ])
      .then(([wo, assets, inventory]) => {
        const workOrders = Array.isArray(wo) ? wo : [];
        const assetsArr = Array.isArray(assets) ? assets : [];
        const inventoryArr = Array.isArray(inventory) ? inventory : [];

        const open = workOrders.filter((w: any) => w.status === "OPEN").length;
        const inProgress = workOrders.filter((w: any) => w.status === "IN_PROGRESS").length;
        const completed = workOrders.filter((w: any) => w.status === "COMPLETED" || w.status === "CLOSED").length;
        setMetrics({
          workOrders: workOrders.length,
          open,
          inProgress,
          completed,
          assets: assetsArr.length,
          inventoryItems: inventoryArr.length,
        });
      })
      .catch((err) => {
        console.warn("Falha ao carregar métricas do dashboard:", err);
        setMetrics({
          workOrders: 0,
          open: 0,
          inProgress: 0,
          completed: 0,
          assets: 0,
          inventoryItems: 0,
        });
      });
  }, []);

  const Card = ({ title, value, accent }: { title: string; value: number | string; accent?: string }) => (
    <div className="bg-white shadow rounded p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent ?? ""}`}>{value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card title="OS totais" value={metrics?.workOrders ?? "-"} />
      <Card title="OS abertas" value={metrics?.open ?? "-"} accent="text-orange-600" />
      <Card title="OS em andamento" value={metrics?.inProgress ?? "-"} accent="text-blue-600" />
      <Card title="OS concluídas/encerradas" value={metrics?.completed ?? "-"} accent="text-green-600" />
      <Card title="Ativos" value={metrics?.assets ?? "-"} />
      <Card title="Itens em estoque" value={metrics?.inventoryItems ?? "-"} />
    </div>
  );
}
