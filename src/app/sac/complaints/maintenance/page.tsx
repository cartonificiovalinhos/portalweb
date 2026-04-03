"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Item = {
  invoiceNumber?: string; sft?: string; orderNumber?: string; spd?: string; emissionDate?: string;
  description?: string; uom?: string; unitPrice?: number; qtyInvoiced?: number; divergenceNF?: number;
  divergenceValue?: number; divergencePercent?: number; totalPercent?: number;
};

export default function ComplaintMaintenancePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<any>({
    division: "", type: "Externo", phase: "ANALISE DA CAUSA",
    dueDate: "", dateSac: "", dateReceived: "",
    counterpartyType: "CLIENTE", counterpartyCode: "", counterpartyName: "",
    city: "", uf: "", contactName: "", contactPhone: "", contactEmail: "",
    representativeName: "", representativeEmail: "", carrier: "", freightType: "Retira",
    attendant: "", reference: "", classification: "", occurrencePattern: "", occurrenceCode: "",
    occurrenceText: "",
  });
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sugestões abaixo do campo (autocomplete)
  const [clientList, setClientList] = useState<any[]>([]);
  const [showClientSug, setShowClientSug] = useState(false);

  // Ocorrência Padrão autocomplete
  const [occList, setOccList] = useState<any[]>([]);
  const [showOccSug, setShowOccSug] = useState(false);

  // Famílias comerciais para o campo Divisão
  const [families, setFamilies] = useState<{ id: number; description: string }[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/base/commercial-families', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((arr) => {
        const list = Array.isArray(arr) ? arr : [];
        setFamilies(list);
        if (!form.division && list.length > 0) {
          setForm((f: any) => ({ ...f, division: list[0].description }));
        }
      })
      .catch(() => {})
      .finally(() => {});
    return () => ctrl.abort();
  }, []);

  // Preencher atendente com usuário logado
  useEffect(() => {
    const name = (session?.user as any)?.name || (session?.user as any)?.email || '';
    if (name && !form.attendant) {
      setForm((f: any) => ({ ...f, attendant: name }));
    }
  }, [session?.user]);

  function updateField(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  function addItem() {
    setItems((arr) => ([...arr, {}]));
  }
  function removeLastItem() {
    setItems((arr) => arr.slice(0, -1));
  }
  function updateItem(idx: number, key: keyof Item, value: any) {
    setItems((arr) => arr.map((it, i) => i === idx ? { ...it, [key]: value } : it));
  }

  function selectClient(c: any) {
    updateField("counterpartyCode", String(c.id || ""));
    updateField("counterpartyName", String(c.name || ""));
    updateField("city", String(c.cidade || ""));
    updateField("uf", String(c.estado || ""));
    setShowClientSug(false);
  }

  // Busca conforme digitado (nome ou código)
  useEffect(() => {
    const q = (form.counterpartyName || form.counterpartyCode || "").trim();
    if (!q) { setClientList([]); setShowClientSug(false); return; }
    const url = `/api/base/clients?q=${encodeURIComponent(q)}`;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((arr) => setClientList(Array.isArray(arr) ? arr : []))
      .catch(() => {})
      .finally(() => {});
    return () => ctrl.abort();
  }, [form.counterpartyName, form.counterpartyCode]);

  // Buscar ocorrências padrão conforme digitado somente pela descrição
  useEffect(() => {
    const q = (form.occurrencePattern || '').trim();
    if (!q) { setOccList([]); setShowOccSug(false); return; }
    const url = `/api/sac/standard-occurrences?q=${encodeURIComponent(q)}`;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((arr) => setOccList(Array.isArray(arr) ? arr : []))
      .catch(() => {})
      .finally(() => {});
    return () => ctrl.abort();
  }, [form.occurrencePattern]);

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/sac/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao salvar");
      router.push("/sac/complaints/search");
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Manutenção de Reclamação</h1>

      {/* Linha superior */}
      <div className="grid grid-cols-12 gap-2 border p-2 bg-gray-50">
        <div className="col-span-2">
          <label className="text-xs">Núm. SAC</label>
          <input className="w-full border px-2 py-1" value={"(auto)"} readOnly />
        </div>
        <div className="col-span-2">
          <label className="text-xs">Divisão</label>
          <select className="w-full border px-2 py-1" value={form.division} onChange={e=>updateField("division", e.target.value)}>
            {families.length > 0 ? (
              families.map((f) => (
                <option key={f.id} value={f.description}>{f.description}</option>
              ))
            ) : (
              <>
                <option>Chapas</option>
                <option>Caixas</option>
                <option>Outros</option>
              </>
            )}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs">Tipo</label>
          <select className="w-full border px-2 py-1" value={form.type} onChange={e=>updateField("type", e.target.value)}>
            <option>Externo</option>
            <option>Interno</option>
          </select>
        </div>
        <div className="col-span-3">
          <label className="text-xs">Fase</label>
          <input className="w-full border px-2 py-1" value={form.phase} onChange={e=>updateField("phase", e.target.value)} />
        </div>
        <div className="col-span-3">
          <label className="text-xs">Prazo Conclusão</label>
          <input type="date" className="w-full border px-2 py-1" value={form.dueDate} onChange={e=>updateField("dueDate", e.target.value)} />
        </div>
      </div>

      {/* Datas e Cliente/Fornecedor */}
      <div className="grid grid-cols-12 gap-2 border p-2">
        <div className="col-span-2">
          <label className="text-xs">Data SAC</label>
          <input type="date" className="w-full border px-2 py-1" value={form.dateSac} onChange={e=>updateField("dateSac", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs">Data Rec</label>
          <input type="date" className="w-full border px-2 py-1" value={form.dateReceived} onChange={e=>updateField("dateReceived", e.target.value)} />
        </div>
        <div className="col-span-8">
          <label className="text-xs">Cli./Fornec.</label>
          <div className="flex gap-2">
            <select className="border px-2 py-1" value={form.counterpartyType} onChange={e=>updateField("counterpartyType", e.target.value)}>
              <option>CLIENTE</option>
              <option>FORNECEDOR</option>
            </select>
            <input
              placeholder="Código"
              className="border px-2 py-1 w-24"
              value={form.counterpartyCode}
              onChange={e=>updateField("counterpartyCode", e.target.value)}
              onFocus={() => clientList.length && setShowClientSug(true)}
              onBlur={() => setTimeout(() => setShowClientSug(false), 150)}
            />
            <div className="relative flex-1">
              <input
                placeholder="Nome"
                className="w-full border px-2 py-1"
                value={form.counterpartyName}
                onChange={e=>updateField("counterpartyName", e.target.value)}
                onFocus={() => clientList.length && setShowClientSug(true)}
                onBlur={() => setTimeout(() => setShowClientSug(false), 150)}
              />
              {showClientSug && clientList.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto border rounded bg-white shadow">
                  {clientList.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { selectClient(c); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100"
                    >
                      <div className="text-sm">{c.name}</div>
                      <div className="text-xs text-gray-600">{c.cidade || ''}{c.estado ? `, ${c.estado}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input placeholder="Cidade" className="border px-2 py-1 w-40" value={form.city} onChange={e=>updateField("city", e.target.value)} />
            <input placeholder="UF" className="border px-2 py-1 w-16" value={form.uf} onChange={e=>updateField("uf", e.target.value)} />
          </div>
          <div className="flex gap-2 mt-2">
            <input placeholder="Contato" className="border px-2 py-1 w-48" value={form.contactName} onChange={e=>updateField("contactName", e.target.value)} />
            <input placeholder="Tel" className="border px-2 py-1 w-48" value={form.contactPhone} onChange={e=>updateField("contactPhone", e.target.value)} />
            <input placeholder="E-mail" className="border px-2 py-1 flex-1" value={form.contactEmail} onChange={e=>updateField("contactEmail", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Representante e Transporte */}
      <div className="grid grid-cols-12 gap-2 border p-2">
        <div className="col-span-6">
          <label className="text-xs">Dados Representante</label>
          <div className="flex gap-2">
            <input placeholder="Nome" className="border px-2 py-1 w-64" value={form.representativeName} onChange={e=>updateField("representativeName", e.target.value)} />
            <input placeholder="E-mail" className="border px-2 py-1 flex-1" value={form.representativeEmail} onChange={e=>updateField("representativeEmail", e.target.value)} />
          </div>
        </div>
        <div className="col-span-6">
          <label className="text-xs">Dados Transporte</label>
          <div className="flex gap-2">
            <input placeholder="Transportador" className="border px-2 py-1 flex-1" value={form.carrier} onChange={e=>updateField("carrier", e.target.value)} />
            <div className="flex items-center gap-2">
              <span className="text-sm">Tipo frete:</span>
              <label className="text-sm flex items-center gap-1"><input type="radio" checked={form.freightType === 'Retira'} onChange={()=>updateField('freightType','Retira')} /> Retira</label>
              <label className="text-sm flex items-center gap-1"><input type="radio" checked={form.freightType === 'Entrega'} onChange={()=>updateField('freightType','Entrega')} /> Entrega</label>
            </div>
          </div>
        </div>
      </div>

      {/* Atendimento da Não Conformidade */}
      <div className="grid grid-cols-12 gap-2 border p-2">
        <div className="col-span-6">
          <label className="text-xs">Atendimento da Não Conformidade</label>
          <div className="flex gap-2">
            <input placeholder="Atendente" className="border px-2 py-1 w-64 bg-gray-100" value={form.attendant} readOnly />
            <input placeholder="Referência" className="border px-2 py-1 flex-1" value={form.reference} onChange={e=>updateField("reference", e.target.value)} />
          </div>
        </div>
        <div className="col-span-6">
          <label className="text-xs">Classificação / Ocorrência Padrão</label>
          <div className="flex gap-2">
            <select className="border px-2 py-1 w-64" value={form.classification} onChange={e=>updateField("classification", e.target.value)}>
              <option value="">Selecione...</option>
              <option>SAC-Tolerável(Alerta)</option>
              <option>RNC-Grave(Qualidade)</option>
              <option>RNC-Crítico(Descto/Devol)</option>
              <option>DEN-Canal de Denúncias</option>
            </select>
            <div className="relative w-80">
              <input placeholder="Ocorrência Padrão" className="border px-2 py-1 w-full" value={form.occurrencePattern} onChange={e=>updateField("occurrencePattern", e.target.value)} onFocus={() => occList.length && setShowOccSug(true)} onBlur={() => setTimeout(() => setShowOccSug(false), 150)} />
              {showOccSug && occList.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto border rounded bg-white shadow">
                  {occList.map((o: any) => (
                    <button
                      key={o.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { updateField("occurrencePattern", String(o.description || "")); updateField("occurrenceCode", String(o.id || "")); setShowOccSug(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100"
                    >
                      <div className="text-sm">{o.description}</div>
                      <div className="text-xs text-gray-600">ID: {o.id}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input placeholder="Código" className="border px-2 py-1 w-32" value={form.occurrenceCode} onChange={e=>updateField("occurrenceCode", e.target.value)} />
          </div>
        </div>
      </div>

  {/* Ocorrência */}
  <div className="border p-2">
        <label className="text-xs">Ocorrência</label>
        <textarea className="w-full border px-2 py-1 h-28" value={form.occurrenceText} onChange={e=>updateField("occurrenceText", e.target.value)} />
      </div>

      {/* Nota/Pedido - Tabela */}
      <div className="border p-2">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium">Nota/Pedido</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-green-600 text-white" onClick={addItem} type="button">Incluir</button>
            <button className="px-3 py-1 bg-red-600 text-white" onClick={removeLastItem} type="button">Eliminar</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-xs">
            <thead>
              <tr className="bg-gray-100">
                {['Nota Fis','SFT','Pedido','SPD','Emissão','Descrição','UM','Vlr. Unit','Qt. Fatur','Diverg NF','Diverg R$','Diverg %','%Div Tot'].map(h=> (
                  <th key={h} className="border px-2 py-1 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx)=> (
                <tr key={idx}>
                  <td className="border px-1"><input className="w-full" value={it.invoiceNumber||''} onChange={e=>updateItem(idx,'invoiceNumber',e.target.value)} /></td>
                  <td className="border px-1"><input className="w-full" value={it.sft||''} onChange={e=>updateItem(idx,'sft',e.target.value)} /></td>
                  <td className="border px-1"><input className="w-full" value={it.orderNumber||''} onChange={e=>updateItem(idx,'orderNumber',e.target.value)} /></td>
                  <td className="border px-1"><input className="w-full" value={it.spd||''} onChange={e=>updateItem(idx,'spd',e.target.value)} /></td>
                  <td className="border px-1"><input type="date" className="w-full" value={it.emissionDate||''} onChange={e=>updateItem(idx,'emissionDate',e.target.value)} /></td>
                  <td className="border px-1"><input className="w-full" value={it.description||''} onChange={e=>updateItem(idx,'description',e.target.value)} /></td>
                  <td className="border px-1"><input className="w-full" value={it.uom||''} onChange={e=>updateItem(idx,'uom',e.target.value)} /></td>
                  <td className="border px-1"><input type="number" step="0.01" className="w-full" value={it.unitPrice||0} onChange={e=>updateItem(idx,'unitPrice',parseFloat(e.target.value||'0'))} /></td>
                  <td className="border px-1"><input type="number" step="0.01" className="w-full" value={it.qtyInvoiced||0} onChange={e=>updateItem(idx,'qtyInvoiced',parseFloat(e.target.value||'0'))} /></td>
                  <td className="border px-1"><input type="number" step="0.01" className="w-full" value={(it as any).divergenceNF||0} onChange={e=>updateItem(idx,'divergenceNF',parseFloat(e.target.value||'0'))} /></td>
                  <td className="border px-1"><input type="number" step="0.01" className="w-full" value={it.divergenceValue||0} onChange={e=>updateItem(idx,'divergenceValue',parseFloat(e.target.value||'0'))} /></td>
                  <td className="border px-1"><input type="number" step="0.01" className="w-full" value={it.divergencePercent||0} onChange={e=>updateItem(idx,'divergencePercent',parseFloat(e.target.value||'0'))} /></td>
                  <td className="border px-1"><input type="number" step="0.01" className="w-full" value={it.totalPercent||0} onChange={e=>updateItem(idx,'totalPercent',parseFloat(e.target.value||'0'))} /></td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={13} className="text-center text-gray-500 py-3">Nenhum item. Use &quot;Incluir&quot; para adicionar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <button className="px-4 py-2 bg-blue-600 text-white" onClick={save} disabled={saving}>Salvar</button>
        {error && <span className="text-red-600">{error}</span>}
      </div>

      {/* Sugestões de cliente abaixo do campo são exibidas acima, junto do input */}
    </div>
  );
}
