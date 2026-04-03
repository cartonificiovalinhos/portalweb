"use client";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type OrderItem = { id: number; name: string; quantity: number; unitPrice: number; discountPct: number };
type SalesOrder = {
  id: number;
  code: string;
  status: string;
  orderDate: string;
  customerName: string;
  entity?: { name: string };
  subtotal: number;
  discountTotal: number;
  total: number;
  items?: OrderItem[];
};

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [selected, setSelected] = useState<SalesOrder | null>(null);
  const [integratingId, setIntegratingId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/sales/orders');
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(String(err?.message || err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    const ds = dateStart ? new Date(dateStart) : null;
    const de = dateEnd ? new Date(dateEnd) : null;
    return (orders || [])
      .filter((o) => (status ? statusLabelPt(o.status) === status : true))
      .filter((o) => {
        if (!qLower) return true;
        return (
          (o.code || '').toLowerCase().includes(qLower) ||
          (o.customerName || '').toLowerCase().includes(qLower)
        );
      })
      .filter((o) => {
        const d = o.orderDate ? new Date(o.orderDate) : null;
        if (!d) return true;
        if (ds && d < ds) return false;
        if (de && d > de) return false;
        return true;
      });
  }, [orders, q, status, dateStart, dateEnd]);

  const calcTotal = (o: SalesOrder) => {
    return (o.items || []).reduce((acc, item) => {
      const total = item.quantity * item.unitPrice;
      const discount = total * (item.discountPct / 100);
      return acc + (total - discount);
    }, 0);
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Venda • Consulta de Pedidos</h1>
      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-3 rounded border border-gray-200">
        <div>
          <label className="text-xs text-gray-600">Buscar (Número ou Cliente)</label>
          <input className="w-full mt-1 px-2 py-1.5 border rounded" placeholder="Ex: PED-0001 ou João" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-600">Situação</label>
          <select className="w-full mt-1 px-2 py-1.5 border rounded" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            <option value="Orçamento">Orçamento</option>
            <option value="Aguardando Integração">Aguardando Integração</option>
            <option value="Erro na integração">Erro na integração</option>
            <option value="Integrado">Integrado</option>
            <option value="Em fila produção">Em fila produção</option>
            <option value="Em produção">Em produção</option>
            <option value="Produzido/Estocado">Produzido/Estocado</option>
            <option value="Faturado">Faturado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600">Data inicial</label>
          <input type="date" className="w-full mt-1 px-2 py-1.5 border rounded" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-600">Data final</label>
          <input type="date" className="w-full mt-1 px-2 py-1.5 border rounded" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
        </div>
      </div>

      {/* Listagem */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 border-b bg-gray-50 text-sm text-gray-700 flex items-center">
          <span>Listagem de pedidos</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">{filtered.length} registro(s)</span>
            <Link href="/sales/orders/new" className="px-3 py-1.5 text-xs border rounded bg-white hover:bg-gray-100">Novo Pedido</Link>
          </div>
        </div>
        <div className="sm:hidden divide-y">
          {loading && (
            <div className="px-3 py-4 text-center text-gray-500 text-sm">Carregando...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-gray-500 text-sm">Nenhum pedido encontrado.</div>
          )}
          {!loading && filtered.map((o) => (
            <div key={o.id} className="px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-gray-700">{o.code || o.id}</div>
                  <div className="text-sm font-medium text-gray-900 truncate">{o.customerName || '-'}</div>
                  <div className="text-xs text-gray-600 truncate">{o.entity?.name || '-'}</div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs ${statusColor(statusLabelPt(o.status))}`}>{statusLabelPt(o.status)}</span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-600">
                <div>{o.orderDate ? new Date(o.orderDate).toLocaleDateString('pt-BR') : '-'}</div>
                <div className="font-medium text-gray-900">{calcTotal(o).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              </div>

              <div className="mt-2 flex items-center justify-end">
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

                        const r = await fetch('/api/sales/orders');
                        if (r.ok) {
                            const list = await r.json();
                            setOrders(Array.isArray(list) ? list : []);
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
                  <IconBtn title="Excluir" disabled={!['Orçamento', 'Erro na integração'].includes(statusLabelPt(o.status))} onClick={async () => {
                    if (!confirm('Confirma excluir este pedido?')) return;
                    try {
                      const r = await fetch(`/api/sales/orders/${o.id}`, { method: 'DELETE' });
                      if (!r.ok) throw new Error('Falha ao excluir pedido');
                      setOrders((prev) => prev.filter((so) => so.id !== o.id));
                    } catch (e: any) { alert(e?.message || String(e)); }
                  }}>
                    <TrashIcon />
                  </IconBtn>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="text-left px-3 py-2">Número</th>
                <th className="text-left px-3 py-2">Entidade</th>
                <th className="text-left px-3 py-2">Cliente</th>
                <th className="text-left px-3 py-2">Data</th>
                <th className="text-right px-3 py-2">Total Com Imp R$</th>
                <th className="text-left px-3 py-2">Situação</th>
                <th className="text-center px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">Nenhum pedido encontrado.</td></tr>
              )}
              {!loading && filtered.map((o) => (
                <tr key={o.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{o.code || o.id}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{o.entity?.name || '-'}</td>
                  <td className="px-3 py-2">{o.customerName || '-'}</td>
                  <td className="px-3 py-2">{o.orderDate ? new Date(o.orderDate).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="px-3 py-2 text-right">
                    {calcTotal(o).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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

                            // Reload
                            const r = await fetch('/api/sales/orders');
                            if (r.ok) {
                                const list = await r.json();
                                setOrders(Array.isArray(list) ? list : []);
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
                      <IconBtn title="Excluir" disabled={!['Orçamento', 'Erro na integração'].includes(statusLabelPt(o.status))} onClick={async () => {
                        if (!confirm('Confirma excluir este pedido?')) return;
                        try {
                          const r = await fetch(`/api/sales/orders/${o.id}`, { method: 'DELETE' });
                          if (!r.ok) throw new Error('Falha ao excluir pedido');
                          setOrders((prev) => prev.filter((so) => so.id !== o.id));
                        } catch (e: any) { alert(e?.message || String(e)); }
                      }}>
                        <TrashIcon />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de itens */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-2xl rounded shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center">
              <div className="font-semibold">Itens do pedido {selected.code || selected.id}</div>
              <button className="ml-auto text-gray-500 hover:text-black" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
            </div>
            <div className="p-4">
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
            <div className="px-4 py-3 border-t text-right">
              <button className="px-3 py-1.5 border rounded hover:bg-gray-100" onClick={() => setSelected(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
