"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ClientContact = {
  id?: number;
  description: string;
  phone?: string | null;
  email?: string | null;
  isWhatsapp?: boolean;
};

type Client = {
  id: number;
  clientCode?: number | null;
  doc: string;
  name: string;
  abbrevName?: string | null;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  paymentTermId?: number | null;
  paymentTermCode?: number | null;
  paymentTermDescription?: string | null;
  paymentTermIds?: number[];
  contacts?: ClientContact[];
};

type PaymentTerm = { id: number; code: number | null; description: string; installments?: number };

type ContactRow = {
  id?: number;
  description: string;
  value: string;
  isWhatsapp?: boolean;
};

const EMPTY_CLIENT: Client = {
  id: 0,
  clientCode: null,
  doc: "",
  name: "",
  abbrevName: "",
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  paymentTermId: null,
  contacts: [],
};

function maskDoc(doc: string): string {
  const d = (doc || "").replace(/\D+/g, "");
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return d;
}

function splitContacts(contacts?: ClientContact[] | null): { phones: ContactRow[]; emails: ContactRow[] } {
  const phones: ContactRow[] = [];
  const emails: ContactRow[] = [];

  for (const contact of contacts || []) {
    const description = String(contact.description || "").trim();
    const phone = String(contact.phone || "").trim();
    const email = String(contact.email || "").trim();

    if (phone) {
      phones.push({
        id: contact.id,
        description,
        value: phone,
        isWhatsapp: Boolean(contact.isWhatsapp),
      });
    }
    if (email) {
      emails.push({
        id: contact.id,
        description,
        value: email,
      });
    }
  }

  return { phones, emails };
}

function mergeContacts(phones: ContactRow[], emails: ContactRow[]): ClientContact[] {
  const out: ClientContact[] = [];

  phones.forEach((row, index) => {
    const value = String(row.value || "").trim();
    if (!value) return;
    out.push({
      ...(row.id ? { id: row.id } : {}),
      description: String(row.description || "").trim() || `Telefone ${index + 1}`,
      phone: value,
      email: null,
      isWhatsapp: Boolean(row.isWhatsapp),
    });
  });

  emails.forEach((row, index) => {
    const value = String(row.value || "").trim();
    if (!value) return;
    out.push({
      ...(row.id ? { id: row.id } : {}),
      description: String(row.description || "").trim() || `E-mail ${index + 1}`,
      phone: null,
      email: value,
      isWhatsapp: false,
    });
  });

  return out;
}

function emptyPhoneRow(): ContactRow {
  return { description: "", value: "", isWhatsapp: true };
}

function emptyEmailRow(): ContactRow {
  return { description: "", value: "" };
}

export default function ClientsPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<"listagem" | "manutencao">("listagem");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Client>(EMPTY_CLIENT);
  const [phoneRows, setPhoneRows] = useState<ContactRow[]>([]);
  const [emailRows, setEmailRows] = useState<ContactRow[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [ptQuery, setPtQuery] = useState<string>("");
  const [ptOpts, setPtOpts] = useState<PaymentTerm[]>([]);
  const [ptOpen, setPtOpen] = useState(false);
  const [ptLoading, setPtLoading] = useState(false);
  const [linkedPaymentTerms, setLinkedPaymentTerms] = useState<PaymentTerm[]>([]);
  const ptWrapperRef = useRef<HTMLDivElement>(null);

  const resetMaintenance = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_CLIENT);
    setPhoneRows([]);
    setEmailRows([]);
    setLinkedPaymentTerms([]);
    setPtQuery("");
    setPtOpts([]);
    setPtOpen(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = q.trim() ? `/api/base/clients?q=${encodeURIComponent(q.trim())}` : "/api/base/clients";
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/base/payment-terms");
        const data = await res.json();
        setPaymentTerms(Array.isArray(data) ? data : []);
      } catch {
        setPaymentTerms([]);
      }
    })();
  }, []);

  const paymentTermById = useMemo(() => {
    const map = new Map<number, PaymentTerm>();
    for (const pt of paymentTerms) map.set(pt.id, pt);
    return map;
  }, [paymentTerms]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ptWrapperRef.current && !ptWrapperRef.current.contains(event.target as Node)) {
        setPtOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (activeTab !== "manutencao") return;
    const term = String(ptQuery || "").trim();
    if (!term) {
      setPtOpts([]);
      setPtOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setPtLoading(true);
      try {
        const res = await fetch(`/api/base/payment-terms?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setPtOpts(Array.isArray(data) ? data.slice(0, 20) : []);
        setPtOpen(true);
      } catch {
        setPtOpts([]);
      } finally {
        setPtLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [ptQuery, activeTab]);

  const loadLinkedPaymentTerms = useCallback(async (clientId?: number | null, fallbackPaymentTermId?: number | null) => {
    if (clientId) {
      try {
        const res = await fetch(`/api/base/payment-terms?clientId=${clientId}`);
        const data = await res.json();
        const list: PaymentTerm[] = Array.isArray(data) ? data : [];
        if (list.length > 0) {
          setLinkedPaymentTerms(list);
          return;
        }
      } catch {
      }
    }

    const fallback = fallbackPaymentTermId ? paymentTermById.get(fallbackPaymentTermId) : null;
    setLinkedPaymentTerms(fallback ? [fallback] : []);
  }, [paymentTermById]);

  const openCreate = useCallback(async () => {
    resetMaintenance();
    setActiveTab("manutencao");
    await loadLinkedPaymentTerms(null, null);
  }, [loadLinkedPaymentTerms, resetMaintenance]);

  const openEdit = useCallback(async (id: number) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await fetch(`/api/base/clients/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || "Falha ao carregar cliente");

      setEditingId(id);
      setForm({
        id: data.id,
        clientCode: data.clientCode ?? null,
        doc: data.doc || "",
        name: data.name || "",
        abbrevName: data.abbrevName || "",
        cep: data.cep || "",
        logradouro: data.logradouro || "",
        numero: data.numero || "",
        bairro: data.bairro || "",
        cidade: data.cidade || "",
        estado: data.estado || "",
        paymentTermId: data.paymentTermId ?? null,
        paymentTermCode: data.paymentTermCode ?? null,
        paymentTermDescription: data.paymentTermDescription ?? null,
        contacts: Array.isArray(data.contacts) ? data.contacts : [],
      });

      const split = splitContacts(Array.isArray(data.contacts) ? data.contacts : []);
      setPhoneRows(split.phones);
      setEmailRows(split.emails);
      await loadLinkedPaymentTerms(data.id, data.paymentTermId ?? null);
      setActiveTab("manutencao");
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setLoadingDetail(false);
    }
  }, [loadLinkedPaymentTerms]);

  const onSave = async () => {
    try {
      setSaving(true);
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/base/clients/${editingId}` : "/api/base/clients";
      const payload: Client = {
        ...form,
        paymentTermId: linkedPaymentTerms[0]?.id ?? null,
        paymentTermCode: linkedPaymentTerms[0]?.code ?? null,
        paymentTermDescription: linkedPaymentTerms[0]?.description ?? null,
        paymentTermIds: linkedPaymentTerms.map((pt) => pt.id),
        contacts: mergeContacts(phoneRows, emailRows),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || (editingId ? "Falha ao salvar alterações" : "Falha ao incluir cliente"));

      resetMaintenance();
      setActiveTab("listagem");
      await load();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Excluir este cliente?")) return;
    try {
      const res = await fetch(`/api/base/clients/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Falha ao excluir");
      await load();
    } catch (err: any) {
      alert(String(err?.message || err));
    }
  };

  const lookupDoc = async () => {
    const doc = (form.doc || "").replace(/\D+/g, "");
    if (doc.length === 14) {
      try {
        const r = await fetch(`/api/cnpj?cnpj=${doc}`);
        const j = await r.json();
        setForm((prev) => ({
          ...prev,
          name: j?.name ?? prev.name,
          logradouro: j?.logradouro ?? prev.logradouro,
          numero: j?.numero ? String(j.numero) : prev.numero,
          bairro: j?.bairro ?? prev.bairro,
          cidade: j?.cidade ?? prev.cidade,
          estado: j?.estado ?? prev.estado,
          cep: j?.cep ? String(j.cep).replace(/\D+/g, "") : prev.cep,
        }));
      } catch {
      }
    }
  };

  const lookupCep = async () => {
    const cep = (form.cep || "").replace(/\D+/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (!j?.erro) {
        setForm((prev) => ({
          ...prev,
          logradouro: j.logradouro || prev.logradouro,
          bairro: j.bairro || prev.bairro,
          cidade: j.localidade || prev.cidade,
          estado: j.uf || prev.estado,
        }));
      }
    } catch {
    }
  };

  const updatePhoneRow = (index: number, patch: Partial<ContactRow>) => {
    setPhoneRows((prev) => prev.map((row, current) => (current === index ? { ...row, ...patch } : row)));
  };

  const updateEmailRow = (index: number, patch: Partial<ContactRow>) => {
    setEmailRows((prev) => prev.map((row, current) => (current === index ? { ...row, ...patch } : row)));
  };

  const maintenanceTitle = editingId ? "Manutenção de Cliente" : "Inclusão de Cliente";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
      </div>

      <div className="border rounded bg-white">
        <div className="border-b px-3 py-2 flex gap-2">
          <button
            type="button"
            className={`px-3 py-2 rounded text-sm ${activeTab === "listagem" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            onClick={() => setActiveTab("listagem")}
          >
            Listagem
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded text-sm ${activeTab === "manutencao" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            onClick={() => setActiveTab("manutencao")}
          >
            Manutenção
          </button>
        </div>

        {activeTab === "listagem" && (
          <div className="p-3 space-y-4">
            <div className="flex gap-2 items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, cidade ou estado"
                className="border px-3 py-2 rounded w-96"
              />
              <button onClick={load} className="px-3 py-2 bg-blue-600 text-white rounded">Buscar</button>
              <button onClick={() => void openCreate()} className="ml-auto px-3 py-2 bg-green-600 text-white rounded">
                Incluir Cliente
              </button>
            </div>

            <div className="border rounded overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-2">Doc</th>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">Cidade</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-left p-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2">{maskDoc(c.doc || "")}</td>
                      <td className="p-2">{c.name}</td>
                      <td className="p-2">{c.cidade || ""}</td>
                      <td className="p-2">{c.estado || ""}</td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <button onClick={() => void openEdit(c.id)} className="px-2 py-1 bg-yellow-500 text-white rounded">
                            Editar
                          </button>
                          <button onClick={() => void onDelete(c.id)} className="px-2 py-1 bg-red-600 text-white rounded">
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <div className="p-2 text-gray-600">Carregando...</div>}
              {error && <div className="p-2 text-red-600">{error}</div>}
              {!loading && !error && items.length === 0 && <div className="p-2 text-gray-600">Nenhum cliente encontrado</div>}
            </div>
          </div>
        )}

        {activeTab === "manutencao" && (
          <div className="p-3 space-y-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{maintenanceTitle}</div>
                <div className="text-sm text-gray-600">
                  {editingId ? `Editando cliente ID ${editingId}` : "Preencha os dados do cliente e seus contatos."}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void openCreate()} className="px-3 py-2 bg-green-600 text-white rounded">
                  Novo Cliente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetMaintenance();
                    setActiveTab("listagem");
                  }}
                  className="px-3 py-2 bg-gray-300 text-gray-900 rounded"
                >
                  Voltar para Listagem
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="border rounded bg-white p-4 text-sm text-gray-600">Carregando cliente...</div>
            ) : (
              <div className="border rounded p-3 space-y-3 bg-white">
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                    <label className="text-sm text-gray-700">Cód Cliente</label>
                    <input
                      value={form.clientCode ?? ""}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D+/g, "");
                        setForm((prev) => ({ ...prev, clientCode: digits ? Number(digits) : null }));
                      }}
                      placeholder="Somente números"
                      className="border px-3 py-2 rounded w-full"
                    />
                  </div>

                  <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                    <label className="text-sm text-gray-700">Nome Abreviado</label>
                    <input
                      value={form.abbrevName || ""}
                      maxLength={20}
                      onChange={(e) => setForm((prev) => ({ ...prev, abbrevName: e.target.value }))}
                      className="border px-3 py-2 rounded w-full"
                    />
                  </div>

                  <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                    <label className="text-sm text-gray-700">Cnpj/Cpf</label>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col flex-1 min-w-0">
                        <input
                          value={form.doc || ""}
                          onChange={(e) => setForm((prev) => ({ ...prev, doc: e.target.value }))}
                          placeholder="Somente números"
                          className="border px-3 py-2 rounded w-full"
                        />
                        <span className="text-xs text-gray-500">{maskDoc(form.doc || "")}</span>
                      </div>
                      <button onClick={lookupDoc} className="px-3 py-2 bg-gray-800 text-white rounded">Buscar</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                    <label className="text-sm text-gray-700">Nome</label>
                    <input
                      value={form.name || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="border px-3 py-2 rounded w-full"
                    />
                  </div>

                  <div className="grid grid-cols-[160px_1fr] items-start gap-3">
                    <label className="text-sm text-gray-700 pt-2">Condições de pagamento</label>
                    <div ref={ptWrapperRef} className="relative">
                      <input
                        value={ptQuery}
                        onChange={(e) => {
                          setPtQuery(e.target.value);
                          setPtOpen(true);
                        }}
                        onFocus={() => {
                          if (ptOpts.length > 0) setPtOpen(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => setPtOpen(false), 150);
                        }}
                        placeholder="Digite o código ou descrição e selecione"
                        className="border px-3 py-2 rounded w-full"
                      />
                      {ptOpen && (ptLoading || ptOpts.length > 0) && (
                        <div className="absolute z-20 mt-1 w-full bg-white border rounded shadow max-h-56 overflow-auto">
                          {ptLoading && <div className="px-3 py-2 text-sm text-gray-500">Buscando...</div>}
                          {!ptLoading && ptOpts.map((pt) => (
                            <div
                              key={pt.id}
                              className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setLinkedPaymentTerms((prev) => {
                                  if (prev.some((x) => x.id === pt.id)) return prev;
                                  return [...prev, pt];
                                });
                                setForm((prev) => ({
                                  ...prev,
                                  paymentTermId: prev.paymentTermId ?? pt.id,
                                  paymentTermCode: prev.paymentTermCode ?? pt.code,
                                  paymentTermDescription: prev.paymentTermDescription ?? pt.description,
                                }));
                                setPtQuery("");
                                setPtOpen(false);
                              }}
                            >
                              <div className="text-sm font-medium">{pt.description}</div>
                              <div className="text-xs text-gray-500">
                                Cód: {pt.code ?? "-"}{pt.installments != null ? ` • Parcelas: ${pt.installments}` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {linkedPaymentTerms.length > 0 && (
                        <div className="mt-2 border rounded bg-white overflow-hidden">
                          {linkedPaymentTerms.map((pt, index) => (
                            <div key={pt.id} className="px-3 py-2 border-t first:border-t-0 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{pt.description}</div>
                                <div className="text-xs text-gray-500">Cód: {pt.code ?? "-"}</div>
                              </div>
                              <button
                                type="button"
                                className="px-2 py-1 border rounded text-sm bg-white hover:bg-gray-50"
                                onClick={() => {
                                  setLinkedPaymentTerms((prev) => prev.filter((x) => x.id !== pt.id));
                                  if (index === 0) {
                                    const next = linkedPaymentTerms.filter((x) => x.id !== pt.id);
                                    setForm((prev) => ({
                                      ...prev,
                                      paymentTermId: next[0]?.id ?? null,
                                      paymentTermCode: next[0]?.code ?? null,
                                      paymentTermDescription: next[0]?.description ?? null,
                                    }));
                                  }
                                }}
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                    <label className="text-sm text-gray-700">CEP</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={form.cep || ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, cep: e.target.value }))}
                        className="border px-3 py-2 rounded w-full"
                      />
                      <button onClick={lookupCep} className="px-3 py-2 bg-gray-800 text-white rounded">Buscar</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                      <label className="text-sm text-gray-700">Logradouro</label>
                      <input value={form.logradouro || ""} onChange={(e) => setForm((prev) => ({ ...prev, logradouro: e.target.value }))} className="border px-3 py-2 rounded w-full" />
                    </div>
                    <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                      <label className="text-sm text-gray-700">Numero</label>
                      <input value={form.numero || ""} onChange={(e) => setForm((prev) => ({ ...prev, numero: e.target.value }))} className="border px-3 py-2 rounded w-full" />
                    </div>
                    <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                      <label className="text-sm text-gray-700">Bairro</label>
                      <input value={form.bairro || ""} onChange={(e) => setForm((prev) => ({ ...prev, bairro: e.target.value }))} className="border px-3 py-2 rounded w-full" />
                    </div>
                    <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                      <label className="text-sm text-gray-700">Cidade</label>
                      <input value={form.cidade || ""} onChange={(e) => setForm((prev) => ({ ...prev, cidade: e.target.value }))} className="border px-3 py-2 rounded w-full" />
                    </div>
                    <div className="grid grid-cols-[160px_1fr] items-center gap-3">
                      <label className="text-sm text-gray-700">Estado</label>
                      <input value={form.estado || ""} onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))} className="border px-3 py-2 rounded w-full" />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">Telefones do Cliente</div>
                      <div className="text-sm text-gray-600">Informe um ou mais telefones.</div>
                    </div>
                    <button type="button" className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => setPhoneRows((prev) => [...prev, emptyPhoneRow()])}>
                      Adicionar Telefone
                    </button>
                  </div>

                  {phoneRows.length === 0 && (
                    <div className="text-sm text-gray-500 border rounded p-3 bg-gray-50">Nenhum telefone informado.</div>
                  )}

                  {phoneRows.map((row, index) => (
                    <div key={`phone-${row.id ?? index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 border rounded p-3">
                      <input
                        value={row.description}
                        onChange={(e) => updatePhoneRow(index, { description: e.target.value })}
                        placeholder="Descrição"
                        className="border px-3 py-2 rounded w-full"
                      />
                      <input
                        value={row.value}
                        onChange={(e) => updatePhoneRow(index, { value: e.target.value })}
                        placeholder="Telefone"
                        className="border px-3 py-2 rounded w-full"
                      />
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={Boolean(row.isWhatsapp)}
                          onChange={(e) => updatePhoneRow(index, { isWhatsapp: e.target.checked })}
                        />
                        WhatsApp
                      </label>
                      <button
                        type="button"
                        className="px-3 py-2 bg-red-600 text-white rounded"
                        onClick={() => setPhoneRows((prev) => prev.filter((_, current) => current !== index))}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">E-mails do Cliente</div>
                      <div className="text-sm text-gray-600">Informe um ou mais e-mails.</div>
                    </div>
                    <button type="button" className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => setEmailRows((prev) => [...prev, emptyEmailRow()])}>
                      Adicionar E-mail
                    </button>
                  </div>

                  {emailRows.length === 0 && (
                    <div className="text-sm text-gray-500 border rounded p-3 bg-gray-50">Nenhum e-mail informado.</div>
                  )}

                  {emailRows.map((row, index) => (
                    <div key={`email-${row.id ?? index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 border rounded p-3">
                      <input
                        value={row.description}
                        onChange={(e) => updateEmailRow(index, { description: e.target.value })}
                        placeholder="Descrição"
                        className="border px-3 py-2 rounded w-full"
                      />
                      <input
                        value={row.value}
                        onChange={(e) => updateEmailRow(index, { value: e.target.value })}
                        placeholder="E-mail"
                        className="border px-3 py-2 rounded w-full"
                      />
                      <button
                        type="button"
                        className="px-3 py-2 bg-red-600 text-white rounded"
                        onClick={() => setEmailRows((prev) => prev.filter((_, current) => current !== index))}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={onSave} disabled={saving} className={`px-3 py-2 bg-green-600 text-white rounded ${saving ? "opacity-60 cursor-not-allowed" : ""}`}>
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    onClick={() => {
                      resetMaintenance();
                      setActiveTab("listagem");
                    }}
                    className="px-3 py-2 bg-gray-300 text-gray-900 rounded"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
