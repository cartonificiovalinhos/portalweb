"use client";
import React, { useEffect, useMemo, useState } from "react";

type CommercialFamily = {
  id: number;
  description: string;
  erpCode?: string | null;
  priceBy?: string | null;
  widthMin?: number | null;
  widthMax?: number | null;
  lengthMin?: number | null;
  lengthMax?: number | null;
};

function formatRange(min?: number | null, max?: number | null) {
  if (min == null && max == null) return "-";
  if (min != null && max != null) return `${min} a ${max}`;
  if (min != null) return `Min: ${min}`;
  return `Max: ${max}`;
}

export default function CommercialFamilyPage() {
  const [items, setItems] = useState<CommercialFamily[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Form state
  const [editId, setEditId] = useState<number | null>(null);
  const [description, setDescription] = useState<string>("");
  const [erpCode, setErpCode] = useState<string>("");
  const [priceBy, setPriceBy] = useState<'UNIT' | 'WEIGHT'>('UNIT');
  const [widthMin, setWidthMin] = useState<string>("");
  const [widthMax, setWidthMax] = useState<string>("");
  const [lengthMin, setLengthMin] = useState<string>("");
  const [lengthMax, setLengthMax] = useState<string>("");

  const filtered = useMemo(() => items, [items]);

  const load = async (query?: string) => {
    setLoading(true); setErr(null);
    try {
      const url = query && query.trim() ? `/api/base/commercial-families?q=${encodeURIComponent(query.trim())}` : "/api/base/commercial-families";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditId(null);
    setDescription("");
    setErpCode("");
    setPriceBy('UNIT');
    setWidthMin("");
    setWidthMax("");
    setLengthMin("");
    setLengthMax("");
  };

  const startEdit = (cf: CommercialFamily) => {
    setEditId(cf.id);
    setDescription(cf.description || "");
    setErpCode(cf.erpCode || "");
    setPriceBy((String(cf.priceBy || '').toUpperCase() === 'WEIGHT' ? 'WEIGHT' : 'UNIT'));
    setWidthMin(cf.widthMin != null ? String(cf.widthMin) : "");
    setWidthMax(cf.widthMax != null ? String(cf.widthMax) : "");
    setLengthMin(cf.lengthMin != null ? String(cf.lengthMin) : "");
    setLengthMax(cf.lengthMax != null ? String(cf.lengthMax) : "");
  };

  const save = async () => {
    setLoading(true); setErr(null);
    try {
      const payload: any = {
        description: description.trim(),
        erpCode: erpCode.trim() || null,
        priceBy,
        widthMin: widthMin.trim() === "" ? null : Number(widthMin),
        widthMax: widthMax.trim() === "" ? null : Number(widthMax),
        lengthMin: lengthMin.trim() === "" ? null : Number(lengthMin),
        lengthMax: lengthMax.trim() === "" ? null : Number(lengthMax),
      };
      if (!payload.description) throw new Error("Descrição é obrigatória");
      if (payload.widthMin !== null && payload.widthMax !== null && payload.widthMin > payload.widthMax) {
        throw new Error("Largura Mínima não pode ser maior que Largura Máxima");
      }
      if (payload.lengthMin !== null && payload.lengthMax !== null && payload.lengthMin > payload.lengthMax) {
        throw new Error("Comprimento Mínimo não pode ser maior que Comprimento Máximo");
      }
      let res: Response;
      if (editId) {
        res = await fetch(`/api/base/commercial-families/${editId}` , { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`/api/base/commercial-families`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await load(q);
      resetForm();
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const remove = async (id: number) => {
    if (!confirm("Excluir família comercial?")) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/base/commercial-families/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await load(q);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Base • Família Comercial</h1>

      <div className="flex gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar por descrição"
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
          <label className="block text-sm text-gray-700">ID</label>
          <input value={editId ?? ''} readOnly className="border rounded px-3 py-2 w-full bg-gray-100" />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Descrição</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="border rounded px-3 py-2 w-full" />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Código ERP</label>
          <input value={erpCode} onChange={(e) => setErpCode(e.target.value)} className="border rounded px-3 py-2 w-full" />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Preço Por</label>
          <div className="flex gap-4 items-center h-[42px]">
            <label className="inline-flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name="priceBy"
                value="UNIT"
                checked={priceBy === 'UNIT'}
                onChange={() => setPriceBy('UNIT')}
              />
              Unidade
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name="priceBy"
                value="WEIGHT"
                checked={priceBy === 'WEIGHT'}
                onChange={() => setPriceBy('WEIGHT')}
              />
              Peso
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-700">Largura Mínima</label>
          <input type="number" min="0" step="1" value={widthMin} onChange={(e) => setWidthMin(e.target.value)} className="border rounded px-3 py-2 w-full" />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Largura Máxima</label>
          <input type="number" min="0" step="1" value={widthMax} onChange={(e) => setWidthMax(e.target.value)} className="border rounded px-3 py-2 w-full" />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Comprimento Mínimo</label>
          <input type="number" min="0" step="1" value={lengthMin} onChange={(e) => setLengthMin(e.target.value)} className="border rounded px-3 py-2 w-full" />
        </div>
        <div>
          <label className="block text-sm text-gray-700">Comprimento Máximo</label>
          <input type="number" min="0" step="1" value={lengthMax} onChange={(e) => setLengthMax(e.target.value)} className="border rounded px-3 py-2 w-full" />
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
              <th className="text-left p-2 w-24">ID</th>
              <th className="text-left p-2">Descrição</th>
              <th className="text-left p-2">Código ERP</th>
              <th className="text-left p-2">Preço Por</th>
              <th className="text-left p-2">Faixa Largura</th>
              <th className="text-left p-2">Faixa Comprimento</th>
              <th className="text-left p-2 w-48">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cf) => (
              <tr key={cf.id} className="border-t">
                <td className="p-2">{cf.id}</td>
                <td className="p-2">{cf.description}</td>
                <td className="p-2">{cf.erpCode || '-'}</td>
                <td className="p-2">{String(cf.priceBy || '').toUpperCase() === 'WEIGHT' ? 'Peso' : 'Unidade'}</td>
                <td className="p-2">{formatRange(cf.widthMin, cf.widthMax)}</td>
                <td className="p-2">{formatRange(cf.lengthMin, cf.lengthMax)}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(cf)} className="px-2 py-1 bg-yellow-600 text-white rounded">Editar</button>
                    <button onClick={() => remove(cf.id)} className="px-2 py-1 bg-red-600 text-white rounded">Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td className="p-3 text-gray-500" colSpan={7}>Nenhum registro encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
