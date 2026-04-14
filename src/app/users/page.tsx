"use client";
// Rebuild trigger: Fix webpack runtime error
import { useCallback, useEffect, useMemo, useState } from "react";

type EntityItem = { id: number; name: string; cnpj: string; linked: number | boolean };
type ModuleItem = { id: number; code: string; name: string; userLinked: number | boolean };
type ProgramItem = { id: number; code: string; name: string; allowed: number | boolean };

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", abbrevName: "", email: "", password: "", doc: "" });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState<boolean>(false);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [programs, setPrograms] = useState<ProgramItem[]>([]);

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId) || null, [users, selectedUserId]);
  const selectedEntity = useMemo(() => entities.find(e => e.id === selectedEntityId) || null, [entities, selectedEntityId]);
  const selectedModule = useMemo(() => modules.find(m => m.id === selectedModuleId) || null, [modules, selectedModuleId]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D+/g, "");
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const docStr = String((u as any)?.doc || "");
      const docDigits = docStr.replace(/\D+/g, "");
      return (
        name.includes(q) ||
        email.includes(q) ||
        (qDigits ? docDigits.includes(qDigits) : docStr.toLowerCase().includes(q))
      );
    });
  }, [users, userQuery]);
  const allVisibleSelected = useMemo(() => filteredUsers.length > 0 && filteredUsers.every((u:any) => selectedIds.includes(u.id)), [filteredUsers, selectedIds]);

  const loadUsers = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setUsers(arr);
      setSelectedUserId((prev) => prev ?? (arr.length ? arr[0].id : null));
      setSelectedIds((prev) => prev.filter((id) => arr.some((u:any) => u.id === id)));
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      if (editingUserId) {
        const res = await fetch(`/api/users`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingUserId, ...form }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
        setEditingUserId(null);
        setForm({ name: "", abbrevName: "", email: "", password: "", doc: "" });
        await loadUsers();
        setSelectedUserId(data.id);
      } else {
        const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
        setForm({ name: "", abbrevName: "", email: "", password: "", doc: "" });
        await loadUsers();
        setSelectedUserId(data.id);
      }
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const loadEntities = useCallback(async (uid: number) => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${uid}/entities`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setEntities(data.entities || []);
      setSelectedEntityId((prev) => prev ?? (data.entities?.length ? data.entities[0].id : null));
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  }, []);

  const loadModules = async (uid: number, eid: number) => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${uid}/entities/${eid}/modules`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setModules(data.modules || []);
      setSelectedModuleId(null);
      setPrograms([]);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const loadPrograms = async (uid: number, eid: number, mid: number) => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${uid}/entities/${eid}/modules/${mid}/programs`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setPrograms(data.programs || []);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { if (selectedUserId) loadEntities(selectedUserId); }, [selectedUserId, loadEntities]);
  useEffect(() => { if (selectedUserId && selectedEntityId) loadModules(selectedUserId, selectedEntityId); }, [selectedUserId, selectedEntityId]);
  useEffect(() => { if (selectedUserId && selectedEntityId && selectedModuleId) loadPrograms(selectedUserId, selectedEntityId, selectedModuleId); }, [selectedUserId, selectedEntityId, selectedModuleId]);

  const cancelEdit = () => {
    setEditingUserId(null);
    setForm({ name: "", abbrevName: "", email: "", password: "", doc: "" });
  };

  const toggleSalesRepAdmin = async (checked: boolean) => {
    if (!selectedUserId) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/users`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedUserId, salesRepAdmin: checked })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      // Atualizar lista mantendo seleção
      await loadUsers();
      setSelectedUserId(data.id);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const toggleSalesAdmin = async (checked: boolean) => {
    if (!selectedUserId) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/users`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedUserId, isSalesAdmin: checked })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      // Atualizar lista mantendo seleção
      await loadUsers();
      setSelectedUserId(data.id);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const toggleTwoFactorRequired = async (checked: boolean) => {
    if (!selectedUserId) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/users`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedUserId, twoFactorRequired: checked })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      // Atualizar lista mantendo seleção
      await loadUsers();
      setSelectedUserId(data.id);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const resetTwoFactor = async () => {
    if (!selectedUserId) return;
    if (!window.confirm("Deseja realmente resetar o 2FA deste usuário? O usuário precisará configurar novamente no próximo login.")) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/users/${selectedUserId}/reset-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await loadUsers();
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const setErpMode = async (mode: string) => {
    if (!selectedUserId) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/users`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedUserId, erpIntegrationMode: mode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await loadUsers();
      setSelectedUserId(data.id);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const bulkDelete = async () => {
    const ids = selectedIds.filter((n) => Number.isFinite(n));
    if (ids.length === 0) return;
    const ok = typeof window !== 'undefined' ? window.confirm(`Excluir ${ids.length} usuário(s) e remover vínculos?`) : true;
    if (!ok) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setSelectedIds([]);
      setEditingUserId(null);
      setForm({ name: "", email: "", password: "", doc: "" });
      await loadUsers();
      setSelectedUserId(null);
      setEntities([]);
      setModules([]);
      setPrograms([]);
      setSelectedEntityId(null);
      setSelectedModuleId(null);
      setFormOpen(false);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const toggleRow = (id: number, checked: boolean) => {
    setSelectedIds((prev) => checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((n) => n !== id));
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) setSelectedIds(Array.from(new Set([...selectedIds, ...filteredUsers.map((u:any) => u.id)])));
    else setSelectedIds((prev) => prev.filter((id) => !filteredUsers.some((u:any) => u.id === id)));
  };

  const openAddForm = () => {
    setEditingUserId(null);
    setForm({ name: "", abbrevName: "", email: "", password: "", doc: "" });
    setSelectedUserId(null);
    setEntities([]);
    setModules([]);
    setPrograms([]);
    setSelectedEntityId(null);
    setSelectedModuleId(null);
    setFormOpen(true);
  };

  const toggleEntityLink = async (eid: number, linked: boolean) => {
    if (!selectedUserId) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/entities`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId: eid, linked })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await loadEntities(selectedUserId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const toggleModuleLink = async (mid: number, linked: boolean) => {
    if (!selectedUserId || !selectedEntityId || !selectedEntity?.linked) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/entities/${selectedEntityId}/modules`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ moduleId: mid, linked })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await loadModules(selectedUserId, selectedEntityId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const toggleProgramAllowed = async (pid: number, allowed: boolean) => {
    if (!selectedUserId || !selectedEntityId || !selectedModuleId || !selectedEntity?.linked || !selectedModule?.userLinked) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/entities/${selectedEntityId}/modules/${selectedModuleId}/programs`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ programId: pid, allowed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await loadPrograms(selectedUserId, selectedEntityId, selectedModuleId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const linkAllModules = async () => {
    if (!selectedUserId || !selectedEntityId || !selectedEntity?.linked) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/entities/${selectedEntityId}/modules`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'link_all' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await loadModules(selectedUserId, selectedEntityId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const unlinkAllModules = async () => {
    if (!selectedUserId || !selectedEntityId || !selectedEntity?.linked) return;
    const ok = typeof window !== 'undefined' ? window.confirm('Desvincular todos os módulos deste usuário na entidade selecionada?') : true;
    if (!ok) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/entities/${selectedEntityId}/modules`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlink_all' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await loadModules(selectedUserId, selectedEntityId);
      setSelectedModuleId(null);
      setPrograms([]);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const linkAllPrograms = async () => {
    if (!selectedUserId || !selectedEntityId || !selectedModuleId || !selectedEntity?.linked || !selectedModule?.userLinked) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/entities/${selectedEntityId}/modules/${selectedModuleId}/programs`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'link_all' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await loadPrograms(selectedUserId, selectedEntityId, selectedModuleId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const unlinkAllPrograms = async () => {
    if (!selectedUserId || !selectedEntityId || !selectedModuleId || !selectedEntity?.linked || !selectedModule?.userLinked) return;
    const ok = typeof window !== 'undefined' ? window.confirm('Desvincular todos os programas deste usuário para o módulo selecionado?') : true;
    if (!ok) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/entities/${selectedEntityId}/modules/${selectedModuleId}/programs`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlink_all' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      await loadPrograms(selectedUserId, selectedEntityId, selectedModuleId);
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Administração • Usuários</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}

      <div className="bg-white rounded border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input value={userQuery} onChange={(e)=>setUserQuery(e.target.value)} placeholder="Buscar por nome, e-mail ou CPF/CNPJ" className="flex-1 border rounded px-3 py-2 text-sm" />
          <button type="button" onClick={openAddForm} className="px-3 py-2 rounded bg-green-600 text-white text-sm">Incluir usuário</button>
          <button type="button" onClick={bulkDelete} disabled={selectedIds.length===0} className="px-3 py-2 rounded border border-red-300 text-red-700 text-sm disabled:opacity-50">Excluir selecionados</button>
        </div>
        <div className="text-xs text-gray-600">{selectedIds.length > 0 ? `${selectedIds.length} selecionado(s)` : ''}</div>
        <div className="border rounded">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2 w-10"><input type="checkbox" checked={allVisibleSelected} onChange={(e)=>toggleSelectAllVisible(e.target.checked)} /></th>
                <th className="p-2">Nome</th>
                <th className="p-2">CPF/CNPJ</th>
                <th className="p-2">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u:any) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 text-center"><input type="checkbox" checked={selectedIds.includes(u.id)} onChange={(e)=>toggleRow(u.id, e.target.checked)} /></td>
                  <td className="p-2"><button type="button" className="text-left w-full" onClick={() => { setSelectedUserId(u.id); setEditingUserId(u.id); setForm({ name: u.name || '', abbrevName: String(u.abbrevName || ''), email: u.email || '', password: '', doc: String(u.doc || '') }); setFormOpen(true); }}>{u.name}</button></td>
                  <td className="p-2">{formatDoc(String(u.doc || ''))}</td>
                  <td className="p-2">{u.email}</td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={4} className="p-2 text-gray-500">Nenhum usuário</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="bg-white rounded border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Usuário</div>
          </div>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-2 content-start">
            <input className="border rounded px-3 py-2" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="border rounded px-3 py-2" placeholder="Nome Abrev" maxLength={15} value={form.abbrevName} onChange={(e) => setForm({ ...form, abbrevName: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="CPF/CNPJ" value={form.doc} onChange={(e) => setForm({ ...form, doc: e.target.value })} />
            <input className="border rounded px-3 py-2" type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input className="border rounded px-3 py-2" type="password" placeholder={editingUserId ? "Nova senha (opcional)" : "Senha"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingUserId} />
            <div>
              <button className="px-4 py-2 bg-gray-800 text-white rounded mr-2">{editingUserId ? 'Atualizar' : 'Salvar'}</button>
              {editingUserId && (
                <button type="button" onClick={cancelEdit} className="px-4 py-2 border rounded">Cancelar</button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Três blocos de list group: Entidades, Módulos e Programas */}
      {/* Bloco de Tag's */}
      {formOpen && (
      <div className="bg-white rounded border p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">Tags</h2>
        </div>
        <label className="text-sm flex items-center gap-1">
          <input
            type="checkbox"
            disabled={!selectedUser}
            checked={Boolean(selectedUser?.salesRepAdmin)}
            onChange={(ev) => toggleSalesRepAdmin(ev.target.checked)}
          />
          Representante
        </label>
        <label className="text-sm flex items-center gap-1 mt-1">
          <input
            type="checkbox"
            disabled={!selectedUser}
            checked={Boolean(selectedUser?.isSalesAdmin)}
            onChange={(ev) => toggleSalesAdmin(ev.target.checked)}
          />
          Adm Vendas
        </label>
        <div className="flex items-center gap-2 mt-1">
          <label className="text-base flex items-center gap-1">
    <input
      type="checkbox"
      disabled={!selectedUser}
      checked={Boolean(selectedUser?.twoFactorRequired)}
      onChange={(ev) => toggleTwoFactorRequired(ev.target.checked)}
    />
    2FA Obrigatório
  </label>
          {selectedUser?.hasTwoFactorSecret && (
            <button
              type="button"
              onClick={resetTwoFactor}
              className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200 hover:bg-red-200"
              title="Resetar 2FA do usuário"
            >
              Resetar 2FA
            </button>
          )}
        </div>
      </div>
      )}

      {formOpen && (
      <div className="bg-white rounded border p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">Integração com ERP</h2>
        </div>
        <div className="flex gap-4">
            <label className="text-xs flex items-center gap-1">
              <input
                type="radio"
                name="erpMode"
                disabled={!selectedUser}
                checked={selectedUser?.erpIntegrationMode === 'PROD'}
                onChange={() => setErpMode('PROD')}
              />
              Produção
            </label>
            <label className="text-xs flex items-center gap-1">
              <input
                type="radio"
                name="erpMode"
                disabled={!selectedUser}
                checked={!selectedUser?.erpIntegrationMode || selectedUser?.erpIntegrationMode === 'TEST'}
                onChange={() => setErpMode('TEST')}
              />
              Teste
            </label>
        </div>
      </div>
      )}

      {formOpen && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded border p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Entidades {selectedUser ? `• ${selectedUser.name}` : ''}</h2>
            {selectedUserId && <button type="button" onClick={() => loadEntities(selectedUserId!)} className="text-xs px-2 py-1 border rounded">Atualizar</button>}
          </div>
          <div className="space-y-2">
            {entities.map(e => (
              <div key={e.id} className={`flex items-center justify-between gap-2 px-2 py-1 rounded ${selectedEntityId===e.id?'bg-blue-50 border border-blue-200':'border'}`}>
                <button type="button" onClick={() => setSelectedEntityId(e.id)} className="text-left flex-1">
                  <div className="text-sm font-medium">{e.name}</div>
                  <div className="text-xs text-gray-500">{e.cnpj}</div>
                </button>
                <label className="text-xs flex items-center gap-1">
                  <input type="checkbox" checked={Boolean(e.linked)} onChange={ev => toggleEntityLink(e.id, ev.target.checked)} /> Vincular
                </label>
              </div>
            ))}
            {entities.length === 0 && (
              <div className="text-sm text-gray-500">{selectedUserId ? 'Nenhuma entidade cadastrada' : 'Selecione um usuário'}</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded border p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Módulos {selectedEntity ? `• ${selectedEntity.name}` : ''}</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={linkAllModules} disabled={!selectedEntity?.linked} className="text-xs px-2 py-1 border rounded">Vincular todos</button>
              <button type="button" onClick={unlinkAllModules} disabled={!selectedEntity?.linked} className="text-xs px-2 py-1 border rounded">Desvincular todos</button>
            </div>
          </div>
          <div className="space-y-2">
            {modules.map(m => (
              <div key={m.id} className={`flex items-center justify-between gap-2 px-2 py-1 rounded ${selectedModuleId===m.id?'bg-blue-50 border border-blue-200':'border'}`}>
                <button type="button" onClick={() => setSelectedModuleId(m.id)} className="text-left flex-1">
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.code}</div>
                </button>
                <label className="text-xs flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={Boolean(m.userLinked)}
                    disabled={!selectedEntity || !Boolean(selectedEntity.linked)}
                    onChange={ev => toggleModuleLink(m.id, ev.target.checked)}
                  />
                  Vincular
                </label>
              </div>
            ))}
            {modules.length === 0 && (
              <div className="text-sm text-gray-500">{selectedEntityId ? 'Nenhum módulo vinculado à entidade' : 'Selecione uma entidade'}</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded border p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Programas {selectedModule ? `• ${selectedModule.name}` : ''}</h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={linkAllPrograms} disabled={!selectedEntity?.linked || !selectedModule?.userLinked} className="text-xs px-2 py-1 border rounded">Vincular todos</button>
              <button type="button" onClick={unlinkAllPrograms} disabled={!selectedEntity?.linked || !selectedModule?.userLinked} className="text-xs px-2 py-1 border rounded">Desvincular todos</button>
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
                  <input
                    type="checkbox"
                    checked={Boolean(p.allowed)}
                    disabled={!selectedEntity?.linked || !selectedModule?.userLinked}
                    onChange={ev => toggleProgramAllowed(p.id, ev.target.checked)}
                  />
                  Permitir
                </label>
              </div>
            ))}
            {programs.length === 0 && <div className="text-sm text-gray-500">Selecione um módulo</div>}
          </div>
        </div>
      </div>
      )}

      {loading && <div className="text-xs text-gray-500">Carregando...</div>}
    </div>
  );
}
function formatDoc(doc?: string): string {
  const d = String(doc || '').replace(/\D+/g, '');
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
  return doc || '';
}
