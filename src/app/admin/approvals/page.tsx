"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CommercialFamily = { id: number; description: string; erpCode?: string | null };
type ApprovalUser = {
  id: number;
  canView: boolean;
  discountFrom: number | null;
  discountTo: number | null;
  user: { id: number; name: string; abbrevName?: string | null; email?: string | null; doc?: string | null };
};
type UserSearchRow = { id: number; name: string; abbrevName?: string | null; email?: string | null; doc?: string | null };

function parseMoneyInput(v: string): number | null {
  const t = String(v || "").trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function AdminApprovalsPage() {
  const [tab, setTab] = useState<"commercial" | "supplies" | "finance">("commercial");
  const [families, setFamilies] = useState<CommercialFamily[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);
  const selectedFamily = useMemo(() => families.find((f) => f.id === selectedFamilyId) || null, [families, selectedFamilyId]);
  const [linked, setLinked] = useState<ApprovalUser[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserSearchRow[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const searchTimer = useRef<any>(null);

  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const loadFamilies = useCallback(async () => {
    setLoadingFamilies(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/approvals/commercial-families", { cache: "no-store" });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      const arr = Array.isArray(data?.families) ? (data.families as CommercialFamily[]) : [];
      setFamilies(arr);
      setSelectedFamilyId((prev) => prev ?? (arr[0]?.id ?? null));
    } catch (e: any) {
      setErr(e?.message || String(e));
      setFamilies([]);
    } finally {
      setLoadingFamilies(false);
    }
  }, []);

  const loadLinked = useCallback(async (familyId: number) => {
    setLoadingLinked(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/approvals/commercial-families/${familyId}/users`, { cache: "no-store" });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setLinked(Array.isArray(data?.users) ? (data.users as ApprovalUser[]) : []);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setLinked([]);
    } finally {
      setLoadingLinked(false);
    }
  }, []);

  useEffect(() => {
    void loadFamilies();
  }, [loadFamilies]);

  useEffect(() => {
    if (tab !== "commercial") return;
    if (!selectedFamilyId) return;
    void loadLinked(selectedFamilyId);
  }, [loadLinked, selectedFamilyId, tab]);

  useEffect(() => {
    if (tab !== "commercial") return;
    const q = userQuery.trim();
    if (!q || !selectedFamilyId) {
      setUserResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchingUsers(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/approvals/users?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
        const arr = Array.isArray(data?.users) ? (data.users as UserSearchRow[]) : [];
        setUserResults(arr);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setUserResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [selectedFamilyId, tab, userQuery]);

  const linkedUserIds = useMemo(() => new Set(linked.map((x) => x.user.id)), [linked]);
  const availableUserResults = useMemo(() => userResults.filter((u) => !linkedUserIds.has(u.id)), [linkedUserIds, userResults]);

  const upsertLink = useCallback(async (familyId: number, userId: number, patch: { canView?: boolean; discountFrom?: number | null; discountTo?: number | null }) => {
    setSavingUserId(userId);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/approvals/commercial-families/${familyId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      const saved = data?.user as ApprovalUser;
      setLinked((prev) => {
        const idx = prev.findIndex((x) => x.user.id === userId);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      setUserQuery("");
      setUserResults([]);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSavingUserId(null);
    }
  }, []);

  const unlink = useCallback(async (familyId: number, userId: number) => {
    const ok = typeof window !== "undefined" ? window.confirm("Confirma desvincular o usuário desta família?") : true;
    if (!ok) return;
    setSavingUserId(userId);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/approvals/commercial-families/${familyId}/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
      setLinked((prev) => prev.filter((x) => x.user.id !== userId));
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSavingUserId(null);
    }
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Administração • Aprovações</h1>

      <div className="flex flex-wrap gap-2 border-b">
        <button className={`px-3 py-2 text-sm ${tab === "commercial" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-600"}`} onClick={() => setTab("commercial")}>Comercial</button>
        <button className={`px-3 py-2 text-sm ${tab === "supplies" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-600"}`} onClick={() => setTab("supplies")}>Suprimentos</button>
        <button className={`px-3 py-2 text-sm ${tab === "finance" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-600"}`} onClick={() => setTab("finance")}>Financeiro</button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {tab === "commercial" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded border p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">Famílias Comerciais</h2>
              <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={loadFamilies} disabled={loadingFamilies}>
                Atualizar
              </button>
            </div>
            {loadingFamilies && <div className="text-sm text-gray-500">Carregando...</div>}
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {families.map((f) => (
                <button
                  key={f.id}
                  className={`w-full text-left px-2 py-2 rounded border ${selectedFamilyId === f.id ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"}`}
                  onClick={() => setSelectedFamilyId(f.id)}
                >
                  <div className="text-sm font-medium">{f.description}</div>
                  <div className="text-xs text-gray-500">{f.erpCode || "-"}</div>
                </button>
              ))}
              {!loadingFamilies && families.length === 0 && <div className="text-sm text-gray-500">Nenhuma família cadastrada</div>}
            </div>
          </div>

          <div className="bg-white rounded border p-3 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="font-medium">Usuários • {selectedFamily ? selectedFamily.description : "Selecione uma família"}</h2>
              {selectedFamilyId && (
                <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={() => loadLinked(selectedFamilyId)} disabled={loadingLinked}>
                  Atualizar
                </button>
              )}
            </div>

            {!selectedFamilyId && <div className="text-sm text-gray-500">Selecione uma família para configurar aprovações.</div>}
            {selectedFamilyId && (
              <>
                <div className="flex flex-col md:flex-row gap-2 md:items-center mb-3">
                  <div className="flex-1">
                    <input
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="Pesquisar usuário (nome, nome abrev, e-mail ou doc)"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                    />
                    {searchingUsers && <div className="text-xs text-gray-500 mt-1">Pesquisando...</div>}
                  </div>
                </div>

                {userQuery.trim() && availableUserResults.length > 0 && (
                  <div className="border rounded mb-3 max-h-48 overflow-auto">
                    {availableUserResults.map((u) => (
                      <div key={u.id} className="px-3 py-2 border-b last:border-b-0 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{u.name}</div>
                          <div className="text-xs text-gray-600 truncate">{u.abbrevName || "-"} • {u.email || "-"} • {u.doc || "-"}</div>
                        </div>
                        <button
                          className="text-xs px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                          disabled={savingUserId === u.id}
                          onClick={() => selectedFamilyId && upsertLink(selectedFamilyId, u.id, { canView: true, discountFrom: null, discountTo: null })}
                        >
                          Vincular
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="text-left px-3 py-2">Usuário</th>
                        <th className="text-center px-3 py-2">Visualiza</th>
                        <th className="text-right px-3 py-2">Descto de R$</th>
                        <th className="text-right px-3 py-2">Descto até R$</th>
                        <th className="text-center px-3 py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingLinked && (
                        <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Carregando...</td></tr>
                      )}
                      {!loadingLinked && linked.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Nenhum usuário vinculado.</td></tr>
                      )}
                      {!loadingLinked && linked.map((row) => (
                        <tr key={row.user.id} className="border-t">
                          <td className="px-3 py-2">
                            <div className="font-medium">{row.user.name}</div>
                            <div className="text-xs text-gray-600">{row.user.abbrevName || "-"} • {row.user.email || "-"} • {row.user.doc || "-"}</div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!row.canView}
                              disabled={savingUserId === row.user.id}
                              onChange={(e) => selectedFamilyId && upsertLink(selectedFamilyId, row.user.id, { canView: e.target.checked, discountFrom: row.discountFrom, discountTo: row.discountTo })}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              className="w-28 px-2 py-1 border rounded text-sm text-right"
                              defaultValue={row.discountFrom == null ? "" : String(row.discountFrom).replace(".", ",")}
                              disabled={savingUserId === row.user.id}
                              onBlur={(e) => {
                                if (!selectedFamilyId) return;
                                const v = parseMoneyInput(e.target.value);
                                upsertLink(selectedFamilyId, row.user.id, { canView: row.canView, discountFrom: v, discountTo: row.discountTo });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              className="w-28 px-2 py-1 border rounded text-sm text-right"
                              defaultValue={row.discountTo == null ? "" : String(row.discountTo).replace(".", ",")}
                              disabled={savingUserId === row.user.id}
                              onBlur={(e) => {
                                if (!selectedFamilyId) return;
                                const v = parseMoneyInput(e.target.value);
                                upsertLink(selectedFamilyId, row.user.id, { canView: row.canView, discountFrom: row.discountFrom, discountTo: v });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                              disabled={savingUserId === row.user.id}
                              onClick={() => selectedFamilyId && unlink(selectedFamilyId, row.user.id)}
                            >
                              Desvincular
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-2">
                  {linked.map((row) => (
                    <div key={row.user.id} className="border rounded p-3">
                      <div className="font-medium">{row.user.name}</div>
                      <div className="text-xs text-gray-600">{row.user.abbrevName || "-"} • {row.user.email || "-"} • {row.user.doc || "-"}</div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <label className="text-xs text-gray-600 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!row.canView}
                            disabled={savingUserId === row.user.id}
                            onChange={(e) => selectedFamilyId && upsertLink(selectedFamilyId, row.user.id, { canView: e.target.checked, discountFrom: row.discountFrom, discountTo: row.discountTo })}
                          />
                          Visualiza
                        </label>
                        <button
                          className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                          disabled={savingUserId === row.user.id}
                          onClick={() => selectedFamilyId && unlink(selectedFamilyId, row.user.id)}
                        >
                          Desvincular
                        </button>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Descto de R$</div>
                          <input
                            className="w-full px-2 py-1 border rounded text-sm text-right"
                            defaultValue={row.discountFrom == null ? "" : String(row.discountFrom).replace(".", ",")}
                            disabled={savingUserId === row.user.id}
                            onBlur={(e) => selectedFamilyId && upsertLink(selectedFamilyId, row.user.id, { canView: row.canView, discountFrom: parseMoneyInput(e.target.value), discountTo: row.discountTo })}
                          />
                        </div>
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Descto até R$</div>
                          <input
                            className="w-full px-2 py-1 border rounded text-sm text-right"
                            defaultValue={row.discountTo == null ? "" : String(row.discountTo).replace(".", ",")}
                            disabled={savingUserId === row.user.id}
                            onBlur={(e) => selectedFamilyId && upsertLink(selectedFamilyId, row.user.id, { canView: row.canView, discountFrom: row.discountFrom, discountTo: parseMoneyInput(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {!loadingLinked && linked.length === 0 && <div className="text-sm text-gray-500">Nenhum usuário vinculado.</div>}
                  {loadingLinked && <div className="text-sm text-gray-500">Carregando...</div>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab !== "commercial" && (
        <div className="bg-white rounded border p-4 text-sm text-gray-600">Em desenvolvimento.</div>
      )}
    </div>
  );
}

