"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type User = { id: number; name: string; email: string };
type Client = { id: number; doc?: string; name: string; cidade?: string; estado?: string };

export default function RepresentativePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [linked, setLinked] = useState<Client[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const [mode, setMode] = useState<"all" | "linked" | "unlinked">("linked");

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q));
  }, [users, userQuery]);

  const linkedIds = useMemo(() => new Set(linked.map((c) => c.id)), [linked]);
  const displayClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    let base = clients.map((c) => ({ ...c, isLinked: linkedIds.has(c.id) } as any));
    if (mode === "linked") base = base.filter((c: any) => c.isLinked);
    if (mode === "unlinked") base = base.filter((c: any) => !c.isLinked);
    if (q) base = base.filter((c: any) =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.doc || "").toLowerCase().includes(q) ||
      (c.cidade || "").toLowerCase().includes(q) ||
      (c.estado || "").toLowerCase().includes(q)
    );
    return base;
  }, [clients, linkedIds, clientQuery, mode]);

  const loadUsers = useCallback(async () => {
    try {
      // Buscar todos os usuários e filtrar representantes no cliente,
      // para contornar qualquer inconsistência do endpoint com querystring
      const resAll = await fetch("/api/users");
      let list: any[] = [];
      if (resAll.ok && (resAll.headers.get("content-type") || "").includes("application/json")) {
        const arrAll = await resAll.json().catch(() => []);
        list = Array.isArray(arrAll) ? arrAll : [];
      }
      const reps = list.filter((u: any) => Boolean(u?.salesRepAdmin));
      const finalList = reps.length > 0 ? reps : list;
      setUsers(finalList);
      setSelectedUserId((prev) => (prev ?? (finalList.length ? finalList[0].id : null)));
    } catch {
      setUsers([]);
    }
  }, []);

  const loadClients = useCallback(async () => {
    const res = await fetch("/api/base/clients");
    const arr = await res.json();
    setClients(Array.isArray(arr) ? arr : []);
  }, []);

  const loadLinked = useCallback(async (userId: number | null) => {
    if (!userId) { setLinked([]); return; }
    const res = await fetch(`/api/sales/representatives/${userId}/clients`);
    const arr = await res.json();
    setLinked(Array.isArray(arr) ? arr : []);
  }, []);

  useEffect(() => { Promise.all([loadUsers(), loadClients()]); }, [loadUsers, loadClients]);
  useEffect(() => { loadLinked(selectedUserId); }, [selectedUserId, loadLinked]);

  const toggleRow = async (c: any, checked: boolean) => {
    if (!selectedUserId) return;
    if (checked && !c.isLinked) {
      await fetch(`/api/sales/representatives/${selectedUserId}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'link', clientIds: [c.id] }) });
      await loadLinked(selectedUserId);
    } else if (!checked && c.isLinked) {
      await fetch(`/api/sales/representatives/${selectedUserId}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlink', clientIds: [c.id] }) });
      await loadLinked(selectedUserId);
    }
  };

  const toggleAllVisible = async (checked: boolean) => {
    if (!selectedUserId) return;
    if (checked) {
      const toLink = displayClients.filter((c: any) => !c.isLinked).map((c: any) => c.id);
      if (toLink.length) {
        await fetch(`/api/sales/representatives/${selectedUserId}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'link', clientIds: toLink }) });
        await loadLinked(selectedUserId);
      }
    } else {
      const toUnlink = displayClients.filter((c: any) => c.isLinked).map((c: any) => c.id);
      if (toUnlink.length) {
        await fetch(`/api/sales/representatives/${selectedUserId}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unlink', clientIds: toUnlink }) });
        await loadLinked(selectedUserId);
      }
    }
  };

  

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Vendas • Representante</h1>
      <p className="text-sm text-gray-600 mb-4">Vincule clientes ao representante selecionado.</p>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Representante</label>
          <input
            type="text"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Buscar por nome"
            className="w-full border rounded px-3 py-2"
          />
          <div className="border rounded mt-1 max-h-40 overflow-auto">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${selectedUserId === u.id ? 'bg-gray-100' : ''}`}
                onClick={() => setSelectedUserId(u.id)}
                title="Selecionar representante"
              >
                {u.name}
              </button>
            ))}
            {!filteredUsers.length && (
              <div className="px-3 py-2 text-gray-500">Nenhum representante encontrado</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div>
            <label className="text-xs text-gray-600">Filtro</label>
            <input value={clientQuery} onChange={(e)=>setClientQuery(e.target.value)} placeholder="Nome, CNPJ/CPF, cidade ou estado" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Exibição</label>
            <select value={mode} onChange={(e)=>setMode(e.target.value as any)} className="w-full border rounded px-3 py-2">
              <option value="all">Todos</option>
              <option value="linked">Vinculados</option>
              <option value="unlinked">Não vinculados</option>
            </select>
          </div>
        </div>

        <div className="border rounded">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2 w-10"><input type="checkbox" checked={displayClients.length > 0 && displayClients.every((c:any)=>c.isLinked)} onChange={(e)=>toggleAllVisible(e.target.checked)} /></th>
                <th className="p-2">Cliente</th>
                <th className="p-2">CNPJ/CPF</th>
                <th className="p-2">Cidade</th>
                <th className="p-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {displayClients.map((c:any) => (
                <tr key={c.id} className="border-b">
                  <td className="p-2 text-center"><input type="checkbox" checked={c.isLinked} onChange={(e)=>toggleRow(c, e.target.checked)} disabled={!selectedUserId} /></td>
                  <td className="p-2">{c.name}</td>
                  <td className="p-2">{c.doc || ''}</td>
                  <td className="p-2">{c.cidade || ''}</td>
                  <td className="p-2">{c.estado || ''}</td>
                </tr>
              ))}
              {displayClients.length === 0 && (
                <tr><td colSpan={5} className="p-2 text-gray-500">Nenhum cliente</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
