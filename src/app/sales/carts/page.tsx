"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CartItem = { 
    id: number;
    inventoryItemId: number; 
    quantity: number; 
    unitPrice: number;
    inventoryItem: {
        id: number;
        sku?: string | null;
        name: string;
        unit?: string | null;
    }
};

type ClientWithCart = {
    id: number;
    name: string;
    doc?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cartItems: CartItem[];
};

export default function SalesCartsPage() {
    const [clients, setClients] = useState<ClientWithCart[]>([]);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);
    const router = useRouter();

    const loadCarts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sales/representative/carts', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setClients(Array.isArray(data) ? data : []);
            } else {
                setClients([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCarts();
    }, []);

    const generateOrder = async (clientId: number) => {
        if (!confirm('Deseja gerar um pedido para este cliente?')) return;
        try {
            const res = await fetch('/api/sales/orders/from-cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId })
            });
            if (res.ok) {
                const order = await res.json();
                alert(`Pedido ${order.code} gerado com sucesso!`);
                loadCarts(); 
            } else {
                const d = await res.json();
                alert(d.error || 'Erro ao gerar pedido');
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    const clearAllCarts = async () => {
        if (!confirm('Confirma limpar todos os carrinhos?')) return;
        setClearing(true);
        try {
            const res = await fetch('/api/sales/representative/carts', { method: 'DELETE' });
            if (!res.ok) {
                const d = await res.json().catch(() => ({} as any));
                throw new Error(d?.error || 'Erro ao limpar carrinhos');
            }
            await loadCarts();
            window.dispatchEvent(new Event('cart-count-refresh'));
        } catch (e: any) {
            alert(e?.message || String(e));
        } finally {
            setClearing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Vendas • Carrinhos dos Clientes</h1>
                <div className="flex items-center gap-2">
                    <button className="px-3 py-2 border rounded bg-white hover:bg-gray-50 disabled:opacity-50" disabled={loading || clearing} onClick={clearAllCarts}>
                        {clearing ? 'Limpando...' : 'Limpar Carrinho'}
                    </button>
                    <button className="px-3 py-2 border rounded" onClick={() => router.back()}>Voltar</button>
                </div>
            </div>

            {loading && <div className="text-gray-600">Carregando...</div>}
            
            {!loading && clients.length === 0 && (
                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded border">
                    Nenhum carrinho ativo encontrado.
                </div>
            )}

            <div className="grid gap-6">
                {clients.map(client => (
                    <div key={client.id} className="bg-white border rounded shadow-sm overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
                            <div>
                                <h2 className="font-semibold text-lg">{client.name}</h2>
                                <div className="text-sm text-gray-600 flex gap-4 mt-1">
                                    <span>{client.doc || 'Sem DOC'}</span>
                                    <span>{client.cidade || '-'}/{client.estado || '-'}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => router.push(`/sales/clients/${client.id}`)}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border rounded hover:bg-gray-50"
                                >
                                    Ver Detalhes
                                </button>
                                <button 
                                    onClick={() => generateOrder(client.id)}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                                >
                                    Gerar Pedido
                                </button>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b">
                                        <th className="p-3 text-left font-medium text-gray-600">Item</th>
                                        <th className="p-3 text-left font-medium text-gray-600">SKU</th>
                                        <th className="p-3 text-left font-medium text-gray-600">Un.</th>
                                        <th className="p-3 text-left font-medium text-gray-600">Qtd</th>
                                        <th className="p-3 text-left font-medium text-gray-600">Preço Unit</th>
                                        <th className="p-3 text-left font-medium text-gray-600">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {client.cartItems.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="p-3">{item.inventoryItem?.name || 'Item'}</td>
                                            <td className="p-3 text-gray-600">{item.inventoryItem?.sku || '-'}</td>
                                            <td className="p-3 text-gray-600">{item.inventoryItem?.unit || '-'}</td>
                                            <td className="p-3 font-medium">{item.quantity}</td>
                                            <td className="p-3">{(item.unitPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="p-3 font-medium">
                                                {((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
