"use client";
import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  clientOrderNumber?: string | null;
  clientOrderItemNumber?: number | null;
  itemDeliveryDate?: string | Date | null;
  internalResin?: boolean;
  externalResin?: boolean;
  creases?: Record<string, number> | null;
};

type SalesOrder = {
  id: number;
  code: string;
  status: string;
  orderDate: string;
  customerName: string;
  customerId?: number;
  customerDoc?: string | null;
  triangularCustomerName?: string | null;
  triangularCustomerDoc?: string | null;
  paymentTerms?: string | null;
  deliveryDate?: string | null;
  notes?: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  items?: OrderItem[];
};

import { SalesOrderItemCard, SalesOrderItemRow, supportsSheetDims, supportsCoreDims } from "../components/SalesOrderItemRow";

const ICON_BTN = "inline-flex items-center justify-center w-8 h-8 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-gray-700";

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

// Helpers imported from components/SalesOrderItemRow

function statusChipStyle(): string {
  return 'bg-gray-100 text-gray-800 border border-gray-300';
}

function statusLabelPt(): string {
  return 'Novo';
}

const minChars = 1;

const AsyncSelect = ({ 
  label, 
  value, 
  onChange, 
  onSelectObj,
  fetchUrl, 
  placeholder,
  renderOption,
  getLabel
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void;
  onSelectObj?: (obj: any) => void;
  fetchUrl: (q: string) => string; 
  placeholder?: string;
  renderOption: (item: any) => React.ReactNode;
  getLabel: (item: any) => string;
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

function NewSalesOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams?.get('customerId');
  const copyFromParam = searchParams?.get('copyFrom');
  
  // Initial empty order
  const [order, setOrder] = useState<Partial<SalesOrder>>({
    status: 'OPEN',
    orderDate: new Date().toISOString(),
    customerName: '',
    customerId: undefined,
    paymentTerms: '',
    deliveryDate: '',
    items: [],
    subtotal: 0,
    discountTotal: 0,
    total: 0
  });

  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const loadFirstPaymentTermForClient = async (clientId: number) => {
    if (!Number.isFinite(clientId) || clientId <= 0) return;
    try {
      const res = await fetch(`/api/base/payment-terms?clientId=${clientId}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const first = list[0];
      if (first?.description) {
        const v = first.code != null ? `[${first.code}] ${first.description}` : String(first.description);
        setOrder((prev) => ({ ...prev, paymentTerms: v }));
      }
    } catch {}
  };
  
  useEffect(() => {
    if (copyFromParam) return;
    if (customerIdParam) {
      fetch(`/api/base/clients?q=${customerIdParam}`)
        .then(r => r.json())
        .then(arr => {
          if (Array.isArray(arr)) {
            const c = arr.find((x: any) => String(x.id) === customerIdParam);
            if (c) {
              setOrder(prev => ({ ...prev, customerName: c.name, customerDoc: c.doc, customerId: c.id }));
              loadFirstPaymentTermForClient(Number(c.id));
            }
          }
        })
        .catch(console.error);
    }
  }, [customerIdParam, copyFromParam]);

  useEffect(() => {
    const copyId = Number(copyFromParam);
    if (!Number.isFinite(copyId) || copyId <= 0) return;

    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/sales/orders/${copyId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao carregar pedido para cópia');
        const src = await res.json();

        const clientId = Number((src as any)?.clientId ?? (src as any)?.customerId ?? 0);
        const srcItems = Array.isArray((src as any)?.items) ? (src as any).items : [];

        const invIds = Array.from(
          new Set(
            srcItems
              .map((it: any) => Number(it?.inventoryItemId ?? it?.inventoryItem?.id))
              .filter((n: any) => Number.isFinite(n) && n > 0)
          )
        );

        const invById = new Map<number, InventoryItem>();
        if (Number.isFinite(clientId) && clientId > 0 && invIds.length > 0) {
          const params = new URLSearchParams();
          params.set('clientId', String(clientId));
          params.set('ids', invIds.join(','));
          const itemsRes = await fetch(`/api/items?${params.toString()}`, { cache: 'no-store' });
          if (itemsRes.ok) {
            const arr = await itemsRes.json();
            if (Array.isArray(arr)) {
              for (const it of arr) {
                const id = Number(it?.id);
                if (!Number.isFinite(id) || id <= 0) continue;
                invById.set(id, it as InventoryItem);
              }
            }
          }
        }

        const copiedItems: OrderItem[] = srcItems.map((it: any, idx: number) => {
          const invId = Number(it?.inventoryItemId ?? it?.inventoryItem?.id);
          const inv = Number.isFinite(invId) && invId > 0 ? invById.get(invId) : undefined;
          const unitPrice = inv?.unitPrice != null ? Number(inv.unitPrice) : Number(it?.unitPrice ?? 0);

          const fallbackInv: InventoryItem | null = it?.inventoryItem
            ? (it.inventoryItem as InventoryItem)
            : Number.isFinite(invId) && invId > 0
            ? ({ id: invId, name: String(it?.name || 'Produto') } as InventoryItem)
            : null;

          return {
            id: -Date.now() - idx,
            name: String(it?.name || ''),
            sku: it?.sku ?? null,
            unit: it?.unit ?? null,
            quantity: Number(it?.quantity ?? 1),
            unitPrice,
            discountPct: Number(it?.discountPct ?? 0),
            width: it?.width ?? inv?.width ?? null,
            length: it?.length ?? inv?.length ?? null,
            grammage: it?.grammage ?? inv?.grammage ?? null,
            diameter: it?.diameter ?? null,
            tube: it?.tube ?? null,
            inventoryItem: inv ?? fallbackInv,
            clientOrderNumber: it?.clientOrderNumber ?? null,
            clientOrderItemNumber: it?.clientOrderItemNumber ?? null,
            itemDeliveryDate: it?.itemDeliveryDate ?? null,
            internalResin: !!it?.internalResin,
            externalResin: !!it?.externalResin,
            creases: it?.creases ?? null,
          };
        });

        setTotalWithTax(0);
        setOrder({
          status: 'OPEN',
          orderDate: new Date().toISOString(),
          customerName: String((src as any)?.customerName || ''),
          customerDoc: (src as any)?.customerDoc ?? null,
          customerId: Number.isFinite(clientId) && clientId > 0 ? clientId : undefined,
          paymentTerms: (src as any)?.paymentTerms ?? '',
          deliveryDate: (src as any)?.deliveryDate ? new Date((src as any).deliveryDate).toISOString().slice(0, 10) : '',
          triangularCustomerName: (src as any)?.triangularCustomerName ?? '',
          triangularCustomerDoc: (src as any)?.triangularCustomerDoc ?? '',
          items: copiedItems,
          subtotal: 0,
          discountTotal: 0,
          total: 0
        });
      } catch (e: any) {
        alert(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [copyFromParam]);
  
  const [currentDate, setCurrentDate] = useState('');
  const [sessionEntity, setSessionEntity] = useState<{ id: number; name: string; cnpj: string } | null>(null);

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('pt-BR'));
    fetch('/api/session/entity')
      .then(r => r.json())
      .then(data => {
        if (data && data.entity) {
          setSessionEntity(data.entity);
        }
      })
      .catch(console.error);
  }, []);
  
  const [showFeaturesFor, setShowFeaturesFor] = useState<number | null>(null);

  // Item search
  const [addingItems, setAddingItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [totalWithTax, setTotalWithTax] = useState(0);

    const searchClientItems = async (term: string) => {
    if (!order.customerId) {
      // If no customer selected, do not search
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('q', term);
      if (order.customerId) {
        params.set('clientId', String(order.customerId));
      }
      
      const res = await fetch(`/api/items?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.slice(0, 20));
      }
    } catch (e) {
      console.error(e);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const addItemToOrder = (invItem: InventoryItem) => {
    const newItem: OrderItem = {
      id: -Date.now(), // Temp ID
      name: invItem.name,
      sku: invItem.sku,
      unit: invItem.unit,
      quantity: 1,
      unitPrice: Number(invItem.unitPrice ?? 0),
      discountPct: 0,
      inventoryItem: invItem,
      width: invItem.width,
      length: invItem.length,
      grammage: invItem.grammage
    };
    
    setOrder(prev => {
      const currentItems = prev.items || [];
      return {
        ...prev,
        items: [...currentItems, newItem]
      };
    });
    setAddingItems(false);
    setSearchTerm('');
  };

  const removeItem = (id: number) => {
    if (!confirm('Confirma excluir este item?')) return;
    setOrder(prev => ({
      ...prev,
      items: (prev.items || []).filter(it => it.id !== id)
    }));
  };

  const updateItem = (id: number, changes: Partial<OrderItem>) => {
    setOrder(prev => ({
      ...prev,
      items: (prev.items || []).map(it => 
        it.id === id ? { ...it, ...changes } : it
      )
    }));
  };

  const saveOrder = async () => {
    if (!order.customerName) {
      alert('Informe o nome do cliente');
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/sales/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: order.customerName,
          customerDoc: order.customerDoc,
          customerId: order.customerId,
          triangularCustomerName: order.triangularCustomerName,
          triangularCustomerDoc: order.triangularCustomerDoc,
          entityCnpj: sessionEntity?.cnpj,
          paymentTerms: order.paymentTerms,

          deliveryDate: order.deliveryDate,
          items: order.items?.map(it => ({
            inventoryItemId: it.inventoryItem?.id,
            name: it.name,
            sku: it.sku,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountPct: it.discountPct,
            width: it.width,
            length: it.length,
            grammage: it.grammage,
            diameter: it.diameter,
            tube: it.tube,
            clientOrderNumber: it.clientOrderNumber,
            clientOrderItemNumber: it.clientOrderItemNumber,
            itemDeliveryDate: it.itemDeliveryDate,
            internalResin: it.internalResin,
            externalResin: it.externalResin,
            creases: it.creases
          }))
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao salvar pedido');
      }
      
      const saved = await res.json();
      router.push(`/sales/orders/${saved.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fmtCurrency = (n: number | undefined) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtInt = (n: number | undefined) => Math.round(n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

  const handleSimulateTaxes = async () => {
    const items = order.items || [];
    if (items.length === 0) {
      alert('Adicione pelo menos um item para simular impostos.');
      return;
    }
    
    if (items.some(it => it.quantity <= 0)) {
      alert('Todos os itens devem ter quantidade maior que zero.');
      return;
    }

    setSimulating(true);
    try {
      const res = await fetch('/api/sales/orders/simulate-tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha na simulação');
      }
      
      const data = await res.json();
      if (data && data.vltotcomimp !== undefined) {
        setTotalWithTax(Number(data.vltotcomimp));
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSimulating(false);
    }
  };

  const computeWeightKg = (it: OrderItem): number => {
    const hasDims = supportsSheetDims(it);
    if (hasDims) {
      const w = it.width ?? 0;
      const l = it.length ?? 0;
      const g = it.grammage ?? 0;
      const q = it.quantity ?? 0;
      if (w > 0 && l > 0 && g > 0 && q > 0) {
        const areaM2 = (l / 1000) * (w / 1000);
        const weightKg = (areaM2 * g * q) / 1000;
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

  const globalItems = order.items || [];
  const globalSubtotal = globalItems.reduce((s, it) => {
    return s + lineBase(it);
  }, 0);

  const globalDiscount = globalItems.reduce((s, it) => {
    return s + (lineBase(it) * (it.discountPct / 100));
  }, 0);

  const globalTotalNoTax = globalSubtotal - globalDiscount;
  const globalWeight = globalItems.reduce((s, it) => s + Math.round(computeWeightKg(it)), 0);

  const groups = useMemo(() => {
    const out = new Map<string, OrderItem[]>();
    for (const it of (order.items || [])) {
      const key = familyName(it);
      const arr = out.get(key) || [];
      arr.push(it);
      out.set(key, arr);
    }
    return Array.from(out.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [order.items]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Novo Pedido</h1>
          <span className={`text-xs px-2 py-1 rounded ${statusChipStyle()}`}>
            {statusLabelPt()}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 border rounded" title="Voltar" aria-label="Voltar" onClick={() => router.back()}>
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z"/></svg>
              Voltar
            </span>
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-600">Processando...</div>}
      
      <div className="space-y-3">
        {/* Header */}
        <div className="border rounded bg-white p-2 text-sm">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="order-1 sm:order-2 w-full sm:w-auto sm:ml-auto">
              <div className="flex flex-col items-stretch sm:items-end gap-2">
                <div className="flex sm:justify-end">
                  <button 
                    className={`flex items-center gap-1 px-3 py-1 text-sm bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-gray-700 ${simulating ? 'opacity-50 cursor-wait' : ''}`} 
                    title="Simulação de impostos" 
                    onClick={handleSimulateTaxes}
                    disabled={simulating}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    {simulating ? 'Simulando...' : 'Simular Impostos'}
                  </button>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  <button className={`${ICON_BTN} opacity-50 cursor-not-allowed`} title="Enviar para ERP (Desabilitado)" disabled>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </button>
                  <button className={`${ICON_BTN} opacity-50 cursor-not-allowed`} title="Excluir (Desabilitado)" disabled>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                  <button className={`${ICON_BTN} text-green-600 border-green-200 bg-green-50 hover:bg-green-100`} title="Salvar Pedido" onClick={saveOrder}>
                     <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="order-2 sm:order-1 grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
              <div className="md:col-span-12 flex flex-wrap items-center gap-8">
                <div>
                  <span className="text-gray-600">Número</span>
                  <div className="font-mono mt-1 text-gray-400">(Automático)</div>
                </div>
                <div>
                  <span className="text-gray-600">Data</span>
                  <div className="mt-1">{currentDate}</div>
                </div>
              </div>

              <div className="md:col-span-6">
                <AsyncSelect
                  label="Cliente"
                  value={order.customerName || ''}
                  onChange={(val) => setOrder(prev => ({ ...prev, customerName: val }))}
                  onSelectObj={(c) => {
                    setOrder(prev => ({ ...prev, customerName: c.name, customerDoc: c.doc, customerId: c.id }));
                    loadFirstPaymentTermForClient(Number(c.id));
                  }}
                  fetchUrl={(q) => `/api/base/clients?q=${q}`}
                  placeholder="Busque por nome ou documento"
                  getLabel={(c) => c.name}
                  renderOption={(c) => (
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.doc}</div>
                    </div>
                  )}
                />
              </div>

              <div className="md:col-span-3">
                <AsyncSelect
                  label="Condição de pagamento"
                  value={order.paymentTerms || ''}
                  onChange={(val) => setOrder(prev => ({ ...prev, paymentTerms: val }))}
                  onSelectObj={(item) => {
                    const v = item?.code != null ? `[${item.code}] ${item.description}` : String(item?.description || '');
                    setOrder((prev) => ({ ...prev, paymentTerms: v }));
                  }}
                  fetchUrl={(q) => `/api/base/payment-terms?clientId=${order.customerId ? String(order.customerId) : '0'}&q=${q}`}
                  placeholder="Busque por descrição ou código"
                  getLabel={(item) => item?.code != null ? `[${item.code}] ${item.description}` : item.description}
                  renderOption={(item) => (
                    <div>
                      <div className="font-medium">{item.description}</div>
                      <div className="text-xs text-gray-500">Cód: {item.code} - Parcelas: {item.installments}</div>
                    </div>
                  )}
                />
              </div>
              <div className="md:col-span-3">
                <span className="text-gray-600">Entrega</span>
                <input 
                  type="date" 
                  className="mt-1 w-full px-2 py-1 border rounded" 
                  value={order.deliveryDate ?? ''} 
                  onChange={(e) => setOrder(prev => ({ ...prev, deliveryDate: e.target.value }))} 
                />
              </div>

              <div className="md:col-span-6">
                <AsyncSelect
                  label="Cliente Remessa Triangular"
                  value={order.triangularCustomerName || ''}
                  onChange={(val) => setOrder(prev => ({ ...prev, triangularCustomerName: val }))}
                  onSelectObj={(c) => setOrder(prev => ({ ...prev, triangularCustomerName: c.name, triangularCustomerDoc: c.doc }))}
                  fetchUrl={(q) => `/api/base/clients?q=${q}`}
                  placeholder="Busque por nome ou documento"
                  getLabel={(c) => c.name}
                  renderOption={(c) => (
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.doc}</div>
                    </div>
                  )}
                />
              </div>
              <div className="md:col-span-6"></div>

              <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <span className="text-gray-600">Total Sem Imp R$</span>
                  <div className="mt-1 w-full px-2 py-1 border rounded bg-gray-50 text-gray-800">{fmtCurrency(globalTotalNoTax)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Total Com Imp R$</span>
                  <div className="mt-1 w-full px-2 py-1 border rounded bg-gray-50 text-gray-800">{fmtCurrency(totalWithTax)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Total Peso (KG)</span>
                  <div className="mt-1 w-full px-2 py-1 border rounded bg-gray-50 text-gray-800">{fmtInt(globalWeight)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Itens */}
        <div className="border rounded bg-white">
          <div className="px-3 py-2 border-b flex items-center gap-2">
            <span className="text-sm text-gray-700">Itens</span>
            <button 
              className={`ml-auto px-2 py-1 text-xs border rounded bg-white hover:bg-gray-100 ${!order.customerId ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!order.customerId}
              title={!order.customerId ? "Selecione um cliente primeiro" : ""}
              onClick={() => { setAddingItems(true); setSearchTerm(''); searchClientItems(''); }}
            >
              Adicionar itens
            </button>
          </div>
          {addingItems && (
            <div className="p-3 border-b">
              <div className="flex items-center gap-2">
                <input 
                  className="flex-1 px-2 py-1 border rounded" 
                  placeholder="Pesquisar itens (digite para buscar)" 
                  value={searchTerm} 
                  onChange={(e) => { 
                    const v = e.target.value; 
                    setSearchTerm(v); 
                    searchClientItems(v); 
                  }} 
                  autoFocus
                />
                <button className="px-2 py-1 text-xs border rounded" onClick={() => setAddingItems(false)}>Fechar</button>
              </div>
              <div className="mt-2">
                {searchLoading && <div className="text-xs text-gray-500">Buscando...</div>}
                {searchResults.length === 0 && searchTerm && <div className="text-xs text-gray-500">Nenhum item encontrado.</div>}
                <ul className="divide-y max-h-60 overflow-auto">
                  {searchResults.map((it) => (
                    <li key={it.id} className="py-2 flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-2 rounded" onClick={() => addItemToOrder(it)}>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{it.name}</div>
                        <div className="text-xs text-gray-600">
                          {it.sku || '-'} • {it.unit || '-'} 
                          {it.unitPrice ? ` • ${it.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Groups */}
        {groups.map(([fam, list]) => (
          <div key={fam} className="border rounded bg-white">
            <div className="p-2 text-xs text-gray-600">{fam}</div>
            <div className="sm:hidden divide-y">
              {list.map((it) => (
                <SalesOrderItemCard
                  key={it.id}
                  item={it}
                  isOrderEditable={true}
                  canDelete={true}
                  onPreviewUpdate={(updated) => updateItem(it.id, updated)}
                  onDelete={() => removeItem(it.id)}
                  showFeatures={showFeaturesFor === it.id}
                  toggleFeatures={() => setShowFeaturesFor(showFeaturesFor === it.id ? null : it.id)}
                  computeWeightKg={computeWeightKg}
                  fmtInt={fmtInt}
                  hasSheetCol={list.some(supportsSheetDims)}
                  hasCoreCol={list.some(supportsCoreDims)}
                />
              ))}
            </div>
            <div className="hidden sm:block overflow-x-auto">
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
                  {list.map((it) => (
                    <SalesOrderItemRow
                      key={it.id}
                      item={it}
                      isOrderEditable={true}
                      canDelete={true}
                      onPreviewUpdate={(updated) => updateItem(it.id, updated)}
                      onDelete={() => removeItem(it.id)}
                      showFeatures={showFeaturesFor === it.id}
                      toggleFeatures={() => setShowFeaturesFor(showFeaturesFor === it.id ? null : it.id)}
                      computeWeightKg={computeWeightKg}
                      fmtInt={fmtInt}
                      hasSheetCol={list.some(supportsSheetDims)}
                      hasCoreCol={list.some(supportsCoreDims)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {(() => {
              const subtotal = list.reduce((s, it) => {
                return s + lineBase(it);
              }, 0);
              
              const discountTotal = list.reduce((s, it) => {
                const discount = it.discountPct;
                return s + (lineBase(it) * (discount / 100));
              }, 0);
              
              const total = subtotal - discountTotal;
              const totalWeight = list.reduce((s, it) => s + Math.round(computeWeightKg(it)), 0);
              return (
                <div className="px-3 py-2 text-xs text-gray-700 flex flex-wrap gap-4 justify-end border-t">
                  <span>Subtotal: {fmtCurrency(subtotal)}</span>
                  <span>Descontos: {fmtCurrency(discountTotal)}</span>
                  <span>Total Sem Imp R$: {fmtCurrency(total)}</span>
                  <span>Total Peso (KG): {fmtInt(totalWeight)}</span>
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          <h2 className="font-bold mb-2">Erro no componente:</h2>
          <pre className="text-xs overflow-auto">{this.state.error?.toString()}</pre>
          <pre className="text-xs overflow-auto mt-2">{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function NewSalesOrderPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ErrorBoundary>
        <NewSalesOrderContent />
      </ErrorBoundary>
    </Suspense>
  );
}
