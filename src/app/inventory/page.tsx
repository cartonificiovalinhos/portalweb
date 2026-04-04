"use client";
import { useEffect, useState } from "react";
import { safeParseJson } from "../../lib/safeJson";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", sku: "", quantity: 0, unit: "", minStock: 0 });

  const load = () => {
    setLoading(true);
    fetch("/api/items")
      .then((r) => safeParseJson(r, []))
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", sku: "", quantity: 0, unit: "", minStock: 0 });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventário</h1>
        <p className="text-gray-600">Controle de peças e materiais.</p>
      </div>

      <div className="bg-white shadow rounded p-4">
        <div className="font-semibold mb-2">Novo item</div>
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input className="border rounded px-3 py-2" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="border rounded px-3 py-2" placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <input className="border rounded px-3 py-2" type="number" placeholder="Quantidade" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          <input className="border rounded px-3 py-2" placeholder="Unidade" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <input className="border rounded px-3 py-2" type="number" placeholder="Estoque mínimo" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} />
          <div>
            <button className="px-4 py-2 bg-gray-800 text-white rounded">Salvar</button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow rounded p-4">
        <div className="font-semibold mb-2">Itens em estoque</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2 border-b">ID</th>
                <th className="p-2 border-b">Nome</th>
                <th className="p-2 border-b">SKU</th>
                <th className="p-2 border-b">Quantidade</th>
                <th className="p-2 border-b">Unidade</th>
                <th className="p-2 border-b">Estoque mínimo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="p-2">{a.id}</td>
                  <td className="p-2">{a.name}</td>
                  <td className="p-2">{a.sku}</td>
                  <td className="p-2">{a.quantity}</td>
                  <td className="p-2">{a.unit}</td>
                  <td className="p-2">{a.minStock}</td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={6} className="p-2 text-gray-500">Carregando...</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-2 text-gray-500">Nenhum item cadastrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
