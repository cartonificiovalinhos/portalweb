"use client";
// Rebuild trigger: Fix webpack runtime error
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Client = { 
  id: number; 
  doc?: string | null; 
  name: string; 
  cep?: string | null; 
  logradouro?: string | null; 
  numero?: string | null; 
  bairro?: string | null; 
  cidade?: string | null; 
  estado?: string | null;
  paymentTermId?: number | null;
  paymentTermCode?: number | null;
  paymentTermDescription?: string | null;
  creditLimit?: number;
  availableLimit?: number;
  titlesDue?: number;
  titlesOverdue?: number;
};
type PaymentTerm = { id: number; code: number | null; description: string; installments?: number };
type OrderItem = { id: number; sku?: string | null; name: string; unit?: string | null; quantity: number; unitPrice: number; discountPct: number };
type SalesOrder = { 
  id: number; 
  code: string; 
  status: string;
  orderDate: string; 
  customerName: string; 
  customerDoc?: string | null; 
  total: number; 
  items?: OrderItem[];
};
type LinkedItem = { id: number; name: string; sku?: string | null; unit?: string | null; unitPrice?: number; width?: number; length?: number; grammage?: number };
type CartItem = { id: number; inventoryItemId: number; name: string; sku?: string | null; unit?: string | null; quantity: number; unitPrice: number };

const statusColor = (s: string) => {
  const v = (s || '').trim();
  switch (v) {
    case 'Orçamento': return 'bg-gray-100 text-gray-800';
    case 'Aguardando Integração': return 'bg-yellow-100 text-yellow-800';
    case 'Erro na integração': return 'bg-red-100 text-red-800';
    case 'Integrado': return 'bg-blue-100 text-blue-800';
    case 'Em fila produção': return 'bg-amber-100 text-amber-800';
    case 'Em produção': return 'bg-indigo-100 text-indigo-800';
    case 'Produzido/Estocado': return 'bg-cyan-100 text-cyan-800';
    case 'Faturado': return 'bg-green-100 text-green-800';
    case 'Cancelado': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const statusLabelPt = (s?: string) => {
  const v = (s || '').trim().toUpperCase();
  switch (v) {
    case 'OPEN': return 'Orçamento';
    case 'AGUARDANDO INTEGRAÇÃO':
    case 'AGUARDANDO INTEGRACAO':
    case 'AWAITING INTEGRATION': return 'Aguardando Integração';
    case 'INTEGRADO':
    case 'INTEGRATED': return 'Integrado';
    case 'ERRO NA INTEGRAÇÃO':
    case 'ERRO NA INTEGRACAO':
    case 'INTEGRATION ERROR': return 'Erro na integração';
    case 'EM FILA PRODUÇÃO':
    case 'EM FILA PRODUCAO': return 'Em fila produção';
    case 'EM PRODUÇÃO':
    case 'EM PRODUCAO': return 'Em produção';
    case 'PRODUZIDO/ESTOCADO': return 'Produzido/Estocado';
    case 'FATURADO': return 'Faturado';
    case 'CANCELADO': return 'Cancelado';
    default: return s || '-';
  }
};

const isEditableStatus = (status?: string) => {
  const s = (status || '').trim().toUpperCase();
  return s === 'OPEN' || s === 'ORÇAMENTO' || s === 'ORCAMENTO' || s.includes('ERRO') || s.includes('ERROR');
};

const IconBtn = ({ title, onClick, children, disabled = false }: any) => (
  <button
    title={title}
    onClick={disabled ? undefined : onClick}
    className={`inline-flex items-center justify-center w-7 h-7 rounded border mr-1 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
    disabled={disabled}
  >
    {children}
  </button>
);

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
  </svg>
);
const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" strokeWidth="1.5" />
    <path d="M14 2v6h6" strokeWidth="1.5" />
  </svg>
);
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path d="M22 2 11 13" strokeWidth="1.5" />
    <path d="M22 2 15 22l-4-9-9-4Z" strokeWidth="1.5" />
  </svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path d="M3 6h18" strokeWidth="1.5" />
    <path d="M8 6V4h8v2" strokeWidth="1.5" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" strokeWidth="1.5" />
  </svg>
);

export default function ClientDetailsPage() {
  const params = useParams() as any;
  const id = Number(params.id);
  const [client, setClient] = useState<Client | null>(null);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [integratingId, setIntegratingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "paymentTerms" | "linkedItems">("orders");
  const [ordersPage, setOrdersPage] = useState(0);
  const [paymentTermsPage, setPaymentTermsPage] = useState(0);
  const [linkedItemsPage, setLinkedItemsPage] = useState(0);

  const PAGE_SIZE = 20;

  const refreshCart = async () => {
    if (!client) return;
    const r = await fetch(`/api/clients/${client.id}/cart`, { cache: 'no-store' });
    if (r.ok) {
      const arr: CartItem[] = await r.json();
      setCartItems(Array.isArray(arr) ? arr : []);
    } else {
      setCartItems([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/base/clients?q=${encodeURIComponent(String(id))}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao carregar cliente');
        const arr: Client[] = await res.json();
        const c = (arr || []).find((x) => Number(x.id) === id) || null;
        setClient(c);
        try {
          const ptRes = await fetch(`/api/base/payment-terms?clientId=${encodeURIComponent(String(id))}`, { cache: 'no-store' });
          if (ptRes.ok) {
            const ptData: PaymentTerm[] = await ptRes.json();
            setPaymentTerms(Array.isArray(ptData) ? ptData : []);
          } else {
            setPaymentTerms([]);
          }
        } catch {
          setPaymentTerms([]);
        }
        if (c?.doc) {
          const ro = await fetch(`/api/sales/orders?doc=${encodeURIComponent(c.doc)}`, { cache: 'no-store' });
          if (ro.ok) {
            const list: SalesOrder[] = await ro.json();
            setOrders(Array.isArray(list) ? list : []);
          } else {
            setOrders([]);
          }
          const li = await fetch(`/api/clients/items/by-doc/${encodeURIComponent(c.doc)}`, { cache: 'no-store' });
          if (li.ok) {
            const linked: LinkedItem[] = await li.json();
            setLinkedItems(Array.isArray(linked) ? linked : []);
          } else {
            setLinkedItems([]);
          }
        } else {
          setOrders([]);
          setLinkedItems([]);
        }
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally { setLoading(false); }
    };
    if (Number.isFinite(id)) load();
  }, [id]);

  useEffect(() => {
    if (client) {
        refreshCart();
    }
  }, [client]);

  useEffect(() => {
    const last = Math.max(0, Math.ceil(orders.length / PAGE_SIZE) - 1);
    setOrdersPage((p) => Math.min(p, last));
  }, [orders.length]);

  useEffect(() => {
    const last = Math.max(0, Math.ceil(paymentTerms.length / PAGE_SIZE) - 1);
    setPaymentTermsPage((p) => Math.min(p, last));
  }, [paymentTerms.length]);

  useEffect(() => {
    const last = Math.max(0, Math.ceil(linkedItems.length / PAGE_SIZE) - 1);
    setLinkedItemsPage((p) => Math.min(p, last));
  }, [linkedItems.length]);

  const addToCart = async (inventoryItemId: number) => {
    if (!client) return;
    try {
      const res = await fetch(`/api/clients/${client.id}/cart/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inventoryItemId, quantity: 1 }) });
      if (!res.ok) throw new Error('Falha ao adicionar ao carrinho');
      await refreshCart();
      setShowCart(true);
    } catch (e: any) { alert(e?.message || String(e)); }
  };

  const updateCartQty = async (inventoryItemId: number, quantity: number) => {
    if (!client) return;
    const res = await fetch(`/api/clients/${client.id}/cart/items/${inventoryItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity }) });
    if (res.ok) await refreshCart();
  };

  const removeFromCart = async (inventoryItemId: number) => {
    if (!client) return;
    const res = await fetch(`/api/clients/${client.id}/cart/items/${inventoryItemId}`, { method: 'DELETE' });
    if (res.ok) await refreshCart();
  };

  const generateOrder = async () => {
    if (!client) return;
    if (!confirm('Deseja gerar um pedido com os itens do carrinho?')) return;
    
    try {
        const res = await fetch('/api/sales/orders/from-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: client.id })
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Erro ao gerar pedido');
        }
        
        const newOrder = await res.json();
        alert(`Pedido ${newOrder.code} gerado com sucesso!`);
        
        // Refresh cart and orders
        await refreshCart();
        // Reload orders
        if (client.doc) {
            const ro = await fetch(`/api/sales/orders?doc=${encodeURIComponent(client.doc)}`, { cache: 'no-store' });
            if (ro.ok) {
                const list: SalesOrder[] = await ro.json();
                setOrders(Array.isArray(list) ? list : []);
            }
        }
        
    } catch (e: any) {
        alert(e.message);
    }
  };

  const cartCount = cartItems.length;

  const orderTotal = (o: SalesOrder) =>
    (o.items || []).reduce((acc, item) => {
      const total = item.quantity * item.unitPrice;
      const discount = total * (item.discountPct / 100);
      return acc + (total - discount);
    }, 0);

  const ordersTotalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const paymentTermsTotalPages = Math.max(1, Math.ceil(paymentTerms.length / PAGE_SIZE));
  const linkedItemsTotalPages = Math.max(1, Math.ceil(linkedItems.length / PAGE_SIZE));

  const ordersSliceStart = ordersPage * PAGE_SIZE;
  const ordersView = orders.slice(ordersSliceStart, ordersSliceStart + PAGE_SIZE);

  const paymentTermsSliceStart = paymentTermsPage * PAGE_SIZE;
  const paymentTermsView = paymentTerms.slice(paymentTermsSliceStart, paymentTermsSliceStart + PAGE_SIZE);

  const linkedItemsSliceStart = linkedItemsPage * PAGE_SIZE;
  const linkedItemsView = linkedItems.slice(linkedItemsSliceStart, linkedItemsSliceStart + PAGE_SIZE);

  const formatDoc = (doc: string | null | undefined) => {
    if (!doc) return '-';
    const d = doc.replace(/\D/g, '');
    if (d.length === 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (d.length === 14) {
      return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cliente • Detalhes</h1>
        <button className="px-3 py-2 border rounded" onClick={() => router.back()}>Voltar</button>
      </div>
      {loading && <div className="text-sm text-gray-600">Carregando…</div>}
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      {client && (
        <div className="border rounded bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col xl:flex-row justify-between gap-4 flex-1 text-sm">
              <div className="flex flex-col gap-2">
                <div className="whitespace-nowrap"><span className="text-gray-600">CPF/CNPJ:</span> <span className="font-medium ml-1">{formatDoc(client.doc)}</span></div>
                <div className="whitespace-nowrap"><span className="text-gray-600">Nome:</span> <span className="font-medium ml-1">{client.name}</span></div>
                <div className="flex gap-4">
                  <div className="whitespace-nowrap"><span className="text-gray-600">Cidade:</span> <span className="font-medium ml-1">{client.cidade || '-'}</span></div>
                  <div className="whitespace-nowrap"><span className="text-gray-600">UF:</span> <span className="font-medium ml-1">{client.estado || '-'}</span></div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                <div className="whitespace-nowrap"><span className="text-gray-600">Limite Crédito Total R$:</span> <span className="font-medium ml-1">{(client.creditLimit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div className="whitespace-nowrap"><span className="text-gray-600">Títulos á Vencer R$:</span> <span className="font-medium ml-1">{(client.titlesDue ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div className="whitespace-nowrap"><span className="text-gray-600">Limite Disponível Total R$:</span> <span className="font-medium ml-1">{(client.availableLimit ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div className="whitespace-nowrap"><span className="text-gray-600">Títulos Vencidos R$:</span> <span className="font-medium text-red-600 ml-1">{(client.titlesOverdue ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
              </div>
            </div>
            <button
              className="self-center relative inline-flex items-center justify-center p-2 border rounded bg-white hover:bg-gray-50 transition-colors"
              title="Carrinho do cliente"
              aria-label="Carrinho do cliente"
              onClick={() => { setShowCart((v) => !v); }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border border-white">
                    {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {showCart && (
        <div className="border rounded bg-white">
          <div className="flex justify-between items-center p-3 bg-gray-50 border-b">
            <span className="text-sm font-semibold text-gray-700">Carrinho do cliente</span>
            {cartItems.length > 0 && (
              <button 
                  onClick={generateOrder}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
              >
                  Gerar Pedido
              </button>
            )}
          </div>
          <div className="sm:hidden divide-y">
            {cartItems.map((it) => (
              <div key={it.inventoryItemId} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 break-words">{it.name}</div>
                    <div className="mt-1 text-xs text-gray-600 font-mono">{it.sku || '-'}</div>
                    <div className="mt-1 text-xs text-gray-600">{it.unit || '-'}</div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="text-xs text-gray-600">Qtd</div>
                      <input
                        type="number"
                        className="w-24 px-2 py-1 border rounded"
                        value={it.quantity}
                        onChange={(e) => updateCartQty(it.inventoryItemId, Number(e.target.value))}
                      />
                      <div className="ml-auto text-sm font-medium text-gray-900">
                        {(it.unitPrice ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>
                  </div>
                  <button className="px-3 py-2 text-xs border rounded" onClick={() => removeFromCart(it.inventoryItemId)}>
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {cartItems.length === 0 && <div className="p-3 text-gray-500 text-sm">Carrinho vazio</div>}
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left">Item</th>
                  <th className="p-2 text-left">SKU</th>
                  <th className="p-2 text-left">Un.</th>
                  <th className="p-2 text-left">Qtd</th>
                  <th className="p-2 text-left">Preço Unit R$</th>
                  <th className="p-2 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((it) => (
                  <tr key={it.inventoryItemId} className="border-t">
                    <td className="p-2">{it.name}</td>
                    <td className="p-2">{it.sku || '-'}</td>
                    <td className="p-2">{it.unit || '-'}</td>
                    <td className="p-2">
                      <input type="number" className="w-20 px-2 py-1 border rounded" value={it.quantity} onChange={(e) => updateCartQty(it.inventoryItemId, Number(e.target.value))} />
                    </td>
                    <td className="p-2">{(it.unitPrice ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="p-2">
                      <button className="px-2 py-1 text-xs border rounded" onClick={() => removeFromCart(it.inventoryItemId)}>Excluir</button>
                    </td>
                  </tr>
                ))}
                {cartItems.length === 0 && (
                  <tr><td className="p-3 text-gray-500" colSpan={6}>Carrinho vazio</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="border-b border-gray-200">
          <ul className="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500">
            <li className="mr-2">
              <button
                onClick={() => setActiveTab("orders")}
                className={`inline-block px-3 py-2 border-b-2 rounded-t-lg transition-colors duration-200 ${
                  activeTab === "orders"
                    ? "text-blue-600 border-blue-600 active group-hover:text-blue-600"
                    : "border-transparent hover:text-gray-600 hover:border-gray-300"
                }`}
                aria-current={activeTab === "orders" ? "page" : undefined}
              >
                Pedidos
              </button>
            </li>
            <li className="mr-2">
              <button
                onClick={() => setActiveTab("paymentTerms")}
                className={`inline-block px-3 py-2 border-b-2 rounded-t-lg transition-colors duration-200 ${
                  activeTab === "paymentTerms"
                    ? "text-blue-600 border-blue-600 active group-hover:text-blue-600"
                    : "border-transparent hover:text-gray-600 hover:border-gray-300"
                }`}
                aria-current={activeTab === "paymentTerms" ? "page" : undefined}
              >
                Cond Pagto
              </button>
            </li>
            <li className="mr-2">
              <button
                onClick={() => setActiveTab("linkedItems")}
                className={`inline-block px-3 py-2 border-b-2 rounded-t-lg transition-colors duration-200 ${
                  activeTab === "linkedItems"
                    ? "text-blue-600 border-blue-600 active group-hover:text-blue-600"
                    : "border-transparent hover:text-gray-600 hover:border-gray-300"
                }`}
                aria-current={activeTab === "linkedItems" ? "page" : undefined}
              >
                Itens Cliente
              </button>
            </li>
          </ul>
        </div>

        {activeTab === "orders" && (
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 border-b bg-gray-50 text-sm text-gray-700 flex items-center">
              <span>Pedidos do Cliente</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-500">{orders.length} registro(s)</span>
                <a href={`/sales/orders/new?customerId=${client?.id || ''}`} className="px-3 py-1.5 text-xs border rounded bg-white hover:bg-gray-100 no-underline text-gray-700 font-medium">
                  + Novo Pedido
                </a>
              </div>
            </div>
            <div className="sm:hidden divide-y">
              {ordersView.map((o) => (
                <div key={o.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 font-mono break-words">{o.code || o.id}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {o.orderDate ? new Date(o.orderDate).toLocaleDateString('pt-BR') : '-'}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${statusColor(statusLabelPt(o.status))}`}>{statusLabelPt(o.status)}</span>
                        <span className="ml-auto text-sm font-medium text-gray-900">
                          {orderTotal(o).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className="px-3 py-2 text-xs border rounded" onClick={() => setSelected(o)}>Itens</button>
                        <button className="px-3 py-2 text-xs border rounded" onClick={() => { window.location.href = `/sales/orders/${o.id}`; }}>Detalhes</button>
                        <button
                          className="px-3 py-2 text-xs border rounded disabled:opacity-50"
                          disabled={integratingId === o.id || !['Orçamento', 'Erro na integração'].includes(statusLabelPt(o.status))}
                          onClick={async () => {
                            if (!confirm('Confirma enviar este pedido para o ERP?')) return;
                            setIntegratingId(o.id);
                            try {
                              const res = await fetch(`/api/sales/orders/${o.id}/integrate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
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

                              const c = client;
                              if (c?.doc) {
                                const ro = await fetch(`/api/sales/orders?doc=${encodeURIComponent(c.doc)}`, { cache: 'no-store' });
                                if (ro.ok) {
                                  const list: SalesOrder[] = await ro.json();
                                  setOrders(Array.isArray(list) ? list : []);
                                }
                              }
                            } catch (e: any) {
                              alert(e?.message || String(e));
                            } finally {
                              setIntegratingId(null);
                            }
                          }}
                        >
                          {integratingId === o.id ? 'Enviando...' : 'Enviar ERP'}
                        </button>
                        <button
                          className="px-3 py-2 text-xs border rounded disabled:opacity-50"
                          disabled={!isEditableStatus(o.status)}
                          onClick={async () => {
                            if (!confirm('Confirma excluir este pedido?')) return;
                            const r = await fetch(`/api/sales/orders/${o.id}`, { method: 'DELETE' });
                            if (r.ok) {
                              setOrders((prev) => prev.filter((x) => x.id !== o.id));
                            } else {
                              alert('Erro ao excluir pedido');
                            }
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && <div className="p-3 text-gray-500 text-sm text-center">Sem pedidos</div>}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2">Número</th>
                    <th className="text-left px-3 py-2">Cliente</th>
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-right px-3 py-2">Total Com Imp R$</th>
                    <th className="text-left px-3 py-2">Situação</th>
                    <th className="text-center px-3 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr><td className="p-3 text-gray-500 text-center" colSpan={6}>Sem pedidos</td></tr>
                  )}
                  {ordersView.map((o) => (
                    <tr key={o.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{o.code || o.id}</td>
                      <td className="px-3 py-2">{o.customerName || '-'}</td>
                      <td className="px-3 py-2">{o.orderDate ? new Date(o.orderDate).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="px-3 py-2 text-right">
                        {orderTotal(o).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${statusColor(statusLabelPt(o.status))}`}>{statusLabelPt(o.status)}</span></td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex">
                          <IconBtn title="Visualizar" onClick={() => setSelected(o)}><EyeIcon /></IconBtn>
                          <IconBtn title="Detalhes" onClick={() => { window.location.href = `/sales/orders/${o.id}`; }}> <FileIcon /> </IconBtn>
                          <IconBtn 
                            title="Enviar para ERP" 
                            disabled={integratingId === o.id || !['Orçamento', 'Erro na integração'].includes(statusLabelPt(o.status))}
                            onClick={async () => {
                              if (!confirm('Confirma enviar este pedido para o ERP?')) return;
                              setIntegratingId(o.id);
                              try {
                                const res = await fetch(`/api/sales/orders/${o.id}/integrate`, {
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

                                const c = client;
                                if (c?.doc) {
                                    const ro = await fetch(`/api/sales/orders?doc=${encodeURIComponent(c.doc)}`, { cache: 'no-store' });
                                    if (ro.ok) {
                                        const list: SalesOrder[] = await ro.json();
                                        setOrders(Array.isArray(list) ? list : []);
                                    }
                                }
                              } catch (e: any) { 
                                  alert(e?.message || String(e)); 
                              } finally {
                                  setIntegratingId(null);
                              }
                            }}
                          > 
                            {integratingId === o.id ? (
                                <svg className="animate-spin h-3 w-3 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : <SendIcon />}
                          </IconBtn>
                          <IconBtn 
                            title="Excluir" 
                            disabled={!isEditableStatus(o.status)}
                            onClick={async () => {
                                if (!confirm('Confirma excluir este pedido?')) return;
                                const r = await fetch(`/api/sales/orders/${o.id}`, { method: 'DELETE' });
                                if (r.ok) {
                                    setOrders((prev) => prev.filter((x) => x.id !== o.id));
                                } else {
                                    alert('Erro ao excluir pedido');
                                }
                            }}
                          > <TrashIcon /> </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-600">
              <button
                className="px-3 py-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
                disabled={ordersPage <= 0}
                onClick={() => setOrdersPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <span>Página {Math.min(ordersPage, ordersTotalPages - 1) + 1} de {ordersTotalPages}</span>
              <button
                className="px-3 py-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
                disabled={ordersPage >= ordersTotalPages - 1}
                onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages - 1, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        )}

        {activeTab === "paymentTerms" && (
          <div className="border rounded bg-white overflow-hidden">
            <div className="px-3 py-2 border-b bg-gray-50 flex items-center">
              <div className="text-sm text-gray-700">Condições vinculadas ao cliente</div>
              <div className="ml-auto text-xs text-gray-500">{paymentTerms.length} registro(s)</div>
            </div>
            <div className="sm:hidden divide-y">
              {paymentTermsView.map((pt) => (
                <div key={pt.id} className="p-3">
                  <div className="text-sm font-semibold text-gray-900">{pt.description}</div>
                  <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="font-mono">Código: {pt.code != null ? pt.code : '-'}</span>
                    <span>Parcelas: {pt.installments != null ? pt.installments : '-'}</span>
                  </div>
                </div>
              ))}
              {paymentTerms.length === 0 && <div className="p-3 text-gray-500 text-sm">Sem condições</div>}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left">Parcelas</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentTerms.length === 0 && (
                    <tr><td className="p-3 text-gray-500" colSpan={3}>Sem condições</td></tr>
                  )}
                  {paymentTermsView.map((pt) => (
                    <tr key={pt.id} className="border-t">
                      <td className="p-2">{pt.code != null ? pt.code : '-'}</td>
                      <td className="p-2">{pt.description}</td>
                      <td className="p-2">{pt.installments != null ? pt.installments : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-600">
              <button
                className="px-3 py-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
                disabled={paymentTermsPage <= 0}
                onClick={() => setPaymentTermsPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <span>Página {Math.min(paymentTermsPage, paymentTermsTotalPages - 1) + 1} de {paymentTermsTotalPages}</span>
              <button
                className="px-3 py-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
                disabled={paymentTermsPage >= paymentTermsTotalPages - 1}
                onClick={() => setPaymentTermsPage((p) => Math.min(paymentTermsTotalPages - 1, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        )}

        {activeTab === "linkedItems" && (
          <div className="border rounded bg-white overflow-hidden">
            <div className="px-3 py-2 border-b bg-gray-50 flex items-center">
              <div className="text-sm text-gray-700">Itens vinculados ao cliente</div>
              <div className="ml-auto text-xs text-gray-500">{linkedItems.length} registro(s)</div>
            </div>
            <div className="sm:hidden divide-y">
              {linkedItemsView.map((it, i) => (
                <div key={i} className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 break-words">{it.name}</div>
                      <div className="mt-1 text-xs text-gray-600 font-mono">{it.sku || '-'}</div>
                      <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                        <span>Larg: {it.width || '-'}</span>
                        <span>Compr: {it.length || '-'}</span>
                        <span>Gram: {it.grammage || '-'}</span>
                        <span>Un: {it.unit || '-'}</span>
                      </div>
                      <div className="mt-2 flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {(it.unitPrice ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <button
                          className="ml-auto px-3 py-2 text-xs border rounded"
                          title="Adicionar ao carrinho"
                          aria-label="Adicionar ao carrinho"
                          onClick={() => addToCart(it.id)}
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {linkedItems.length === 0 && <div className="p-3 text-gray-500 text-sm">Sem itens</div>}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-left">SKU</th>
                    <th className="p-2 text-left">Larg.</th>
                    <th className="p-2 text-left">Compr.</th>
                    <th className="p-2 text-left">Gram.</th>
                    <th className="p-2 text-left">Un.</th>
                    <th className="p-2 text-left">Preço Unit R$</th>
                    <th className="p-2 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedItems.length === 0 && (
                    <tr><td className="p-3 text-gray-500" colSpan={8}>Sem itens</td></tr>
                  )}
                  {linkedItemsView.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{it.name}</td>
                      <td className="p-2">{it.sku || '-'}</td>
                      <td className="p-2">{it.width || '-'}</td>
                      <td className="p-2">{it.length || '-'}</td>
                      <td className="p-2">{it.grammage || '-'}</td>
                      <td className="p-2">{it.unit || '-'}</td>
                      <td className="p-2">{(it.unitPrice ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="p-2">
                        <button className="inline-flex items-center justify-center w-8 h-8 border rounded hover:bg-gray-100" title="Adicionar ao carrinho" aria-label="Adicionar ao carrinho" onClick={() => addToCart(it.id)}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6.2 6l-.9-2H1V2h4.1l1.7 4H21l-2 7H8.1l-1 2H19v2H6a1 1 0 0 1-.9-.6L2 6h4.2Z"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-600">
              <button
                className="px-3 py-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
                disabled={linkedItemsPage <= 0}
                onClick={() => setLinkedItemsPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <span>Página {Math.min(linkedItemsPage, linkedItemsTotalPages - 1) + 1} de {linkedItemsTotalPages}</span>
              <button
                className="px-3 py-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
                disabled={linkedItemsPage >= linkedItemsTotalPages - 1}
                onClick={() => setLinkedItemsPage((p) => Math.min(linkedItemsTotalPages - 1, p + 1))}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      
      {/* Modal de itens */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-2xl rounded shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center">
              <div className="font-semibold">Itens do pedido {selected.code || selected.id}</div>
              <button className="ml-auto text-gray-500 hover:text-black" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
            </div>
            <div className="p-4">
              <div className="sm:hidden divide-y border rounded overflow-hidden">
                {(selected.items || []).map((it) => (
                  <div key={it.id} className="p-3">
                    <div className="text-sm font-semibold text-gray-900 break-words">{it.name}</div>
                    <div className="mt-1 text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Qtd: {it.quantity}</span>
                      <span>Desc: {it.discountPct}%</span>
                      <span className="ml-auto font-medium text-gray-900">
                        {it.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                ))}
                {(selected.items || []).length === 0 && (
                  <div className="p-3 text-center text-gray-500 text-sm">Sem itens</div>
                )}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-700">
                      <th className="text-left px-2 py-1">Item</th>
                      <th className="text-right px-2 py-1">Qtd</th>
                      <th className="text-right px-2 py-1">Preço</th>
                      <th className="text-right px-2 py-1">Desc (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.items || []).map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="px-2 py-1">{it.name}</td>
                        <td className="px-2 py-1 text-right">{it.quantity}</td>
                        <td className="px-2 py-1 text-right">{it.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-2 py-1 text-right">{it.discountPct}%</td>
                      </tr>
                    ))}
                    {(selected.items || []).length === 0 && (
                      <tr><td colSpan={4} className="px-2 py-2 text-center text-gray-500">Sem itens</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-4 py-3 border-t text-right">
              <button className="px-3 py-1.5 border rounded hover:bg-gray-100" onClick={() => setSelected(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
