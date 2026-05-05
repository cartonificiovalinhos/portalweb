"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: number;
  doc?: string | null;
  name: string;
  abbrevName?: string | null;
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
  const openClient = (id: number) => {
    router.push(`/sales/clients/${id}`);
  };

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
    <div className="space-y-4">
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
        <div className="sm:hidden divide-y">
          {items.map((c) => (
            <div
              key={c.id}
              className="p-2 cursor-pointer hover:bg-blue-50 transition-colors"
              role="button"
              tabIndex={0}
              onClick={() => openClient(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openClient(c.id);
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 break-words">{c.name}</div>
                  <div className="mt-1 text-xs text-gray-600">{c.abbrevName || "-"}</div>
                  <div className="mt-1 text-xs text-gray-600 font-mono">{maskDoc(c.doc) || "-"}</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {(c.cidade || "-")}{c.estado ? ` • ${c.estado}` : ""}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-2 font-medium text-gray-600">Doc</th>
                <th className="text-left p-2 font-medium text-gray-600">Nome</th>
                <th className="text-left p-2 font-medium text-gray-600">Nome Abreviado</th>
                <th className="text-left p-2 font-medium text-gray-600">Cidade</th>
                <th className="text-left p-2 font-medium text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-blue-50 transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => openClient(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openClient(c.id);
                  }}
                >
                  <td className="p-2 text-gray-700 font-mono text-xs">{maskDoc(c.doc)}</td>
                  <td className="p-2 text-gray-900 font-medium">{c.name}</td>
                  <td className="p-2 text-gray-700">{c.abbrevName || "-"}</td>
                  <td className="p-2 text-gray-600">{c.cidade || "-"}</td>
                  <td className="p-2 text-gray-600">{c.estado || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <div className="p-4 text-center text-gray-500 text-sm">Carregando...</div>}
        {error && <div className="p-4 text-center text-red-600 text-sm">{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">Nenhum cliente encontrado</div>
        )}
      </div>
    </div>
  );
}
