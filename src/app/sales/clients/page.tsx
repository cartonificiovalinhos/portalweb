"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
};

function maskDoc(doc?: string | null): string {
  const d = String(doc || "").replace(/\D+/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d;
}

export default function SalesClientsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = query.trim() ? `/api/base/clients?q=${encodeURIComponent(query.trim())}` : "/api/base/clients";
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      load(q);
    }, 500);
    return () => clearTimeout(handler);
  }, [q]);

  return (
    <div className="p-3 space-y-4">
      <h1 className="text-xl font-semibold">Força de Vendas • Clientes</h1>

      <div className="flex gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, cidade, UF, doc ou ID"
          className="border px-3 py-2 rounded w-full max-w-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="border rounded bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">Doc</th>
              <th className="text-left p-3 font-medium text-gray-600">Nome</th>
              <th className="text-left p-3 font-medium text-gray-600">Cidade</th>
              <th className="text-left p-3 font-medium text-gray-600">Estado</th>
              <th className="text-center p-3 font-medium text-gray-600 w-20">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-blue-50 transition-colors">
                <td className="p-3 text-gray-700 font-mono text-xs">{maskDoc(c.doc)}</td>
                <td className="p-3 text-gray-900 font-medium">{c.name}</td>
                <td className="p-3 text-gray-600">{c.cidade || "-"}</td>
                <td className="p-3 text-gray-600">{c.estado || "-"}</td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => router.push(`/sales/clients/${c.id}`)}
                    className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                    title="Abrir detalhes"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="p-4 text-center text-gray-500 text-sm">Carregando...</div>}
        {error && <div className="p-4 text-center text-red-600 text-sm">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">Nenhum cliente encontrado</div>
        )}
      </div>
    </div>
  );
}
