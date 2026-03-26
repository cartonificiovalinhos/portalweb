"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SalesOrderItemRow, supportsSheetDims, supportsCoreDims } from "../components/SalesOrderItemRow";

type InventoryItem = {
  id: number;
  sku?: string | null;
  name: string;
  unit?: string | null;
  commercialFamily?: { id: number; description?: string | null; name?: string | null; priceBy?: string | null } | null;
  unitPrice?: number | null;
  width?: number | null;
  length?: number | null;
  grammage?: number | null;
};

type OrderItem = {
  id: number;
  name: string;
  sku?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  width?: number | null;
  length?: number | null;
  grammage?: number | null;
  diameter?: number | null;
  tube?: number | null;
  inventoryItem?: InventoryItem | null;
  creases?: Record<string, number> | null;
  clientOrderNumber?: string | null;
  clientOrderItemNumber?: number | null;
  itemDeliveryDate?: string | Date | null;
  internalResin?: boolean;
  externalResin?: boolean;
};

type SalesOrder = {
  id: number;
  code: string;
  status: string;
  orderDate: string;
  customerName: string;
  customerDoc?: string | null;
  clientId?: number | null;
  paymentTerms?: string | null;
  deliveryDate?: string | null;
  notes?: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  items?: OrderItem[];
  entity?: { name: string; cnpj: string } | null;
  lastTaxSimulation?: string | null;
  totalWithTax?: number;
  totalInvoiced?: number;
  erpOrderNumber?: string | null;
  triangularCustomerName?: string | null;
  triangularCustomerDoc?: string | null;
};

type SalesOrderInvoice = {
  id: number;
  invoiceNumber: string;
  issueDate: string;
  totalValue: number;
  totalWeight: number;
  danfeFileName?: string | null;
  xmlFileName?: string | null;
};

const ICON_BTN = "inline-flex items-center justify-center w-8 h-8 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-gray-700";

const isDeletableStatus = (status?: string) => {
  const s = (status || '').trim().toUpperCase();
  return s === 'OPEN' || s === 'ORÇAMENTO' || s === 'ORCAMENTO' || s.includes('ERRO') || s.includes('ERROR');
};

const isEditableStatus = isDeletableStatus;

const minChars = 1;

// SalesOrderItemRow component replaced by import

const AsyncSelect = ({ 
  label, 
  value, 
  onChange, 
  onSelectObj,
  fetchUrl, 
  placeholder,
  renderOption,
  getLabel,
  onBlur
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void;
  onSelectObj?: (obj: any) => void;
  fetchUrl: (q: string) => string; 
  placeholder?: string;
  renderOption: (item: any) => React.ReactNode;
  getLabel: (item: any) => string;
  onBlur?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<any[]>([]);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (q: string) => {
    onChange(q);
    if (q.length < minChars) { setOpts([]); return; }
    try {
      const res = await fetch(fetchUrl(q));
      if (res.ok) {
        const data = await res.json();
        setOpts(Array.isArray(data) ? data : []);
        setOpen(true);
      }
    } catch { }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <span className="text-gray-600">{label}</span>
      <input 
        className="mt-1 w-full px-2 py-1 border rounded" 
        value={value} 
        onChange={(e) => handleSearch(e.target.value)}
        onBlur={onBlur}
        onFocus={() => { 
           if (value.length >= minChars && opts.length === 0) {
             handleSearch(value);
           }
           setOpen(true); 
        }}
        placeholder={placeholder}
      />
      {open && opts.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border rounded shadow-lg max-h-60 overflow-auto mt-1">
          {opts.map((item, idx) => (
            <li 
              key={idx} 
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
              onClick={() => {
                const txt = getLabel(item);
                onChange(txt);
                if (onSelectObj) onSelectObj(item);
                setOpen(false);
              }}
            >
              {renderOption(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

function familyName(it: OrderItem): string {
  const cf: any = it.inventoryItem?.commercialFamily;
  let fam = String(cf?.description || cf?.name || '').trim();
  if (!fam) {
    const name = (it.name || '').toUpperCase();
    if (name.includes('CHAPA') || name.includes('CHAPAS')) fam = 'CHAPAS';
    else if (name.includes('MIOL')) fam = 'MIOLO';
    else fam = 'Outras famílias';
  }
  return fam.toUpperCase();
}

// Helpers moved to shared component


function statusChipStyle(s?: string): string {
  const v = (s || '').trim();
  switch (v) {
    case 'Orçamento':
    case 'OPEN':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    case 'Aguardando Integração':
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    case 'Integrado':
      return 'bg-blue-100 text-blue-800 border border-blue-300';
    case 'Erro na integração':
      return 'bg-red-100 text-red-800 border border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-300';
  }
}

function statusLabelPt(s?: string): string {
  const v = (s || '').trim().toUpperCase();
  switch (v) {
    case 'OPEN':
      return 'Orçamento';
    case 'AGUARDANDO INTEGRAÇÃO':
    case 'AGUARDANDO INTEGRACAO':
    case 'AWAITING INTEGRATION':
      return 'Aguardando Integração';
    case 'INTEGRADO':
    case 'INTEGRATED':
      return 'Integrado';
    case 'ERRO NA INTEGRAÇÃO':
    case 'ERRO NA INTEGRACAO':
    case 'INTEGRATION ERROR':
      return 'Erro na integração';
    case 'EM FILA PRODUÇÃO':
    case 'EM FILA PRODUCAO':
      return 'Em fila produção';
    case 'EM PRODUÇÃO':
    case 'EM PRODUCAO':
      return 'Em produção';
    case 'PRODUZIDO/ESTOCADO':
      return 'Produzido/Estocado';
    case 'FATURADO':
      return 'Faturado';
    case 'CANCELADO':
      return 'Cancelado';
    default:
      return s || '—';
  }
}

function translateHistoryMessageLabel(m: string): string {
  const raw = String(m ?? '');
  const trimmed = raw.trimStart();
  const prefixMatch = trimmed.match(/^([A-Z_]+)\s*:\s*/i);
  if (!prefixMatch) return raw;
  const prefixRaw = String(prefixMatch[1] || '').trim().toUpperCase();
  let translated = prefixRaw;
  if (prefixRaw === 'ERROR') translated = 'ERRO';
  else if (prefixRaw === 'INFORMATION' || prefixRaw === 'INFO') translated = 'INFORMAÇÃO';
  else if (prefixRaw === 'WARNING' || prefixRaw === 'WARN') translated = 'AVISO';
  if (translated === prefixRaw) return raw;
  const startIdx = raw.indexOf(prefixMatch[1] as string);
  if (startIdx < 0) return raw;
  const afterPrefixIdx = startIdx + (prefixMatch[1] as string).length;
  const rest = raw.slice(afterPrefixIdx);
  return raw.slice(0, startIdx) + translated + rest;
}

export default function SalesOrderMaintenancePage() {
  const params = useParams() as any;
  const id = Number(params.id);
  const router = useRouter();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFeaturesFor, setShowFeaturesFor] = useState<number | null>(null);
  const [hdrDraft, setHdrDraft] = useState<{ paymentTerms?: string; deliveryDate?: string; customerName?: string; customerDoc?: string; triangularCustomerName?: string; triangularCustomerDoc?: string }>({});
  const [hdrCustomerId, setHdrCustomerId] = useState<number | null>(null);
  const [isHeaderEditing, setIsHeaderEditing] = useState(false);
  const [addingItems, setAddingItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [integrating, setIntegrating] = useState(false);
  const [checkingEdit, setCheckingEdit] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Billing History
  const [showBilling, setShowBilling] = useState(false);
  const [invoices, setInvoices] = useState<SalesOrderInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const loadInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const res = await fetch(`/api/sales/orders/${id}/invoices`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSimulateTaxes = async () => {
    if (!order) return;
    setSimulating(true);
    try {
      const res = await fetch(`/api/sales/orders/${order.id}/simulate-tax`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        if (err.payloadSent) {
           console.error('Payload falha simulação:', err.payloadSent);
           alert(`Erro: ${err.error}\n\nVeja o console (F12) para o JSON completo.\n\nInicio do JSON:\n${JSON.stringify(err.payloadSent).substring(0, 500)}...`);
           return;
        }
        throw new Error(err.error || 'Erro na simulação');
      }
      const data = await res.json();
      console.log('Simulation result:', data);
      
      if (data && data.vltotcomimp !== undefined) {
         await refreshOrder();
      } else if (data && data.RowErrors && Array.isArray(data.RowErrors)) {
         const errors = data.RowErrors.map((e: any) => `- ${e.ErrorDescription || 'Erro desconhecido'}`).join('\n');
         alert(`Erros retornados pelo ERP:\n\n${errors}`);
      } else {
         // Fallback check if it is nested in items or somewhere else?
         // For now assume root level as per prompt "retorno do campo 'vltotcomimp'"
         alert('Campo vltotcomimp não encontrado no retorno da API. Verifique o console.');
      }
    } catch (e: any) {
      alert(e.message || String(e));
    } finally {
      setSimulating(false);
    }
  };

  const searchClientItems = async (term: string) => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('q', term);
      if (order?.customerDoc) {
        params.set('customerDoc', order.customerDoc);
      } else if (order?.customerName) {
        params.set('customerName', order.customerName);
      }
      
      const res = await fetch(`/api/items?${params.toString()}`);
      if (res.ok) {
        let data = await res.json();
        
        const lower = term.toLowerCase();
        data = data.filter((it: any) => 
          it.name.toLowerCase().includes(lower) || 
          (it.sku && it.sku.toLowerCase().includes(lower))
        );
        
        setSearchResults(data.slice(0, 20));
      }
    } catch (e) {
      console.error(e);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const addItemToOrder = async (item: InventoryItem) => {
    if (!order) return;
    try {
      const payload = {
        orderId: order.id,
        inventoryItemId: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        quantity: 1,
        unitPrice: item.unitPrice ?? 0,
        discountPct: 0,
        width: item.width,
        length: item.length,
        grammage: item.grammage
      };
      
      const res = await fetch('/api/sales/orders/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Falha ao adicionar item');
      
      setAddingItems(false);
      setSearchTerm('');
      await refreshOrder();
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!Number.isFinite(id)) {
        setError('ID do pedido inválido na URL');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      try {
        const res = await fetch(`/api/sales/orders/${id}`, { cache: 'no-store', signal: controller.signal });

        if (!res.ok) {
          let msg = `Falha ao carregar pedido (HTTP ${res.status})`;
          try {
            const body = await res.json();
            if (body && typeof body.error === 'string') {
              msg = body.error;
            }
          } catch {
          }
          setError(msg);
          setOrder(null);
          setOrderItems([]);
          return;
        }

        const data: SalesOrder = await res.json();
        setOrder(data);
        setOrderItems(data.items || []);
        setHdrCustomerId((data as any)?.clientId != null ? Number((data as any).clientId) : null);
        setHdrDraft({
          paymentTerms: data.paymentTerms || '',
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate).toISOString().slice(0, 10) : '',
          customerName: data.customerName || '',
          customerDoc: data.customerDoc || '',
          triangularCustomerName: data.triangularCustomerName || '',
          triangularCustomerDoc: data.triangularCustomerDoc || ''
        });

        if (((data as any)?.clientId == null) && data.customerDoc) {
          try {
            const docDigits = String(data.customerDoc || '').replace(/\D+/g, '');
            if (docDigits) {
              const cRes = await fetch(`/api/base/clients?q=${encodeURIComponent(docDigits)}`);
              const cArr = await cRes.json();
              if (Array.isArray(cArr)) {
                const match = cArr.find((x: any) => String(x?.doc || '').replace(/\D+/g, '') === docDigits) || cArr[0];
                if (match?.id) setHdrCustomerId(Number(match.id));
              }
            }
          } catch {}
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          setError('Tempo limite ao carregar o pedido. Tente novamente.');
        } else {
          setError(e?.message || String(e));
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const fmtCurrency = (n: number | undefined) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtNumber = (n: number | undefined) => (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number | undefined) => Math.round(n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

  const computeWeightKg = (it: OrderItem): number => {
    // Aplicar fórmula para itens que têm medidas de chapa
    const hasDims = supportsSheetDims(it);
    if (hasDims) {
      const w = it.width ?? 0; // mm
      const l = it.length ?? 0; // mm
      const g = it.grammage ?? 0; // g/m2
      const q = it.quantity ?? 0;
      if (w > 0 && l > 0 && g > 0 && q > 0) {
        const areaM2 = (l / 1000) * (w / 1000);
        const weightKg = (areaM2 * g * q) / 1000; // g → kg
        return weightKg;
      }
    }
    return 0;
  };

  const familyPriceBy = (it: OrderItem): 'UNIT' | 'WEIGHT' => {
    const pb = String(it.inventoryItem?.commercialFamily?.priceBy || '').trim().toUpperCase();
    return pb === 'WEIGHT' || pb === 'PESO' ? 'WEIGHT' : 'UNIT';
  };

  const lineBase = (it: OrderItem): number => {
    const qty = it.quantity ?? 0;
    const price = it.unitPrice ?? 0;
    if (familyPriceBy(it) === 'WEIGHT') return computeWeightKg(it) * price;
    return qty * price;
  };

  const saveHeader = async (partial: { paymentTerms?: string; deliveryDate?: string; customerName?: string; customerDoc?: string; triangularCustomerName?: string; triangularCustomerDoc?: string; clientId?: number | null }) => {
    if (!order) return;

    // Validate items: Sum of creases vs Width
    for (let i = 0; i < orderItems.length; i++) {
      const it = orderItems[i];
      const w = it.width || 0;
      if (w > 0) {
        const creases = it.creases || {};
        let sum = 0;
        for (let k = 1; k <= 8; k++) {
          sum += (Number(creases[k]) || 0);
        }
        
        if (sum > w) {
          alert(`A soma dos vincos está maior que a largura informada no item número ${i + 1}`);
          return;
        }
      }
    }

    try {
      const res = await fetch(`/api/sales/orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(partial) });
      if (!res.ok) throw new Error('Falha ao salvar cabeçalho');
      const updated: SalesOrder = await res.json();
      setOrder(updated);
      setHdrCustomerId((updated as any)?.clientId != null ? Number((updated as any).clientId) : hdrCustomerId);
      setHdrDraft({
        paymentTerms: updated.paymentTerms || '',
        deliveryDate: updated.deliveryDate ? new Date(updated.deliveryDate).toISOString().slice(0,10) : '',
        customerName: updated.customerName || '',
        customerDoc: updated.customerDoc || '',
        triangularCustomerName: updated.triangularCustomerName || '',
        triangularCustomerDoc: updated.triangularCustomerDoc || ''
      });
      setIsHeaderEditing(false);
    } catch (e: any) { alert(e?.message || String(e)); }
  };

  const refreshOrder = async () => {
    const r = await fetch(`/api/sales/orders/${id}`, { cache: 'no-store' });
    const data = await r.json();
    setOrder(data);
    setOrderItems(data.items || []);
  };

  const globalItems = orderItems;
  const globalSubtotal = globalItems.reduce((s, it) => s + lineBase(it), 0);
  const globalDiscount = globalItems.reduce((s, it) => s + (lineBase(it) * (it.discountPct / 100)), 0);
  const globalTotalNoTax = globalSubtotal - globalDiscount;
  const globalWeight = globalItems.reduce((s, it) => s + Math.round(computeWeightKg(it)), 0);

  const groups = useMemo(() => {
    const out = new Map<string, OrderItem[]>();
    for (const it of orderItems) {
      const key = familyName(it);
      const arr = out.get(key) || [];
      arr.push(it);
      out.set(key, arr);
    }
    return Array.from(out.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orderItems]);

  // Removed startEdit, cancelEdit, saveEdit


  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Manutenção de Pedidos</h1>
          {order && (
            <span className={`text-xs px-2 py-1 rounded ${statusChipStyle(statusLabelPt(order.status))}`}>
              {statusLabelPt(order.status)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <a href="/sales/orders/new" className="px-3 py-2 border rounded bg-white hover:bg-gray-50" title="Novo Pedido" aria-label="Novo Pedido">
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11 11V4h2v7h7v2h-7v7h-2v-7H4v-2h7Z"/></svg>
              Novo Pedido
            </span>
          </a>
          <button className="px-3 py-2 border rounded" title="Voltar" aria-label="Voltar" onClick={() => router.back()}>
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z"/></svg>
              Voltar
            </span>
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-600">Carregando…</div>}
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      {order && (
        <div className="space-y-6">
          {/* Header do pedido com ícones à direita */}
          <div className="border rounded bg-white p-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-3 flex-1">
                {/* Linha Superior: Número, Data, Entidade, Última Simulação */}
                <div className="flex flex-wrap items-center gap-8">
                  <div>
                    <span className="text-gray-600">Número</span>
                    <div className="font-mono mt-1">{order.code}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Pedido ERP</span>
                    <div className="font-mono mt-1 text-blue-600">{order.erpOrderNumber || '-'}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Data</span>
                    <div className="mt-1">{new Date(order.orderDate).toLocaleDateString('pt-BR')}</div>
                  </div>
                  {order.entity && (
                    <div>
                      <span className="text-gray-600">Entidade</span>
                      <div className="mt-1 font-medium">{order.entity.name}</div>
                    </div>
                  )}
                  {order.lastTaxSimulation && (
                     <div className="ml-auto">
                       <span className="text-gray-600">Última simulação</span>
                       <div className="mt-1">
                         {new Date(order.lastTaxSimulation).toLocaleDateString('pt-BR')} - {new Date(order.lastTaxSimulation).toLocaleTimeString('pt-BR')}
                       </div>
                     </div>
                  )}
                </div>

                {/* Linha de Inputs: Cliente, Pagamento, Entrega */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-2">
                  <div className={`md:col-span-6 ${!isHeaderEditing || (order.items && order.items.length > 0) || !['OPEN', 'Orçamento'].includes(order.status || '') ? "opacity-75 pointer-events-none" : ""}`}>
                     <AsyncSelect
                        label="Cliente"
                        value={hdrDraft.customerName ?? ''}
                        onChange={(val) => setHdrDraft((d) => ({ ...d, customerName: val }))}
                        onSelectObj={(item) => {
                           setHdrDraft((d) => ({ ...d, customerName: item.name, customerDoc: item.doc }));
                           setHdrCustomerId(Number(item.id));
                           (async () => {
                             try {
                               const ptRes = await fetch(`/api/base/payment-terms?clientId=${Number(item.id)}`);
                               const ptData = await ptRes.json();
                               const list = Array.isArray(ptData) ? ptData : [];
                               const first = list[0];
                               if (first?.description) {
                                 const newVal = first.code != null ? `[${first.code}] ${first.description}` : String(first.description);
                                 setHdrDraft((d) => ({ ...d, paymentTerms: newVal }));
                               }
                             } catch {}
                           })();
                        }}
                        fetchUrl={(q) => `/api/base/clients?q=${q}`}
                        placeholder="Pesquise por nome ou documento"
                        getLabel={(item) => item.name}
                        renderOption={(item) => (
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.doc}</div>
                          </div>
                        )}
                      />
                  </div>
                  <div className={`md:col-span-3 ${!isHeaderEditing ? "opacity-75 pointer-events-none" : ""}`}>
                    <AsyncSelect
                      label="Condição de pagamento"
                      value={hdrDraft.paymentTerms ?? ''}
                      onChange={(val) => setHdrDraft((d) => ({ ...d, paymentTerms: val }))}
                      onSelectObj={(item) => {
                         const newVal = `[${item.code}] ${item.description}`;
                         setHdrDraft((d) => ({ ...d, paymentTerms: newVal }));
                      }}
                      fetchUrl={(q) => `/api/base/payment-terms?clientId=${hdrCustomerId ? String(hdrCustomerId) : '0'}&q=${q}`}
                      placeholder="Digite código ou descrição"
                      getLabel={(item) => `[${item.code}] ${item.description}`}
                      renderOption={(item) => (
                        <div>
                          <div className="font-medium">{item.description}</div>
                          <div className="text-xs text-gray-500">Código: {item.code} | Parcelas: {item.installments}</div>
                        </div>
                      )}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <span className="text-gray-600">Entrega</span>
                    <input type="date" className="mt-1 w-full px-2 py-1 border rounded" value={hdrDraft.deliveryDate ?? ''} onChange={(e) => setHdrDraft((d) => ({ ...d, deliveryDate: e.target.value }))} disabled={!isHeaderEditing} />
                  </div>
                  <div className={`md:col-span-6 ${!isHeaderEditing ? "opacity-75 pointer-events-none" : ""}`}>
                     <AsyncSelect
                        label="Cliente Remessa Triangular"
                        value={hdrDraft.triangularCustomerName ?? ''}
                        onChange={(val) => setHdrDraft((d) => ({ ...d, triangularCustomerName: val }))}
                        onSelectObj={(item) => {
                           setHdrDraft((d) => ({ ...d, triangularCustomerName: item.name, triangularCustomerDoc: item.doc }));
                        }}
                        fetchUrl={(q) => `/api/base/clients?q=${q}`}
                        placeholder="Pesquise por nome ou documento"
                        getLabel={(item) => item.name}
                        renderOption={(item) => (
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.doc}</div>
                          </div>
                        )}
                      />
                  </div>
                </div>

                {/* Totais */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                  <div>
                    <span className="text-gray-600">Total Sem Imp R$</span>
                    <div className="mt-1 w-full px-2 py-1 border rounded bg-gray-50 text-gray-800">{fmtCurrency(globalTotalNoTax)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Com Imp R$</span>
                    <div className="mt-1 w-full px-2 py-1 border rounded bg-yellow-100 text-gray-800 font-bold">{fmtCurrency(order.totalWithTax ?? 0)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Peso (KG)</span>
                    <div className="mt-1 w-full px-2 py-1 border rounded bg-gray-50 text-gray-800">{fmtInt(globalWeight)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Fat. R$</span>
                    <div className="mt-1 w-full px-2 py-1 border rounded bg-blue-50 text-gray-800 font-medium" title="Atualizado via ERP">{fmtCurrency(order.totalInvoiced ?? 0)}</div>
                  </div>
                </div>
              </div>
              <div className="ml-auto flex gap-2">
                <button 
                  className={`flex items-center gap-1 px-3 py-1 text-sm bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-gray-700 ${!isEditableStatus(order?.status) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={handleSimulateTaxes}
                  disabled={simulating || !isEditableStatus(order?.status)}
                >
                  {simulating ? 'Simulando...' : 'Simular Impostos'}
                </button>

                <button className={`${ICON_BTN} ${integrating || !isEditableStatus(order?.status) || isHeaderEditing ? 'opacity-50 cursor-not-allowed' : ''}`} title="Enviar para ERP" aria-label="Enviar para ERP" disabled={integrating || !isEditableStatus(order?.status) || isHeaderEditing} style={{ opacity: integrating || !isEditableStatus(order?.status) || isHeaderEditing ? 0.5 : 1, pointerEvents: integrating || !isEditableStatus(order?.status) || isHeaderEditing ? 'none' : 'auto' }} onClick={async () => {
                  if (!order) return;
                  if (!confirm('Confirma enviar este pedido para o ERP?')) return;
                  setIntegrating(true);
                  try {
                    const res = await fetch(`/api/sales/orders/${order.id}/integrate`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' }
                    });
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || 'Falha ao enviar para ERP');
                    }
                    const data = await res.json();
                    
                    if (data.newStatus === 'Erro na integração') {
                        alert('Houve erros na integração. Verifique o histórico de situação.');
                    } else if (data.newStatus === 'Integrado') {
                        alert('Pedido integrado com sucesso!');
                    } else {
                        alert('Envio realizado. Verifique o status atual.');
                    }

                    await refreshOrder();
                  } catch (e: any) { 
                      alert(e?.message || String(e)); 
                  } finally {
                      setIntegrating(false);
                  }
                }}>
                  {integrating ? (
                      <svg className="animate-spin h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                  ) : (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  )}
                </button>
                <button className={`${ICON_BTN} ${!isDeletableStatus(order?.status) || isHeaderEditing ? 'opacity-50 cursor-not-allowed' : ''}`} title="Excluir" aria-label="Excluir" disabled={!isDeletableStatus(order?.status) || isHeaderEditing} style={{ opacity: !isDeletableStatus(order?.status) || isHeaderEditing ? 0.5 : 1, pointerEvents: !isDeletableStatus(order?.status) || isHeaderEditing ? 'none' : 'auto' }} onClick={async () => { if (!order) return; if (!confirm('Confirma excluir este pedido?')) return; const r = await fetch(`/api/sales/orders/${order.id}`, { method: 'DELETE' }); if (r.ok) router.push('/sales/orders'); }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                {isHeaderEditing ? (
                  <>
                    <button className="inline-flex items-center justify-center w-8 h-8 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-green-600" title="Salvar" aria-label="Salvar" onClick={() => saveHeader({ paymentTerms: hdrDraft.paymentTerms, deliveryDate: hdrDraft.deliveryDate, customerName: hdrDraft.customerName, customerDoc: hdrDraft.customerDoc, triangularCustomerName: hdrDraft.triangularCustomerName, triangularCustomerDoc: hdrDraft.triangularCustomerDoc, clientId: hdrCustomerId })}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z"/></svg>
                    </button>
                    <button className="inline-flex items-center justify-center w-8 h-8 bg-red-50 border border-red-200 rounded shadow-sm hover:bg-red-100 text-red-600" title="Cancelar" aria-label="Cancelar" onClick={() => { setIsHeaderEditing(false); setHdrCustomerId((order as any)?.clientId != null ? Number((order as any).clientId) : hdrCustomerId); setHdrDraft({ paymentTerms: order.paymentTerms || '', deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().slice(0,10) : '', customerName: order.customerName || '', customerDoc: order.customerDoc || '', triangularCustomerName: order.triangularCustomerName || '', triangularCustomerDoc: order.triangularCustomerDoc || '' }); }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.41 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29 10.59 10.59 16.89 4.29l1.41 1.42Z"/></svg>
                    </button>
                  </>
                ) : (
                  <button 
                    className={`${ICON_BTN} ${(!isEditableStatus(order?.status) && statusLabelPt(order?.status) !== 'Integrado') || checkingEdit ? 'opacity-50 cursor-not-allowed' : ''}`} 
                    title="Editar" 
                    aria-label="Editar" 
                    disabled={(!isEditableStatus(order?.status) && statusLabelPt(order?.status) !== 'Integrado') || checkingEdit} 
                    onClick={async () => {
                        const status = statusLabelPt(order?.status);
                        if (status === 'Integrado') {
                            setCheckingEdit(true);
                            try {
                                const res = await fetch(`/api/sales/orders/${order!.id}/integrate`, {
                                    method: 'POST', 
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ resource: 'checkPedidoExiste' })
                                });
                                if (!res.ok) {
                                    const err = await res.json();
                                    throw new Error(err.error || 'Falha na verificação');
                                }
                                const data = await res.json();
                                
                                let errorSubType = null;
                                let errorDescription = null;
                                
                                const findError = (obj: any) => {
                                    if (obj && typeof obj === 'object') {
                                        if (obj.ErrorSubType) return { type: obj.ErrorSubType, desc: obj.ErrorDescription };
                                    }
                                    return null;
                                };
                                
                                if (Array.isArray(data)) {
                                    for (const item of data) {
                                        const found = findError(item);
                                        if (found) { errorSubType = found.type; errorDescription = found.desc; break; }
                                    }
                                } else {
                                    const found = findError(data);
                                    if (found) { 
                                        errorSubType = found.type; errorDescription = found.desc; 
                                    } else if (data.RowErrors && Array.isArray(data.RowErrors)) {
                                        for (const item of data.RowErrors) {
                                            const f = findError(item);
                                            if (f) { errorSubType = f.type; errorDescription = f.desc; break; }
                                        }
                                    }
                                }
                                
                                if (errorSubType === 'INFORMATION') {
                                    const patchRes = await fetch(`/api/sales/orders/${order!.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: 'Orçamento' })
                                    });
                                    if (!patchRes.ok) throw new Error('Falha ao reverter status para Orçamento');
                                    await refreshOrder();
                                    setIsHeaderEditing(true);
                                } else {
                                    alert(errorDescription || 'Erro: Não foi possível verificar a edição do pedido (ErrorSubType inválido ou ausente).');
                                }
                            } catch (e: any) {
                                alert(e.message || String(e));
                            } finally {
                                setCheckingEdit(false);
                            }
                        } else {
                            setIsHeaderEditing(true);
                        }
                    }}
                  >
                    {checkingEdit ? (
                        <svg className="animate-spin h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Histórico de situação */}
          <div className="border rounded bg-white">
            <div className="px-3 py-2 border-b flex items-center gap-2">
              <span className="text-sm text-gray-700">Histórico de situação</span>
              <button
                className={ICON_BTN}
                title={showHistory ? 'Ocultar histórico' : 'Mostrar histórico'}
                aria-label={showHistory ? 'Ocultar histórico' : 'Mostrar histórico'}
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 10l5 5 5-5H7z"/></svg>
                )}
              </button>
              <button className="ml-auto px-2 py-1 text-xs border rounded bg-white hover:bg-gray-100" onClick={refreshOrder}>Atualizar</button>
            </div>
            {showHistory && (
              <div className="p-3 space-y-3">
                {(order as any)?.statusHistory?.map((h: any) => (
                  <div key={h.id} className="border rounded p-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${statusChipStyle(statusLabelPt(h.status))}`}>{statusLabelPt(h.status)}</span>
                      <span className="text-xs text-gray-600">{new Date(h.changedAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-800 space-y-1">
                      {(h.messages || []).map((m: any, idx: number) => (
                        <div key={idx}>{translateHistoryMessageLabel(String(m))}</div>
                      ))}
                    </div>
                  </div>
                ))}
                {!(order as any)?.statusHistory?.length && (
                  <div className="text-xs text-gray-500">Sem registros de histórico.</div>
                )}
              </div>
            )}
          </div>

          {/* Histórico de Faturamento */}
          <div className="border rounded bg-white">
            <div className="px-3 py-2 border-b flex items-center gap-2">
              <span className="text-sm text-gray-700">Histórico de Faturamento</span>
              <button
                className={ICON_BTN}
                title={showBilling ? 'Ocultar faturamento' : 'Mostrar faturamento'}
                aria-label={showBilling ? 'Ocultar faturamento' : 'Mostrar faturamento'}
                onClick={() => {
                  const next = !showBilling;
                  setShowBilling(next);
                  if (next) loadInvoices();
                }}
              >
                {showBilling ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14l5-5 5 5H7z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 10l5 5 5-5H7z"/></svg>
                )}
              </button>
            </div>
            {showBilling && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Nr Nota Fiscal</th>
                      <th className="px-3 py-2 text-left">Data Emissão</th>
                      <th className="px-3 py-2 text-right">Vlr Tot Nota R$</th>
                      <th className="px-3 py-2 text-right">Peso Tot Nota Kg</th>
                      <th className="px-3 py-2 text-center">Opções</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingInvoices && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Carregando...</td></tr>}
                    {!loadingInvoices && invoices.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Nenhum faturamento registrado.</td></tr>}
                    {!loadingInvoices && invoices.map((inv) => (
                      <tr key={inv.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2">{new Date(inv.issueDate).toLocaleDateString('pt-BR')}</td>
                        <td className="px-3 py-2 text-right">{fmtCurrency(inv.totalValue)}</td>
                        <td className="px-3 py-2 text-right">{fmtNumber(inv.totalWeight)}</td>
                        <td className="px-3 py-2 text-center">
                           <div className="flex justify-center gap-2">
                             {inv.danfeFileName && (
                               <a 
                                 href={`/api/sales/orders/${id}/invoices/${inv.id}/download?type=danfe`} 
                                 target="_blank" 
                                 className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-100 text-blue-600"
                               >
                                 Baixar DANFE
                               </a>
                             )}
                             {inv.xmlFileName && (
                               <a 
                                 href={`/api/sales/orders/${id}/invoices/${inv.id}/download?type=xml`} 
                                 target="_blank" 
                                 className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-100 text-green-600"
                               >
                                 Baixar XML
                               </a>
                             )}
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Seção Itens + grupos por família */}
          <div className="border rounded bg-white">
            <div className="px-3 py-2 border-b flex items-center gap-2">
              <span className="text-sm text-gray-700">Itens</span>
              <button 
                className={`ml-auto px-2 py-1 text-xs border rounded bg-white hover:bg-gray-100 ${!isHeaderEditing ? 'opacity-50 cursor-not-allowed' : ''}`} 
                disabled={!isHeaderEditing} 
                onClick={() => { setAddingItems(true); searchClientItems(''); }}
              >
                Adicionar itens
              </button>
            </div>
            {addingItems && (
              <div className="p-3 border-b">
                <div className="flex items-center gap-2">
                  <input className="flex-1 px-2 py-1 border rounded" placeholder="Pesquisar itens do cliente" value={searchTerm} onChange={(e) => { const v = e.target.value; setSearchTerm(v); searchClientItems(v); }} />
                  <button className="px-2 py-1 text-xs border rounded" onClick={() => setAddingItems(false)}>Fechar</button>
                </div>
                <div className="mt-2">
                  {searchLoading && <div className="text-xs text-gray-500">Buscando…</div>}
                  {!searchLoading && searchResults.length === 0 && <div className="text-xs text-gray-500">Nenhum item vinculado ao cliente encontrado.</div>}
                  <ul className="divide-y max-h-60 overflow-auto">
                    {searchResults.map((it) => (
                      <li key={it.id} className="py-2 flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-2 rounded" onClick={() => addItemToOrder(it)}>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{it.name}</div>
                          <div className="text-xs text-gray-600">{it.sku || '-'} • {it.unit || '-'}</div>
                        </div>
                        <button className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); addItemToOrder(it); }}>Adicionar</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
          {groups.map(([fam, list]) => (
            <div key={fam} className="border rounded bg-white">
              <div className="p-2 text-xs text-gray-600">{fam}</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left">Item</th>
                      <th className="p-2 text-left">SKU</th>
                      <th className="p-2 text-left">UM</th>
                      {(() => { const hasSheet = list.some(supportsSheetDims); return hasSheet ? (<><th className="p-2 text-left">Larg.</th><th className="p-2 text-left">Compr.</th><th className="p-2 text-left">Gram.</th></>) : null; })()}
                      {(() => { const hasCore = list.some(supportsCoreDims); return hasCore ? (<><th className="p-2 text-left">Diâmetro</th><th className="p-2 text-left">Tubete</th></>) : null; })()}
                      <th className="p-2 text-left">Qtd</th>
                      <th className="p-2 text-left">Peso (KG)</th>
                      <th className="p-2 text-left">Preço</th>
                      <th className="p-2 text-left">Desc (%)</th>
                      <th className="p-2 text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((it) => {
                      const hasSheet = list.some(supportsSheetDims);
                      const hasCore = list.some(supportsCoreDims);
                      const isFeatures = showFeaturesFor === it.id;

                      return (
                        <SalesOrderItemRow
                           key={it.id}
                           item={it}
                           isOrderEditable={isHeaderEditing}
                           canDelete={isDeletableStatus(order?.status) && !isHeaderEditing}
                           onPreviewUpdate={(updated) => {
                             setOrderItems(prev => prev.map(i => i.id === updated.id ? updated : i));
                           }}
                           onAutoSave={async (updated) => {
                              const res = await fetch(`/api/sales/orders/items/${updated.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(updated)
                              });
                              if (!res.ok) throw new Error('Falha ao salvar item');
                           }}
                           onSaveSuccess={refreshOrder}
                           onDelete={async () => {
                               if (!confirm('Confirma excluir este item?')) return;
                               try {
                                 const res = await fetch(`/api/sales/orders/items/${it.id}`, { method: 'DELETE' });
                                 if (!res.ok) throw new Error('Falha ao excluir item');
                                 await refreshOrder();
                               } catch (e: any) { alert(e?.message || String(e)); }
                           }}
                           showFeatures={isFeatures}
                           toggleFeatures={() => setShowFeaturesFor(isFeatures ? null : it.id)}
                           computeWeightKg={computeWeightKg}
                           fmtInt={fmtInt}
                           // Extra props for column visibility
                           hasSheetCol={hasSheet}
                           hasCoreCol={hasCore}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(() => {
                const subtotal = list.reduce((s, it) => s + lineBase(it), 0);
                const discountTotal = list.reduce((s, it) => s + (lineBase(it) * (it.discountPct / 100)), 0);
                const total = subtotal - discountTotal;
                const totalWeight = list.reduce((s, it) => s + Math.round(computeWeightKg(it)), 0);
                return (
                  <div className="px-3 py-2 text-xs text-gray-700 flex gap-6 justify-end border-t">
                    <span>Subtotal: {fmtCurrency(subtotal)}</span>
                    <span>Descontos: {fmtCurrency(discountTotal)}</span>
                    <span>Total Sem Imp R$: {fmtCurrency(total)}</span>
                    <span>Total Peso (KG): {fmtInt(totalWeight)}</span>
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 rounded">Total Fat. R$: {fmtCurrency(order.totalInvoiced)}</span>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
