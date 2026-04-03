"use client";
import React, { useEffect, useMemo, useState } from "react";

type PaymentTerm = { id: number; code: number | null; description: string; installments: number };

export default function PaymentTermsPage() {
  const [items, setItems] = useState<PaymentTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Form state
  const [editId, setEditId] = useState<number | null>(null);
  const [code, setCode] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [installments, setInstallments] = useState<string>("1");

  const filtered = useMemo(() => items, [items]);

  const load = async (query?: string) => {
    setLoading(true); setErr(null);
    try {
      const url = query && query.trim() ? `/api/base/payment-terms?q=${encodeURIComponent(query.trim())}` : "/api/base/payment-terms";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditId(null); setCode(""); setDescription(""); setInstallments("1");
  };

  const startEdit = (pt: PaymentTerm) => {
    setEditId(pt.id);
    setCode(pt.code != null ? String(pt.code) : "");
    setDescription(pt.description || "");
    setInstallments(String(pt.installments ?? 1));
  };

  const save = async () => {
    setLoading(true); setErr(null);
    try {
      const payload: any = {
        code: code.trim() ? Number(code) : null,
        description: description.trim(),
        installments: installments.trim() ? Number(installments) : 1,
      };
      if (!payload.description) throw new Error("Descrição é obrigatória");
      let res: Response;
      if (editId) {
        res = await fetch(`/api/base/payment-terms/${editId}` , { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`/api/base/payment-terms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await load(q);
      resetForm();
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Excluir condição de pagamento?")) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/base/payment-terms/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await load(q);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Base • Condição de Pagamento</h1>

      <div className="flex gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar por descrição ou código"
          className="border rounded px-3 py-2 w-64"
        />
        <button onClick={() => load(q)} className="px-3 py-2 bg-blue-600 text-white rounded">Pesquisar</button>
        <button onClick={() => { resetForm(); }} className="px-3 py-2 bg-gray-600 text-white rounded">Novo</button>
        {loading && <span className="text-sm text-gray-600">Carregando…</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      {/* Formulário de inclusão/edição */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <div>
          <label className="block text-sm text-gray-700">Código (opcional)</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="border rounded px-3 py-2 w-full" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-700">Descrição</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="border rounded px-3 py-2 w-full" />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Parcelas</label>
          <input value={installments} onChange={(e) => setInstallments(e.target.value)} className="border rounded px-3 py-2 w-full" />
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="px-3 py-2 bg-green-600 text-white rounded">{editId ? "Salvar alterações" : "Incluir"}</button>
          {editId && <button onClick={resetForm} className="px-3 py-2 bg-gray-500 text-white rounded">Cancelar</button>}
        </div>
      </div>

      {/* Listagem */}
      <div className="border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2 w-24">Código</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-left p-2 w-24">Parcelas</th>
              <th className="text-left p-2 w-48">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((pt) => (
              <tr key={pt.id} className="border-t">
                <td className="p-2">{pt.code ?? ""}</td>
                <td className="p-2">{pt.description}</td>
                <td className="p-2">{pt.installments ?? 1}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(pt)} className="px-2 py-1 bg-yellow-600 text-white rounded">Editar</button>
                    <button onClick={() => remove(pt.id)} className="px-2 py-1 bg-red-600 text-white rounded">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td className="p-3 text-gray-500" colSpan={4}>Nenhum registro encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
