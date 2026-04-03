"use client";
import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import ProgramGuard from "./ProgramGuard";
import { KeyRound, Loader2 } from "lucide-react";

type Entity = { id: number; name: string; cnpj?: string };
type Program = { code: string; name: string };
type ModulePerm = { code: string; name: string; programs: Program[] };
type Permissions = { activeEntityId: number | null; entities: Entity[]; modules: ModulePerm[] };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLogin = pathname === "/login";

  const [perms, setPerms] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwRepeat, setPwRepeat] = useState("");
  const [pwTwoFactor, setPwTwoFactor] = useState("");
  const [pwRequire2fa, setPwRequire2fa] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const activeEntityId = (perms?.activeEntityId ?? null);

  useEffect(() => {
    if (status === "unauthenticated" && !isLogin) {
       window.location.href = "/login";
    }
  }, [status, isLogin]);

  const loadPerms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/permissions', { cache: 'no-store' });
      if (!r.ok) throw new Error(`Status: ${r.status}`);
      const j = await r.json();
      setPerms(j);
    } catch (err: any) {
      console.error("Failed to load permissions:", err);
      setError(err.message || "Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Recarregar permissões quando a sessão estiver confirmada
  useEffect(() => { 
    if (status === 'authenticated' && !isLogin) {
      loadPerms();
    }
  }, [status, isLogin, loadPerms]);

  const onChangeEntity = useCallback(async (id: number) => {
    try {
      const r = await fetch('/api/session/entity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityId: id }) });
      if (r.ok) {
        await loadPerms();
      }
    } catch {}
  }, [loadPerms]);

  useEffect(() => {
    if (status !== 'authenticated' || isLogin || autoSelected) return;
    if (!perms?.activeEntityId && Array.isArray(perms?.entities) && perms.entities.length > 0) {
      setAutoSelected(true);
      onChangeEntity(Number(perms.entities[0].id));
    }
  }, [status, isLogin, perms, autoSelected, onChangeEntity]);

  useEffect(() => {
    const fetchCount = async () => {
        try {
            const res = await fetch('/api/sales/representative/cart-count', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setCartCount(data.count || 0);
            }
        } catch {}
    };
    if (status === 'authenticated' && !isLogin) {
        fetchCount();
        // Update count periodically (30s)
        const interval = setInterval(fetchCount, 30000); 
        return () => clearInterval(interval);
    }
  }, [status, isLogin]);

  if (isLogin) {
    return <main className="min-h-screen">{children}</main>;
  }
  return (
    <div className="flex">
      <Sidebar perms={perms} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} pathname={pathname} />
      <main className="flex-1 min-h-screen">
        {/* Top bar com seletor de entidade */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-3 flex items-center gap-3">
          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-1 mr-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>

          <div className="text-sm text-gray-700 hidden sm:block">Entidade:</div>
          <select
            className="text-sm border rounded px-2 py-1"
            value={activeEntityId ?? ''}
            onChange={(e) => onChangeEntity(Number(e.target.value))}
          >
            {perms?.entities?.map((en) => (
              <option key={en.id} value={en.id}>{en.name}</option>
            ))}
          </select>
          {/* ID do usuário logado ao lado do seletor de entidade */}
          <div className="text-xs text-gray-600">Usuário: {session?.user?.name ?? (session?.user as any)?.id ?? '-'}</div>
          
          <div className="ml-auto flex items-center gap-4">
            {loading && <div className="text-xs text-gray-500">Carregando permissões…</div>}
            {error && <div className="text-xs text-red-600">{error}</div>}
            
            <Link href="/" className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-all shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                Dashboard
            </Link>

            <Link href="/sales/carts" className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" title="Vendas - Carrinhos Cliente">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="21" r="1" />
                    <circle cx="19" cy="21" r="1" />
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>
                {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border border-white">
                        {cartCount}
                    </span>
                )}
            </Link>

            <button
              onClick={() => {
                setPwError(null);
                setPwCurrent("");
                setPwNew("");
                setPwRepeat("");
                setPwTwoFactor("");
                setPwRequire2fa(false);
                setChangePwOpen(true);
              }}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
              title="Alterar senha"
              aria-label="Alterar senha"
            >
              <KeyRound size={20} />
            </button>

            <button 
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-all shadow-sm ml-2"
                title="Sair do sistema"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
        <div className="p-3">
          <ProgramGuard perms={perms} pathname={pathname}>
            {children}
          </ProgramGuard>
        </div>
      </main>

      {changePwOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50"
          onClick={() => (pwSaving ? null : setChangePwOpen(false))}
        >
          <div className="bg-white w-full max-w-md rounded shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center">
              <div className="font-semibold">Alterar senha</div>
              <button
                className="ml-auto text-gray-500 hover:text-black"
                onClick={() => (pwSaving ? null : setChangePwOpen(false))}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              {pwError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{pwError}</div>}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Senha atual</label>
                <input
                  type="password"
                  className="border rounded px-3 py-2 text-sm w-full"
                  value={pwCurrent}
                  onChange={(e) => setPwCurrent(e.target.value)}
                  disabled={pwSaving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nova senha</label>
                <input
                  type="password"
                  className="border rounded px-3 py-2 text-sm w-full"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  disabled={pwSaving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Repetir nova senha</label>
                <input
                  type="password"
                  className="border rounded px-3 py-2 text-sm w-full"
                  value={pwRepeat}
                  onChange={(e) => setPwRepeat(e.target.value)}
                  disabled={pwSaving}
                />
              </div>

              {pwRequire2fa && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Código 2FA</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="border rounded px-3 py-2 text-sm w-full"
                    value={pwTwoFactor}
                    onChange={(e) => setPwTwoFactor(e.target.value)}
                    disabled={pwSaving}
                  />
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                className="px-3 py-1.5 border rounded hover:bg-gray-100 disabled:opacity-50"
                onClick={() => setChangePwOpen(false)}
                disabled={pwSaving}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                disabled={pwSaving}
                onClick={async () => {
                  setPwError(null);
                  const currentPassword = pwCurrent;
                  const newPassword = pwNew;
                  const repeat = pwRepeat;
                  if (!currentPassword || !newPassword || !repeat) {
                    setPwError("Preencha todos os campos.");
                    return;
                  }
                  if (newPassword !== repeat) {
                    setPwError("A nova senha e a repetição não conferem.");
                    return;
                  }

                  setPwSaving(true);
                  try {
                    const res = await fetch("/api/auth/change-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        currentPassword,
                        newPassword,
                        twoFactorCode: pwRequire2fa ? pwTwoFactor : undefined,
                      }),
                    });
                    const payload = await res.json().catch(() => ({}));

                    if (res.status === 409 && payload?.requiresTwoFactor) {
                      setPwRequire2fa(true);
                      setPwError("Informe o código 2FA para confirmar.");
                      return;
                    }
                    if (!res.ok) {
                      setPwError(String(payload?.error || payload?.message || `Erro ao alterar senha (${res.status})`));
                      return;
                    }

                    setChangePwOpen(false);
                    alert("Senha alterada com sucesso.");
                  } catch (e: any) {
                    setPwError(String(e?.message || e));
                  } finally {
                    setPwSaving(false);
                  }
                }}
              >
                {pwSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                Alterar senha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
