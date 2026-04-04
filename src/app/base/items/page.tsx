"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";

type Item = {
  id: number;
  name: string;
  sku?: string | null;
  unit?: string | null;
  commercialFamilyId?: number | null;
  commercialFamily?: { id: number; description: string } | null;
};

export default function BaseItemMaintenancePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Módulos permitidos na entidade ativa
  const [modules, setModules] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<number[]>([]);
  const [showModuleDropdown, setShowModuleDropdown] = useState<boolean>(false);

  // Formulário unificado (inclusão/alteração)
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{ sku: string; name: string; unit: string; commercialFamilyId: number | null }>({ sku: "", name: "", unit: "", commercialFamilyId: null });
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMsg, setSaveMsg] = useState<string>("");
  // Busca de família comercial
  const [familyQuery, setFamilyQuery] = useState("");
  const [familySug, setFamilySug] = useState<Array<{ id: number; description: string }>>([]);
  const [showFamilySug, setShowFamilySug] = useState(false);
  // Disponibilidade
  const [activeEntityId, setActiveEntityId] = useState<number | null>(null);
  const [availability, setAvailability] = useState<Array<{ id: number; name: string; modules: Array<{ entityModuleId: number; moduleId: number; moduleCode: string; moduleName: string; allowed: boolean }> }>>([]);

  const load = useCallback(async (mods?: number[]) => {
    setLoading(true); setError(null);
    try {
      const moduleIds = (mods ?? selectedModuleIds).filter((n) => Number.isFinite(n) && n > 0);
      const url = moduleIds.length ? `/api/items?moduleIds=${moduleIds.join(',')}` : "/api/items";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  }, [selectedModuleIds]);

  useEffect(() => { void load(); }, [load]);
  // Buscar módulos permitidos para a entidade ativa
  useEffect(() => {
    fetch('/api/permissions')
      .then(r => r.json())
      .then(d => {
        const mods = Array.isArray(d?.modules) ? d.modules : [];
        setModules(mods.map((m: any) => ({ id: Number(m.id), code: String(m.code), name: String(m.name) })));
      })
      .catch(() => setModules([]));
  }, []);
  // Recarregar itens ao alterar seleção de módulos
  useEffect(() => { void load(selectedModuleIds); }, [load, selectedModuleIds]);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      (it.name || "").toLowerCase().includes(q) ||
      (it.sku || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const allVisibleSelected = useMemo(() => filtered.length > 0 && filtered.every((it) => selectedIds.includes(it.id)), [filtered, selectedIds]);
  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) setSelectedIds(Array.from(new Set([...selectedIds, ...filtered.map((it) => it.id)])));
    else setSelectedIds((prev) => prev.filter((id) => !filtered.some((it) => it.id === id)));
  };
  const toggleRow = (id: number, checked: boolean) => {
    setSelectedIds((prev) => checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((n) => n !== id));
  };
  useEffect(() => {
    // Remover seleções que não estão mais visíveis após filtros/atualizações
    setSelectedIds((prev) => prev.filter((id) => items.some((it) => it.id === id)));
  }, [items]);

  const bulkDelete = async () => {
    const ids = selectedIds.filter((n) => Number.isFinite(n));
    if (ids.length === 0) return;
    if (!confirm(`Excluir ${ids.length} item(ns)?`)) return;
    try {
      const res = await fetch('/api/items', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setSelectedIds([]);
      await load();
    } catch (err: any) {
      alert(err?.message || String(err));
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm({ sku: "", name: "", unit: "", commercialFamilyId: null });
    setFamilyQuery("");
    setFamilySug([]);
    setShowFamilySug(false);
    setAvailability([]);
    setActiveEntityId(null);
    setFormOpen(true);
  };

  const openEditForm = (item: Item) => {
    setEditingId(item.id);
    setForm({ sku: item.sku || "", name: item.name || "", unit: item.unit || "", commercialFamilyId: item.commercialFamilyId ?? null });
    setFamilyQuery(item.commercialFamily?.description || "");
    setShowFamilySug(false);
    // Carregar disponibilidade
    fetch(`/api/items/${item.id}/availability`)
      .then(r => r.json())
      .then(d => { const list = Array.isArray(d?.entities) ? d.entities : []; setAvailability(list); setActiveEntityId(list.length ? list[0].id : null); })
      .catch(() => setAvailability([]));
    setFormOpen(true);
  };

  const cancelForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm({ sku: "", name: "", unit: "", commercialFamilyId: null });
    setFamilyQuery("");
    setFamilySug([]);
    setShowFamilySug(false);
    setAvailability([]);
    setActiveEntityId(null);
  };

  const saveForm = async () => {
    if (saving) return;
    setSaveMsg("");
    setSaving(true);
    const payload = { sku: form.sku.trim(), name: form.name.trim(), unit: form.unit.trim(), commercialFamilyId: form.commercialFamilyId };
    try {
      if (editingId) {
        const res = await fetch(`/api/items/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      } else {
        const res = await fetch(`/api/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
        setEditingId(Number(data?.id));
        if (data?.id) {
          fetch(`/api/items/${data.id}/availability`)
            .then(r => r.json())
            .then(d => setAvailability(Array.isArray(d?.entities) ? d.entities : []))
            .catch(() => setAvailability([]));
        }
      }
      await load();
      cancelForm();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Manutenção de Item</h1>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}

          {/* Barra de busca e ação */}
          <div className="flex items-center gap-2">
            <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar por código ou descrição" className="flex-1 border rounded px-3 py-2 text-sm" />
            {/* Seleção de Módulos (dropdown com múltipla seleção) */}
            <div className="relative">
              <button type="button" onClick={() => setShowModuleDropdown((v) => !v)} className="px-3 py-2 border rounded text-sm bg-white">
                {selectedModuleIds.length > 0 ? `Módulos (${selectedModuleIds.length})` : 'Filtrar por módulos'}
              </button>
              {showModuleDropdown && (
                <div tabIndex={0} onBlur={() => setTimeout(() => setShowModuleDropdown(false), 150)} className="absolute right-0 z-10 mt-1 w-64 max-h-60 overflow-auto border rounded bg-white shadow p-1">
                  {modules.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 px-2 py-1 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedModuleIds.includes(m.id)}
                        onChange={(ev) => {
                          setSelectedModuleIds((prev) => {
                            if (ev.target.checked) {
                              if (prev.includes(m.id)) return prev;
                              return [...prev, m.id];
                            }
                            return prev.filter((id) => id !== m.id);
                          });
                        }}
                      />
                      <span>{m.name}</span>
                    </label>
                  ))}
                  {modules.length === 0 && (
                    <div className="px-2 py-1 text-xs text-gray-500">Nenhum módulo disponível</div>
                  )}
                  <div className="flex items-center justify-between px-2 py-1 border-t mt-1">
                    <button type="button" onClick={() => setSelectedModuleIds([])} className="text-xs text-blue-600 hover:underline">Limpar</button>
                    <button type="button" onClick={() => setShowModuleDropdown(false)} className="text-xs text-gray-700 hover:underline">Fechar</button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={openAddForm} className="px-3 py-2 rounded bg-green-600 text-white text-sm">Incluir Item</button>
          </div>

          {/* Formulário de inclusão/edição acima da lista */}
          {formOpen && (
            <div className="border rounded p-3 space-y-2">
              <div className="font-medium">{editingId ? "Editar Item" : "Incluir Item"}</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-600">ID</label>
                  <input value={editingId ? String(editingId) : "(novo)"} readOnly className="w-full border rounded px-2 py-1 text-sm bg-gray-50" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Código do Item</label>
                  <input value={form.sku} onChange={(e)=>setForm((f)=>({ ...f, sku: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-600">Descrição do item</label>
                  <input value={form.name} onChange={(e)=>setForm((f)=>({ ...f, name: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Unidade de medida</label>
                  <input value={form.unit} onChange={(e)=>setForm((f)=>({ ...f, unit: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-600">Família Comercial</label>
                  <div className="relative">
                    <input
                      value={familyQuery}
                      onChange={(e) => {
                        const v = e.target.value; setFamilyQuery(v);
                        setForm((prev)=>({ ...prev, commercialFamilyId: null }));
                        const q = v.trim();
                        if (!q) { setFamilySug([]); setShowFamilySug(false); return; }
                        fetch(`/api/base/commercial-families?q=${encodeURIComponent(q)}`)
                          .then(r => r.json())
                          .then(data => { setFamilySug(Array.isArray(data) ? data.slice(0, 8) : []); setShowFamilySug(true); })
                          .catch(() => {});
                      }}
                      onFocus={() => familySug.length && setShowFamilySug(true)}
                      onBlur={() => setTimeout(() => setShowFamilySug(false), 150)}
                      className="w-full border rounded px-2 py-1 text-sm"
                      placeholder="Digite parte da descrição"
                    />
                    {showFamilySug && familySug.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto border rounded bg-white shadow">
                        {familySug.map((f) => (
                          <button key={f.id} type="button" onMouseDown={(e)=>e.preventDefault()} onClick={() => { setForm((prev)=>({ ...prev, commercialFamilyId: f.id })); setFamilyQuery(f.description); setShowFamilySug(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">
                            <div className="text-sm">{f.description}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={saveForm} disabled={saving} className="px-3 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
                {saveMsg && <span className="text-xs text-green-700">{saveMsg}</span>}
                <button onClick={cancelForm} className="px-3 py-2 rounded bg-gray-300 text-gray-900 text-sm">Cancelar</button>
              </div>

              {/* Liberação por Entidade/Módulo */}
              {editingId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border rounded">
                    <div className="p-2 text-xs text-gray-600">Entidades</div>
                    <div className="max-h-64 overflow-auto divide-y">
                      {availability.map((e) => (
                        <label key={e.id} className="flex items-center gap-2 p-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeEntityId === e.id}
                            onChange={async (ev) => {
                              if (ev.target.checked) {
                                setActiveEntityId(e.id);
                              } else {
                                // Ao desmarcar a entidade, remover todos os vínculos item/entidade/módulo
                                try {
                                  await Promise.all(
                                    (e.modules || []).map((m: any) =>
                                      fetch(`/api/items/${editingId}/availability`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ entityModuleId: m.entityModuleId, allowed: false })
                                      })
                                    )
                                  );
                                } catch {}
                                setActiveEntityId(null);
                                // Atualizar estado local
                                setAvailability((prev) => prev.map((ee) => ee.id !== e.id ? ee : ({ ...ee, modules: (ee.modules || []).map((mm: any) => ({ ...mm, allowed: false })) })));
                              }
                            }}
                          />
                          <span className="text-sm">{e.name}</span>
                        </label>
                      ))}
                      {availability.length === 0 && (
                        <div className="p-2 text-sm text-gray-500">Nenhuma entidade encontrada</div>
                      )}
                    </div>
                  </div>

                  <div className="border rounded">
                    <div className="p-2 text-xs text-gray-600">Módulos vinculados à entidade selecionada</div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-2 text-left">Módulo</th>
                          <th className="p-2">Liberar item</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availability.filter((e) => e.id === activeEntityId).flatMap((e) => e.modules).map((m) => (
                          <tr key={`${activeEntityId}-${m.moduleId}`} className="border-t">
                            <td className="p-2">{m.moduleName} <span className="text-xs text-gray-500">({m.moduleCode})</span></td>
                            <td className="p-2 text-center">
                              <input type="checkbox" checked={m.allowed} onChange={async (ev) => {
                                try {
                                  const res = await fetch(`/api/items/${editingId}/availability`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId: activeEntityId ?? undefined, moduleId: m.moduleId, entityModuleId: (m as any).entityModuleId, allowed: ev.target.checked }) });
                                  const ok = res.ok;
                                  if (!ok) { const d = await res.json().catch(()=>({})); throw new Error(d?.error || `Erro ${res.status}`); }
                                  // Recarregar disponibilidade para manter consistência
                                  fetch(`/api/items/${editingId}/availability`).then(r => r.json()).then(d => setAvailability(Array.isArray(d?.entities) ? d.entities : [])).catch(()=>{});
                                } catch (err: any) {
                                  alert(err?.message || String(err));
                                }
                              }} />
                            </td>
                          </tr>
                        ))}
                        {activeEntityId == null && (
                          <tr><td colSpan={2} className="p-2 text-gray-500">Selecione uma entidade para ver os módulos</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-2 text-xs text-gray-600">Salve o item para liberar por entidade/módulo.</div>
              )}
            </div>
          )}

          {/* Ações em massa */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">{selectedIds.length > 0 ? `${selectedIds.length} selecionado(s)` : ''}</div>
            <div className="flex items-center gap-2">
              <button onClick={bulkDelete} disabled={selectedIds.length === 0 || formOpen} className="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50">Excluir selecionados</button>
            </div>
          </div>

          {/* Grid de itens */}
          <div className="border rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-2 border-b w-10"><input type="checkbox" checked={allVisibleSelected} onChange={(e)=>toggleSelectAllVisible(e.target.checked)} /></th>
                  <th className="p-2 border-b">ID</th>
                  <th className="p-2 border-b">Código</th>
                  <th className="p-2 border-b">Descrição</th>
                  <th className="p-2 border-b">Unidade</th>
                  <th className="p-2 border-b">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} className="border-b">
                    <td className="p-2"><input type="checkbox" checked={selectedIds.includes(it.id)} onChange={(e)=>toggleRow(it.id, e.target.checked)} /></td>
                    <td className="p-2">{it.id}</td>
                    <td className="p-2">{it.sku || ""}</td>
                    <td className="p-2">{it.name || ""}</td>
                    <td className="p-2">{it.unit || ""}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditForm(it)} disabled={formOpen} className="px-2 py-1 rounded bg-yellow-500 text-white disabled:opacity-50">Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr><td colSpan={5} className="p-2 text-gray-500">Carregando...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-2 text-gray-500">Nenhum item encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Formulário exibido acima; manter bloco antigo oculto para referência */}
          {formOpen && false && (
            <div className="border rounded p-3 space-y-2">
              <div className="font-medium">{editingId ? "Editar Item" : "Incluir Item"}</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-600">ID</label>
                  <input value={editingId ? String(editingId) : "(novo)"} readOnly className="w-full border rounded px-2 py-1 text-sm bg-gray-50" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Código do Item</label>
                  <input value={form.sku} onChange={(e)=>setForm((f)=>({ ...f, sku: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-600">Descrição do item</label>
                  <input value={form.name} onChange={(e)=>setForm((f)=>({ ...f, name: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Unidade de medida</label>
                  <input value={form.unit} onChange={(e)=>setForm((f)=>({ ...f, unit: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-600">Família Comercial</label>
                  <div className="relative">
                    <input
                      value={familyQuery}
                      onChange={(e) => {
                        const v = e.target.value; setFamilyQuery(v);
                        // Ao digitar, limpar o ID selecionado para evitar enviar referência inválida
                        setForm((prev)=>({ ...prev, commercialFamilyId: null }));
                        const q = v.trim();
                        if (!q) { setFamilySug([]); setShowFamilySug(false); return; }
                        const ctrl = new AbortController();
                        fetch(`/api/base/commercial-families?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
                          .then(r => r.json())
                          .then(data => { setFamilySug(Array.isArray(data) ? data.slice(0, 8) : []); setShowFamilySug(true); })
                          .catch(() => {});
                      }}
                      onFocus={() => familySug.length && setShowFamilySug(true)}
                      onBlur={() => setTimeout(() => setShowFamilySug(false), 150)}
                      className="w-full border rounded px-2 py-1 text-sm"
                      placeholder="Digite parte da descrição"
                    />
                    {showFamilySug && familySug.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto border rounded bg-white shadow">
                        {familySug.map((f) => (
                          <button key={f.id} type="button" onMouseDown={(e)=>e.preventDefault()} onClick={() => { setForm((prev)=>({ ...prev, commercialFamilyId: f.id })); setFamilyQuery(f.description); setShowFamilySug(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100">
                            <div className="text-sm">{f.description}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={saveForm} className="px-3 py-2 rounded bg-green-600 text-white text-sm">Salvar</button>
                <button onClick={cancelForm} className="px-3 py-2 rounded bg-gray-300 text-gray-900 text-sm">Cancelar</button>
              </div>

              {/* Liberação por Entidade/Módulo */}
              {editingId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border rounded">
                    <div className="p-2 text-xs text-gray-600">Entidades</div>
                    <div className="max-h-64 overflow-auto divide-y">
                      {availability.map((e) => (
                        <label key={e.id} className="flex items-center gap-2 p-2 cursor-pointer">
                          <input type="checkbox" checked={activeEntityId === e.id} onChange={(ev) => setActiveEntityId(ev.target.checked ? e.id : null)} />
                          <span className="text-sm">{e.name}</span>
                        </label>
                      ))}
                      {availability.length === 0 && (
                        <div className="p-2 text-sm text-gray-500">Nenhuma entidade encontrada</div>
                      )}
                    </div>
                  </div>

                  <div className="border rounded">
                    <div className="p-2 text-xs text-gray-600">Módulos vinculados à entidade selecionada</div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-2 text-left">Módulo</th>
                          <th className="p-2">Liberar item</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availability.filter((e) => e.id === activeEntityId).flatMap((e) => e.modules).map((m) => (
                          <tr key={`${activeEntityId}-${m.moduleId}`} className="border-t">
                            <td className="p-2">{m.moduleName} <span className="text-xs text-gray-500">({m.moduleCode})</span></td>
                            <td className="p-2 text-center">
                              <input type="checkbox" checked={m.allowed} onChange={async (ev) => {
                                try {
                                  const res = await fetch(`/api/items/${editingId}/availability`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId: activeEntityId, moduleId: m.moduleId, allowed: ev.target.checked }) });
                                  const ok = res.ok;
                                  if (!ok) { const d = await res.json().catch(()=>({})); throw new Error(d?.error || `Erro ${res.status}`); }
                                  // Atualizar estado
                                  setAvailability((prev) => prev.map((e) => e.id !== activeEntityId ? e : ({ ...e, modules: e.modules.map((mm) => mm.moduleId === m.moduleId ? { ...mm, allowed: ev.target.checked } : mm) })));
                                } catch (err: any) {
                                  alert(err?.message || String(err));
                                }
                              }} />
                            </td>
                          </tr>
                        ))}
                        {activeEntityId == null && (
                          <tr><td colSpan={2} className="p-2 text-gray-500">Selecione uma entidade para ver os módulos</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-2 text-xs text-gray-600">Salve o item para liberar por entidade/módulo.</div>
              )}
            </div>
          )}
    </div>
  );
}
