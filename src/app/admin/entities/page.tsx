"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";

type Entity = { id: number; name: string; cnpj: string };
type ModuleItem = { id: number; code: string; name: string; linked: number | boolean };
type ProgramItem = { id: number; code: string; name: string; allowed: number };

export default function AdminEntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cnpjInput, setCnpjInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editCnpj, setEditCnpj] = useState("");
  const [editName, setEditName] = useState("");

  const selectedEntity = useMemo(() => entities.find(e => e.id === selectedEntityId) || null, [entities, selectedEntityId]);
  const selectedModule = useMemo(() => modules.find(m => m.id === selectedModuleId) || null, [modules, selectedModuleId]);

  const loadEntities = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/admin/entities');
      if (!res.ok) throw new Error((await res.json()).error || `Erro ${res.status}`);
      const data = await res.json();
      const normalized: Entity[] = (Array.isArray(data.entities) ? data.entities : [])
        .map((e: any) => ({
          id: Number(e?.id),
          name: String(e?.name || ''),
          cnpj: String(e?.cnpj || ''),
        }))
        .filter((e: any) => Number.isFinite(e.id) && e.id > 0);
      setEntities(normalized);
      const firstId = normalized[0]?.id ?? null;
      setSelectedEntityId((prev) => (prev && prev > 0 ? prev : firstId));
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setLoading(false); }
  }, []);

  const loadModules = useCallback(async (eid: number) => {
    if (!eid) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/entities/${eid}/modules`);
      if (!res.ok) throw new Error((await res.json()).error || `Erro ${res.status}`);
      const data = await res.json();
      setModules(data.modules || []);
      setSelectedModuleId(null);
      setPrograms([]);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setLoading(false); }
  }, []);

  const loadPrograms = useCallback(async (eid: number, mid: number) => {
    if (!eid || !mid) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/entities/${eid}/modules/${mid}/programs`);
      if (!res.ok) throw new Error((await res.json()).error || `Erro ${res.status}`);
      const data = await res.json();
      setPrograms(data.programs || []);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadEntities(); }, [loadEntities]);
  useEffect(() => { if (selectedEntityId) void loadModules(selectedEntityId); }, [selectedEntityId, loadModules]);
  useEffect(() => { if (selectedEntityId && selectedModuleId) void loadPrograms(selectedEntityId, selectedModuleId); }, [selectedEntityId, selectedModuleId, loadPrograms]);

  const toggleModuleLink = async (mid: number, linked: boolean) => {
    if (!selectedEntityId) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/entities/${selectedEntityId}/modules`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId: mid, linked }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Erro ${res.status}`);
      await loadModules(selectedEntityId);
      if (selectedModuleId) await loadPrograms(selectedEntityId, selectedModuleId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const toggleProgramAllowed = async (pid: number, allowed: boolean) => {
    if (!selectedEntityId || !selectedModuleId || !selectedModule?.linked) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/entities/${selectedEntityId}/modules/${selectedModuleId}/programs`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId: pid, allowed }),
      });
      if (!res.ok) throw new Error((await res.json()).error || `Erro ${res.status}`);
      await loadPrograms(selectedEntityId, selectedModuleId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const allowAllPrograms = async () => {
    if (!selectedEntityId || !selectedModuleId) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/entities/${selectedEntityId}/modules/${selectedModuleId}/programs`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'allow_all' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      await loadPrograms(selectedEntityId, selectedModuleId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const denyAllPrograms = async () => {
    if (!selectedEntityId || !selectedModuleId) return;
    const ok = typeof window !== 'undefined' ? window.confirm('Revogar permissão de todos os programas deste módulo?') : true;
    if (!ok) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/entities/${selectedEntityId}/modules/${selectedModuleId}/programs`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deny_all' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      await loadPrograms(selectedEntityId, selectedModuleId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const linkAllModules = async () => {
    if (!selectedEntityId) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/entities/${selectedEntityId}/modules`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link_all' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      await loadModules(selectedEntityId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const unlinkAllModules = async () => {
    if (!selectedEntityId) return;
    const ok = typeof window !== 'undefined' ? window.confirm('Desvincular todos os módulos desta entidade?') : true;
    if (!ok) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/entities/${selectedEntityId}/modules`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlink_all' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      await loadModules(selectedEntityId);
      setSelectedModuleId(null);
      setPrograms([]);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const lookupCnpj = async () => {
    const c = cnpjInput.trim(); if (!c) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/cnpj?cnpj=${encodeURIComponent(c)}`);
      const data = await res.json();
      if (data?.name) setNameInput(String(data.name));
    } catch (e: any) { setErr(e?.message || String(e)); } finally { setLoading(false); }
  };

  const createEntity = async () => {
    const c = cnpjInput.trim(); const n = nameInput.trim();
    if (!c || !n) { setErr('Informe CNPJ e Nome'); return; }
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/admin/entities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnpj: c, name: n }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setCnpjInput(''); setNameInput('');
      await loadEntities();
    } catch (e: any) { setErr(e?.message || String(e)); } finally { setLoading(false); }
  };

  const deleteEntity = async () => {
    if (!selectedEntityId) return;
    const ok = typeof window !== 'undefined' ? window.confirm('Confirma exclusão da entidade selecionada e todos os vínculos (módulos, programas e permissões)?') : true;
    if (!ok) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/entities/${selectedEntityId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setSelectedEntityId(null);
      setModules([]);
      setSelectedModuleId(null);
      setPrograms([]);
      await loadEntities();
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const startEdit = () => {
    if (!selectedEntity) return;
    setEditCnpj(selectedEntity.cnpj);
    setEditName(selectedEntity.name);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditCnpj("");
    setEditName("");
  };

  const updateEntity = async () => {
    if (!selectedEntityId) return;
    const c = editCnpj.trim(); const n = editName.trim();
    if (!c || !n) { setErr('Informe CNPJ e Nome'); return; }
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/entities/${selectedEntityId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cnpj: c, name: n }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setEditMode(false);
      await loadEntities();
      setSelectedEntityId(selectedEntityId);
    } catch (e: any) { setErr(e?.message || String(e)); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Administração • Entidades</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded border p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Entidades</h2>
            <div className="flex items-center gap-2">
              <button onClick={loadEntities} className="text-xs px-2 py-1 border rounded">Atualizar</button>
              {selectedEntityId && (
                <button onClick={startEdit} className="text-xs px-2 py-1 border rounded">Editar</button>
              )}
              {selectedEntityId && (
                <button onClick={deleteEntity} className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50">Excluir selecionada</button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {entities.map(e => (
              <button key={e.id} onClick={() => setSelectedEntityId(Number(e.id))} className={`w-full text-left px-2 py-1 rounded ${selectedEntityId===e.id?'bg-blue-50 border border-blue-200':'hover:bg-gray-50 border'}`}>
                <div className="text-sm font-medium">{e.name}</div>
                <div className="text-xs text-gray-500">{e.cnpj}</div>
              </button>
            ))}
            {entities.length === 0 && <div className="text-sm text-gray-500">Nenhuma entidade</div>}
          </div>
          <div className="mt-4 space-y-2">
            <div className="text-sm font-medium">Cadastrar Entidade</div>
            <input value={cnpjInput} onChange={e=>setCnpjInput(e.target.value)} placeholder="CNPJ" className="w-full border rounded px-2 py-1 text-sm" />
            <div className="flex items-center gap-2">
              <input value={nameInput} onChange={e=>setNameInput(e.target.value)} placeholder="Nome" className="flex-1 border rounded px-2 py-1 text-sm" />
              <button onClick={lookupCnpj} className="text-xs px-2 py-1 border rounded">Buscar CNPJ</button>
            </div>
            <button onClick={createEntity} className="text-xs px-3 py-1 bg-blue-600 text-white rounded">Salvar</button>
          </div>

          {editMode && (
            <div className="mt-4 space-y-2">
              <div className="text-sm font-medium">Editar Entidade selecionada</div>
              <input value={editCnpj} onChange={e=>setEditCnpj(e.target.value)} placeholder="CNPJ" className="w-full border rounded px-2 py-1 text-sm" />
              <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Nome" className="w-full border rounded px-2 py-1 text-sm" />
              <div className="flex items-center gap-2">
                <button onClick={updateEntity} className="text-xs px-3 py-1 bg-blue-600 text-white rounded">Salvar alterações</button>
                <button onClick={cancelEdit} className="text-xs px-3 py-1 border rounded">Cancelar</button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded border p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Módulos {selectedEntity ? `• ${selectedEntity.name}` : ''}</h2>
            <div className="flex items-center gap-2">
              <button onClick={linkAllModules} className="text-xs px-2 py-1 bg-blue-600 text-white rounded">Vincular todos</button>
              <button onClick={unlinkAllModules} className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50">Desvincular todos</button>
            </div>
          </div>
          <div className="space-y-2">
            {modules.map(m => (
              <div key={m.id} className={`flex items-center justify-between gap-2 px-2 py-1 rounded ${selectedModuleId===m.id?'bg-blue-50 border border-blue-200':'border'}`}>
                <button onClick={() => setSelectedModuleId(m.id)} className="text-left flex-1">
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.code}</div>
                </button>
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={Boolean(m.linked)} onChange={e => toggleModuleLink(m.id, e.target.checked)} /> Vinculado
                </label>
              </div>
            ))}
            {modules.length === 0 && (
              <div className="text-sm text-gray-500">
                {selectedEntityId ? 'Nenhum módulo cadastrado' : 'Selecione uma entidade'}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded border p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Programas {selectedModule ? `• ${selectedModule.name}` : ''}</h2>
            <div className="flex items-center gap-2">
              <button onClick={allowAllPrograms} disabled={!selectedModuleId || !selectedModule?.linked} className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">Permitir todos</button>
              <button onClick={denyAllPrograms} disabled={!selectedModuleId || !selectedModule?.linked} className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50">Revogar todos</button>
            </div>
          </div>
          <div className="space-y-2">
            {programs.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-2 px-2 py-1 border rounded">
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.code}</div>
                </div>
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={Boolean(p.allowed)} disabled={!selectedModule?.linked} onChange={e => toggleProgramAllowed(p.id, e.target.checked)} /> Permitido
                </label>
              </div>
            ))}
            {programs.length === 0 && <div className="text-sm text-gray-500">Selecione um módulo vinculado</div>}
          </div>
        </div>
      </div>

      {loading && <div className="text-xs text-gray-500">Carregando...</div>}
    </div>
  );
}
