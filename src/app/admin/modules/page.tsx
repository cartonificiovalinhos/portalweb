"use client";
import React, { useEffect, useMemo, useState } from "react";

type ModuleItem = { id: number; code: string; name: string; description?: string | null; showDashboardTab?: boolean };
type ProgramItem = { id: number; code: string; name: string; description?: string | null; showInMenu?: boolean };

export default function AdminModulesPage() {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [modCode, setModCode] = useState("");
  const [modName, setModName] = useState("");
  const [modDesc, setModDesc] = useState("");
  const [modShowDashboard, setModShowDashboard] = useState(false);
  const [editingModule, setEditingModule] = useState(false);
  const [progCode, setProgCode] = useState("");
  const [progName, setProgName] = useState("");
  const [progDesc, setProgDesc] = useState("");
  const [editingProgram, setEditingProgram] = useState(false);

  const selectedModule = useMemo(() => modules.find(m => m.id === selectedModuleId) || null, [modules, selectedModuleId]);

  const loadModules = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/admin/modules');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setModules(data.modules || []);
      if (!selectedModuleId && data.modules?.length) setSelectedModuleId(data.modules[0].id);
    } catch (e: any) { setErr(e?.message || String(e)); } finally { setLoading(false); }
  };

  const loadPrograms = async (mid: number) => {
    if (!mid) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/modules/${mid}/programs`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setPrograms(data.programs || []);
      setSelectedProgramId(null);
    } catch (e: any) { setErr(e?.message || String(e)); } finally { setLoading(false); }
  };

  useEffect(() => { loadModules(); }, []);
  useEffect(() => {
    if (selectedModuleId) {
      loadPrograms(selectedModuleId);
      const m = modules.find(x => x.id === selectedModuleId);
      if (m) {
        setModCode(m.code); setModName(m.name); setModDesc(m.description || ''); setEditingModule(true);
        setModShowDashboard(!!m.showDashboardTab);
      }
    } else {
      setModCode(''); setModName(''); setModDesc(''); setEditingModule(false); setModShowDashboard(false);
    }
  }, [selectedModuleId, modules]);

  const generateCode = (text: string) => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .toUpperCase();
  };

  const createModule = async () => {
    const c = modCode.trim(); const n = modName.trim();
    if (!n || (!editingModule && !c)) { setErr('Informe Código e Nome do módulo'); return; }
    setLoading(true); setErr(null);
    try {
      if (editingModule && selectedModuleId) {
        const res = await fetch(`/api/admin/modules/${selectedModuleId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, description: modDesc.trim() || null, showDashboardTab: modShowDashboard }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      } else {
        const res = await fetch('/api/admin/modules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c, name: n, description: modDesc.trim() || null, showDashboardTab: modShowDashboard }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      }
      setEditingModule(false);
      setModCode(''); setModName(''); setModDesc(''); setModShowDashboard(false);
      await loadModules();
    } catch (e: any) { setErr(e?.message || String(e)); } finally { setLoading(false); }
  };

  const deleteProgram = async () => {
    if (!selectedModuleId || !selectedProgramId) return;
    const ok = typeof window !== 'undefined' ? window.confirm('Confirma a exclusão do programa selecionado e todos os vínculos (entidade e usuário)?') : true;
    if (!ok) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/modules/${selectedModuleId}/programs/${selectedProgramId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setSelectedProgramId(null);
      await loadPrograms(selectedModuleId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const createProgram = async () => {
    if (!selectedModuleId) { setErr('Selecione um módulo'); return; }
    const c = progCode.trim(); const n = progName.trim();
    if (!n || (!editingProgram && !c)) { setErr('Informe Código e Nome do programa'); return; }
    setLoading(true); setErr(null);
    try {
      if (editingProgram && selectedProgramId) {
        const res = await fetch(`/api/admin/modules/${selectedModuleId}/programs/${selectedProgramId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, description: progDesc.trim() || null }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      } else {
        const res = await fetch(`/api/admin/modules/${selectedModuleId}/programs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c, name: n, description: progDesc.trim() || null }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      }
      setEditingProgram(false);
      setProgCode(''); setProgName(''); setProgDesc('');
      await loadPrograms(selectedModuleId);
    } catch (e: any) { setErr(e?.message || String(e)); } finally { setLoading(false); }
  };

  const deleteModule = async () => {
    if (!selectedModuleId) return;
    const ok = typeof window !== 'undefined' ? window.confirm('Confirma a exclusão do módulo selecionado e todos os vínculos (programas, vínculos de entidade e permissões de usuário)?') : true;
    if (!ok) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/modules/${selectedModuleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setSelectedModuleId(null);
      setPrograms([]);
      await loadModules();
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-3 space-y-4">
      <h1 className="text-xl font-semibold">Administração • Módulos</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded border p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Módulos</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { 
                  setSelectedModuleId(null); 
                  setPrograms([]); 
                }} 
                className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
              >
                Novo módulo
              </button>
              {selectedModuleId && (
                <button
                  onClick={() => {
                    const m = modules.find(mm => mm.id === selectedModuleId);
                    if (!m) return;
                    setEditingModule(true);
                    setModCode(m.code || '');
                    setModName(m.name || '');
                    setModDesc(m.description || '');
                    setModShowDashboard(m.showDashboardTab || false);
                  }}
                  className="text-xs px-2 py-1 border rounded"
                >Editar</button>
              )}
              {selectedModuleId && (
                <button onClick={deleteModule} className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50">Excluir selecionado</button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {modules.map(m => (
              <button key={m.id} onClick={() => setSelectedModuleId(m.id)} className={`w-full text-left px-2 py-1 rounded ${selectedModuleId===m.id?'bg-blue-50 border border-blue-200':'hover:bg-gray-50 border'}`}>
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-xs text-gray-500">{m.code}</div>
              </button>
            ))}
            {modules.length === 0 && <div className="text-sm text-gray-500">Nenhum módulo cadastrado</div>}
          </div>
          <div className="mt-4 space-y-2">
            <div className="text-sm font-medium">{editingModule ? 'Editar Módulo' : 'Cadastrar Módulo'}</div>
            <input 
              value={modCode} 
              readOnly 
              disabled 
              placeholder="Gerado automaticamente" 
              className="w-full border rounded px-2 py-1 text-sm bg-gray-100 text-gray-500 cursor-not-allowed" 
            />
            <input 
              value={modName} 
              onChange={e => {
                const val = e.target.value;
                setModName(val);
                if (!editingModule) {
                  setModCode(generateCode(val));
                }
              }} 
              placeholder="Nome" 
              className="w-full border rounded px-2 py-1 text-sm" 
            />
            <textarea value={modDesc} onChange={e=>setModDesc(e.target.value)} placeholder="Descrição (opcional)" className="w-full border rounded px-2 py-1 text-sm" />
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={modShowDashboard} onChange={e => setModShowDashboard(e.target.checked)} id="modShowDashboard" />
              <label htmlFor="modShowDashboard" className="text-sm">Aba Dashboard</label>
            </div>
            <button onClick={createModule} className="text-xs px-3 py-1 bg-blue-600 text-white rounded">Salvar</button>
          </div>
        </div>

        <div className="bg-white rounded border p-3 md:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Programas {selectedModule ? `• ${selectedModule.name}` : ''}</h2>
            <div className="flex items-center gap-2">
              {selectedProgramId && (
                <button
                  onClick={() => {
                    const p = programs.find(pp => pp.id === selectedProgramId);
                    if (!p) return;
                  setEditingProgram(true);
                  setProgCode(p.code || '');
                  setProgName(p.name || '');
                  setProgDesc(p.description || '');
                }}
                className="text-xs px-2 py-1 border rounded"
              >Editar</button>
              )}
              <button
                onClick={deleteProgram}
                disabled={!selectedProgramId}
                className={`text-xs px-2 py-1 rounded border ${selectedProgramId ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-gray-300 text-gray-400 cursor-not-allowed'}`}
                title={selectedProgramId ? 'Excluir programa selecionado e seus vínculos' : 'Selecione um programa para excluir'}
              >
                Excluir selecionado
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {programs.map(p => (
              <div key={p.id} className={`w-full flex items-center justify-between gap-2 px-2 py-1 border rounded ${selectedProgramId===p.id?'bg-blue-50 border-blue-200':'hover:bg-gray-50'}`}>
                <button onClick={() => setSelectedProgramId(p.id)} className="text-left flex-1">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.code}</div>
                </button>
                <label className="flex items-center gap-1 text-xs" title="Controle de exibição no menu">
                  <input
                    type="checkbox"
                    checked={p.showInMenu !== false}
                    onClick={(e) => e.stopPropagation()}
                    onChange={async (e) => {
                      try {
                        const res = await fetch(`/api/admin/modules/${selectedModuleId}/programs/${p.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ showInMenu: e.target.checked })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
                        await loadPrograms(Number(selectedModuleId));
                      } catch (err: any) {
                        setErr(err?.message || String(err));
                      }
                    }}
                  />
                  <span>Exibe Menu</span>
                </label>
              </div>
            ))}
            {programs.length === 0 && <div className="text-sm text-gray-500">Selecione um módulo</div>}
          </div>
          <div className="mt-4 space-y-2">
            <div className="text-sm font-medium">{editingProgram ? 'Editar Programa' : 'Cadastrar Programa'}</div>
            <input value={progCode} onChange={e=>setProgCode(e.target.value)} readOnly={editingProgram} placeholder="Código" className="w-full border rounded px-2 py-1 text-sm" />
            <input value={progName} onChange={e=>setProgName(e.target.value)} placeholder="Nome" className="w-full border rounded px-2 py-1 text-sm" />
            <textarea value={progDesc} onChange={e=>setProgDesc(e.target.value)} placeholder="Descrição (opcional)" className="w-full border rounded px-2 py-1 text-sm" />
            <button onClick={createProgram} className="text-xs px-3 py-1 bg-blue-600 text-white rounded">Salvar</button>
          </div>
        </div>
      </div>

      {loading && <div className="text-xs text-gray-500">Carregando...</div>}
    </div>
  );
}
