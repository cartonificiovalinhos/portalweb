"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, Loader2, RefreshCw, X } from "lucide-react";

type PanelTab = "commercial" | "supplies" | "finance";
type PanelStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

type PanelItem = {
  id: number;
  status: string;
  statusLabel: string;
  createdAtLabel: string;
  approvedAtLabel: string | null;
  moduleCode: string;
  moduleLabel: string;
  entityName: string;
  entityLabel: string;
  actionName: string;
  actionLabel: string;
  entityKey: string;
  rootEntityName: string;
  rootEntityKey: string;
  canAct: boolean;
  document: {
    id: number;
    description: string;
    erpId: string | null;
  };
  type: {
    id: number;
    name: string;
    description: string | null;
  };
  field: {
    id: number;
    label: string;
    fieldType: string;
    sourceType: string;
    entityFieldKey: string | null;
    matchedValueLabel: string;
    rangeFromLabel: string;
    rangeToLabel: string;
  };
  order: {
    id: number;
    code: string;
    customerName: string;
    status: string;
    erpOrderNumber: string | null;
    deliveryDateLabel: string;
    totalLabel: string;
    discountTotalLabel: string;
  } | null;
  item: {
    id: number;
    sku: string | null;
    name: string;
    quantityLabel: string;
    unitPriceLabel: string;
    discountPctLabel: string;
    lineTotalLabel: string;
    deliveryDateLabel: string;
  } | null;
};

const TAB_OPTIONS: Array<{ value: PanelTab; label: string }> = [
  { value: "commercial", label: "Comercial" },
  { value: "supplies", label: "Suprimentos" },
  { value: "finance", label: "Financeiro" },
];

const STATUS_OPTIONS: Array<{ value: PanelStatus; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "PENDING", label: "Pendente" },
  { value: "APPROVED", label: "Aprovada" },
  { value: "REJECTED", label: "Reprovada" },
];

function statusTone(status: string) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

function ActionIconButton({
  title,
  onClick,
  disabled,
  tone,
  children,
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded border text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        tone || "border-gray-200 text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[180px_1fr]">
      <div className="text-sm font-medium text-gray-600">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

export default function ApprovalPanelClient() {
  const [tab, setTab] = useState<PanelTab>("commercial");
  const [status, setStatus] = useState<PanelStatus>("ALL");
  const [items, setItems] = useState<PanelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PanelItem | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/approval-panel?tab=${tab}&status=${status}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err: any) {
      setError(err?.message || String(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, tab]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const countsByStatus = useMemo(() => {
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const item of items) {
      const key = String(item.status || "").trim().toUpperCase();
      if (key === "PENDING" || key === "APPROVED" || key === "REJECTED") {
        counts[key] += 1;
      }
    }
    return counts;
  }, [items]);

  const handleApprovalAction = useCallback(
    async (item: PanelItem, action: "approve" | "reject") => {
      if (!item.canAct) return;
      if (action === "reject" && !window.confirm("Confirma reprovar esta aprovação?")) return;

      setActingId(item.id);
      setError(null);
      try {
        const res = await fetch(`/api/sales/orders/${item.rootEntityKey}/commercial-approval`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
        await loadItems();
        setSelectedItem((prev) => (prev?.id === item.id ? null : prev));
      } catch (err: any) {
        setError(err?.message || String(err));
      } finally {
        setActingId(null);
      }
    },
    [loadItems],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Aprovação Eletrônica</h1>
        <p className="text-sm text-gray-500">Consulte as aprovações em que você participou, filtre por situação e aja sobre as pendências mais recentes.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        {TAB_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`px-3 py-2 text-sm ${tab === option.value ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-600"}`}
            onClick={() => setTab(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="rounded border bg-white p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Situação</label>
              <select
                className="min-w-[180px] rounded border px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as PanelStatus)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                className="inline-flex h-[42px] items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={loadItems}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">Pendentes: {countsByStatus.PENDING}</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">Aprovadas: {countsByStatus.APPROVED}</span>
            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-700">Reprovadas: {countsByStatus.REJECTED}</span>
          </div>
        </div>

        {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Documento</th>
                <th className="px-3 py-2 text-left">Tipo / Campo</th>
                <th className="px-3 py-2 text-left">Dados da aprovação</th>
                <th className="px-3 py-2 text-left">Situação</th>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium">{item.document.description}</div>
                    <div className="text-xs text-gray-500">{item.document.erpId ? `ERP ${item.document.erpId}` : "Sem ID ERP"}</div>
                    <div className="mt-1 text-xs text-gray-500">{item.moduleLabel}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{item.type.description || item.type.name}</div>
                    <div className="text-xs text-gray-500">{item.field.label} • {item.field.fieldType}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      Faixa: {item.field.rangeFromLabel} até {item.field.rangeToLabel}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium">
                      {item.order ? `Pedido ${item.order.code}` : `${item.entityLabel} ${item.entityKey}`}
                    </div>
                    {item.order && <div className="text-xs text-gray-500">Cliente: {item.order.customerName}</div>}
                    {item.item && (
                      <div className="text-xs text-gray-500">
                        Item: {item.item.sku ? `${item.item.sku} • ` : ""}{item.item.name}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-500">
                      {item.entityLabel} / {item.actionLabel}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Valor encontrado: {item.field.matchedValueLabel}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full border px-2 py-1 text-xs ${statusTone(item.status)}`}>{item.statusLabel}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm">{item.createdAtLabel}</div>
                    {item.approvedAtLabel && <div className="text-xs text-gray-500">Conclusão: {item.approvedAtLabel}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <ActionIconButton
                        title="Aprovar"
                        tone="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleApprovalAction(item, "approve")}
                        disabled={!item.canAct || actingId === item.id}
                      >
                        {actingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </ActionIconButton>
                      <ActionIconButton
                        title="Reprovar"
                        tone="border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => handleApprovalAction(item, "reject")}
                        disabled={!item.canAct || actingId === item.id}
                      >
                        {actingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </ActionIconButton>
                      <ActionIconButton
                        title="Detalhes"
                        tone="border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => setSelectedItem(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </ActionIconButton>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    Nenhuma aprovação encontrada para os filtros informados.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando aprovações...
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded border bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold">Detalhes da Aprovação</h2>
                <p className="text-sm text-gray-500">{selectedItem.document.description}</p>
              </div>
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => setSelectedItem(null)}
              >
                Fechar
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded border bg-gray-50 p-3">
                  <h3 className="font-medium">Resumo</h3>
                  <DetailRow label="Situação" value={<span className={`rounded-full border px-2 py-1 text-xs ${statusTone(selectedItem.status)}`}>{selectedItem.statusLabel}</span>} />
                  <DetailRow label="Módulo" value={selectedItem.moduleLabel} />
                  <DetailRow label="Entidade / Ação" value={`${selectedItem.entityLabel} / ${selectedItem.actionLabel}`} />
                  <DetailRow label="Tipo" value={selectedItem.type.description || selectedItem.type.name} />
                  <DetailRow label="Campo" value={selectedItem.field.label} />
                </div>

                <div className="space-y-3 rounded border bg-gray-50 p-3">
                  <h3 className="font-medium">Faixa e valor</h3>
                  <DetailRow label="De" value={selectedItem.field.rangeFromLabel} />
                  <DetailRow label="Até" value={selectedItem.field.rangeToLabel} />
                  <DetailRow label="Valor encontrado" value={selectedItem.field.matchedValueLabel} />
                  <DetailRow label="Criada em" value={selectedItem.createdAtLabel} />
                  <DetailRow label="Concluída em" value={selectedItem.approvedAtLabel || "-"} />
                </div>
              </div>

              {selectedItem.order && (
                <div className="space-y-3 rounded border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-medium">Pedido relacionado</h3>
                    <Link
                      href={`/sales/orders/${selectedItem.order.id}`}
                      className="rounded border border-blue-200 bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      Abrir pedido
                    </Link>
                  </div>
                  <DetailRow label="Número do pedido" value={selectedItem.order.code} />
                  <DetailRow label="Cliente" value={selectedItem.order.customerName} />
                  <DetailRow label="Status do pedido" value={selectedItem.order.status} />
                  <DetailRow label="Pedido ERP" value={selectedItem.order.erpOrderNumber || "-"} />
                  <DetailRow label="Entrega" value={selectedItem.order.deliveryDateLabel} />
                  <DetailRow label="Desconto total" value={selectedItem.order.discountTotalLabel} />
                  <DetailRow label="Total" value={selectedItem.order.totalLabel} />
                </div>
              )}

              {selectedItem.item && (
                <div className="space-y-3 rounded border p-3">
                  <h3 className="font-medium">Item relacionado</h3>
                  <DetailRow label="SKU" value={selectedItem.item.sku || "-"} />
                  <DetailRow label="Descrição" value={selectedItem.item.name} />
                  <DetailRow label="Quantidade" value={selectedItem.item.quantityLabel} />
                  <DetailRow label="Preço unitário" value={selectedItem.item.unitPriceLabel} />
                  <DetailRow label="Desconto %" value={selectedItem.item.discountPctLabel} />
                  <DetailRow label="Total do item" value={selectedItem.item.lineTotalLabel} />
                  <DetailRow label="Entrega do item" value={selectedItem.item.deliveryDateLabel} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
