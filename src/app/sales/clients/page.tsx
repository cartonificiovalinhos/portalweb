"use client";
import React, { useEffect, useMemo, useState } from "react";
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
  titlesDue?: number;
  titlesOverdue?: number;
};

type SortKey = "doc" | "abbrevName" | "name" | "titlesDue" | "titlesOverdue" | "cidade" | "estado";
type SortDirection = "asc" | "desc";

function maskDoc(doc?: string | null): string {
  const d = String(doc || "").replace(/\D+/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return d;
}

function fmtCurrency(value?: number | null): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizeText(value?: string | null): string {
  return String(value || "").trim().toLocaleLowerCase("pt-BR");
}

export default function SalesClientsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const openClient = (id: number) => {
    router.push(`/sales/clients/${id}`);
  };

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      let compare = 0;
      switch (sortKey) {
        case "doc":
          compare = normalizeText(a.doc).localeCompare(normalizeText(b.doc), "pt-BR", { numeric: true });
          break;
        case "abbrevName":
          compare = normalizeText(a.abbrevName).localeCompare(normalizeText(b.abbrevName), "pt-BR", { numeric: true });
          break;
        case "name":
          compare = normalizeText(a.name).localeCompare(normalizeText(b.name), "pt-BR", { numeric: true });
          break;
        case "titlesDue":
          compare = Number(a.titlesDue ?? 0) - Number(b.titlesDue ?? 0);
          break;
        case "titlesOverdue":
          compare = Number(a.titlesOverdue ?? 0) - Number(b.titlesOverdue ?? 0);
          break;
        case "cidade":
          compare = normalizeText(a.cidade).localeCompare(normalizeText(b.cidade), "pt-BR", { numeric: true });
          break;
        case "estado":
          compare = normalizeText(a.estado).localeCompare(normalizeText(b.estado), "pt-BR", { numeric: true });
          break;
      }
      return sortDirection === "asc" ? compare : -compare;
    });
    return sorted;
  }, [items, sortDirection, sortKey]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, client) => {
        acc.titlesDue += Number(client.titlesDue ?? 0);
        acc.titlesOverdue += Number(client.titlesOverdue ?? 0);
        return acc;
      },
      { titlesDue: 0, titlesOverdue: 0 }
    );
  }, [items]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const SortArrow = ({ column }: { column: SortKey }) => {
    const isActive = sortKey === column;
    const arrow = !isActive ? "↕" : sortDirection === "asc" ? "↑" : "↓";
    return <span className={`text-xs ${isActive ? "text-blue-600" : "text-gray-400"}`}>{arrow}</span>;
  };

  const SortHeader = ({
    column,
    label,
    align = "left",
  }: {
    column: SortKey;
    label: string;
    align?: "left" | "right";
  }) => (
    <th className={`p-2 font-medium text-gray-600 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 hover:text-blue-600 ${align === "right" ? "justify-end w-full" : ""}`}
        onClick={() => toggleSort(column)}
      >
        <span>{label}</span>
        <SortArrow column={column} />
      </button>
    </th>
  );

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:max-w-2xl xl:ml-auto">
        <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Títulos a Vencer</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{fmtCurrency(totals.titlesDue)}</div>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Títulos Vencidos</div>
          <div className="mt-1 text-2xl font-semibold text-red-600">{fmtCurrency(totals.titlesOverdue)}</div>
        </div>
      </div>

      <div className="border rounded bg-white shadow-sm overflow-hidden">
        <div className="sm:hidden divide-y">
          {sortedItems.map((c) => (
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
                  <div className="text-sm font-semibold text-gray-900 break-words">{(c.abbrevName || "").trim() || c.name}</div>
                  {Boolean((c.abbrevName || "").trim()) && (
                    <div className="mt-1 text-xs text-gray-600 break-words">{c.name}</div>
                  )}
                  <div className="mt-1 text-xs text-gray-600 font-mono">{maskDoc(c.doc) || "-"}</div>
                  <div className="mt-1 text-xs text-gray-600">
                    {(c.cidade || "-")}{c.estado ? ` • ${c.estado}` : ""}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                    <span>Tít. a Vencer: {fmtCurrency(c.titlesDue)}</span>
                    <span>Tít. Vencidos: {fmtCurrency(c.titlesOverdue)}</span>
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
                <SortHeader column="doc" label="Doc" />
                <SortHeader column="abbrevName" label="Nome Abreviado" />
                <SortHeader column="name" label="Nome" />
                <SortHeader column="titlesDue" label="Títulos a Vencer" align="right" />
                <SortHeader column="titlesOverdue" label="Títulos Vencidos" align="right" />
                <SortHeader column="cidade" label="Cidade" />
                <SortHeader column="estado" label="Estado" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedItems.map((c) => (
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
                  <td className="p-2 text-gray-700">{c.abbrevName || "-"}</td>
                  <td className="p-2 text-gray-900 font-medium">{c.name}</td>
                  <td className="p-2 text-right text-gray-700 whitespace-nowrap">{fmtCurrency(c.titlesDue)}</td>
                  <td className="p-2 text-right text-red-600 whitespace-nowrap">{fmtCurrency(c.titlesOverdue)}</td>
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
