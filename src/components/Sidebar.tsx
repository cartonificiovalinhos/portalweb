"use client";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import React, { useEffect, useState } from "react";

type Program = { code: string; name: string };
type ModulePerm = { code: string; name: string; programs: Program[] };
type Permissions = { activeEntityId: number | null; entities: { id: number; name: string }[]; modules: ModulePerm[] } | null;

const Icon = {
  module: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v6H4V4zm0 8h10v8H4v-8zm12 0h4v8h-4v-8z"/></svg>
  ),
  adminModule: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a3 3 0 013 3v2h2a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V10a3 3 0 013-3h2V5a3 3 0 013-3zm-3 5h6V5a1 1 0 00-1-1H10a1 1 0 00-1 1v2z"/></svg>
  ),
  maintModule: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M21 7l-4-4-3 3 4 4 3-3zM3 17v4h4l10-10-4-4L3 17z"/></svg>
  ),
  salesModule: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4h13l-1 9H8L7 4zm-1 11h14v2H6v-2zm1 4h12v2H7v-2z"/></svg>
  ),
  caretRight: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6l6 6-6 6V6z"/></svg>
  ),
  caretDown: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 9l6 6 6-6H6z"/></svg>
  ),
  dashboard: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
  ),
  assets: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v4H4V4zm0 6h10v10H4V10zm12 0h4v10h-4V10z"/></svg>
  ),
  workOrders: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h10a2 2 0 012 2v14l-7-3-7 3V5a2 2 0 012-2z"/></svg>
  ),
  inventory: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20 8H4V4h16v4zm0 2H4v10h16V10zM6 12h5v6H6v-6z"/></svg>
  ),
  reports: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18v2H3V4zm2 4h14v12H5V8zm3 2v8h2v-8H8zm4 0v8h2v-8h-2zm4 0v8h2v-8h-2z"/></svg>
  ),
  users: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm-9 9a9 9 0 0118 0H3z"/></svg>
  ),
  settings: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9.4 4a7.43 7.43 0 00-.3-2l2.1-1.6-2-3.5-2.5 1a7.86 7.86 0 00-1.7-1l-.4-2.7h-4l-.4 2.7a7.86 7.86 0 00-1.7 1l-2.5-1-2 3.5L2.9 10a7.43 7.43 0 00-.3 2c0 .7.1 1.3.3 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.7h4l.4-2.7c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5-2.1-1.6c.2-.7.3-1.3.3-2z"/></svg>
  ),
  adminEntities: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 10l9-7 9 7v10H3V10zm4 2h10v6H7v-6z"/></svg>
  ),
  adminModules: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M10 2l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4zm8 12l4 2-4 2-2 4-2-4-4-2 4-2 2-4 2 4z"/></svg>
  ),
  salesCreateOrder: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4h13l-1 9H8L7 4zm-1 11h8v2H6v-2zm0 4h12v2H6v-2z"/></svg>
  ),
  salesOrderSearch: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M10 2a8 8 0 106.32 12.9l3.39 3.39 1.4-1.41-3.39-3.39A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4z"/></svg>
  ),
  salesClientSearch: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0H5z"/></svg>
  ),
  salesProductionSchedule: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h2v2h6V2h2v2h3v16H4V4h3V2zm0 6h10v2H7V8zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/></svg>
  ),
};

function programHref(code: string): string | null {
  switch (code) {
    case 'DASHBOARD': return '/';
    case 'ASSETS': return '/assets';
    case 'WORK_ORDERS': return '/work-orders';
    case 'REPORTS': return '/reports';
    case 'USERS': return '/users';
    case 'SETTINGS': return '/settings';
    case 'ADMIN_ENTITIES': return '/admin/entities';
    case 'ADMIN_MODULES': return '/admin/modules';
    case 'SALES_CREATE_ORDER': return '/sales/orders/new';
    case 'SALES_ORDER_SEARCH': return '/sales/orders';
    case 'SALES_CLIENT_SEARCH': return '/sales/clients';
    case 'SALES_PRODUCTION_SCHEDULE': return '/sales/production-schedule';
    case 'SALES_REPRESENTATIVE': return '/sales/representative';
    case 'CLIENTS': return '/base/clients';
    case 'PAYMENT_TERMS': return '/base/payment-terms';
    case 'COMMERCIAL_FAMILY': return '/base/commercial-family';
    case 'ITEM_MAINTENANCE': return '/base/items';
    // SAC
    case 'SAC_COMPLAINT_MAINTENANCE': return '/sac/complaints/maintenance';
    case 'SAC_COMPLAINT_SEARCH': return '/sac/complaints/search';
    case 'SAC_COMPLAINT_CREATE': return '/sac/complaints/new';
    case 'SAC_STANDARD_OCCURRENCE': return '/sac/occurrences/standard';
    // Gestão FinTI
    case 'DESPESAS': return '/admin/modules/gestao-finti/despesas';
    case 'PAGAMENTOS': return '/admin/modules/gestao-finti/pagamentos';
    case 'ANALISE': return '/admin/modules/gestao-finti/analise';
    case 'ORCAMENTOS': return '/admin/modules/gestao-finti/orcamentos';
    case 'ATIVOS': return '/admin/modules/gestao-finti/ativos';
    case 'CONTRATOS': return '/admin/modules/gestao-finti/contratos';
    case 'CONFIGURACOES': return '/admin/modules/gestao-finti/configuracoes';
    default: return null;
  }
}

export default function Sidebar({ perms, mobileOpen, setMobileOpen, pathname, userLabel }: { perms: Permissions; mobileOpen?: boolean; setMobileOpen?: (v: boolean) => void; pathname: string | null; userLabel?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Only access localStorage on client and for desktop preference
    const saved = localStorage.getItem("sidebar-collapsed");
    setCollapsed(saved === "1");
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
  };

  // Close mobile menu when route changes
  useEffect(() => {
    if (setMobileOpen) setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    const mods = perms?.modules ?? [];
    const allowed = new Set(mods.map((m) => m.code));
    setExpanded((prev) => {
      const next: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev || {})) {
        if (allowed.has(k)) next[k] = v;
      }
      return next;
    });
  }, [perms?.modules]);

  const toggleModule = (code: string) => {
    setExpanded((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen?.(false)}
        />
      )}
      
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 bg-gray-900 text-white h-screen flex flex-col transition-all duration-300
          md:sticky md:top-0 md:shrink-0
          ${mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0"}
          ${collapsed ? "md:w-16" : "md:w-64"}
          w-64
        `}
      >
        <div className={`px-3 py-4 border-b border-gray-950 flex items-center ${collapsed ? "justify-center md:justify-center" : "gap-2"}`}>
          <Image src="/icons/logo cartonificio.png" alt="Cartonifício Valinhos" width={32} height={32} className="w-8 h-8 object-contain" priority />
          {(!collapsed || mobileOpen) && (
            <div className={`md:${collapsed ? "hidden" : "block"}`}>
              <div className="text-sm font-semibold">Cartonifício Valinhos</div>
              <div className="text-xs text-gray-300">Manutenção</div>
            </div>
          )}
          {/* Desktop Toggle */}
          <button onClick={toggle} className="ml-auto text-gray-300 hover:text-white hidden md:block" aria-label="Alternar menu">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/></svg>
          </button>
          {/* Mobile Close */}
          <button onClick={() => setMobileOpen?.(false)} className="ml-auto text-gray-300 hover:text-white md:hidden" aria-label="Fechar menu">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      {mobileOpen && (
        <div className="px-3 py-3 border-b border-gray-950 md:hidden">
          <div className="text-xs text-gray-300">Usuário</div>
          <div className="text-sm font-medium text-white truncate">{userLabel || "-"}</div>
          <Link
            href="/"
            className="mt-3 w-full px-3 py-2 rounded text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
          >
            <span className="text-white">{Icon.dashboard}</span>
            <span>Dashboard</span>
          </Link>
        </div>
      )}
      <nav className="p-2 space-y-1 overflow-y-auto flex-1 sidebar-scroll">
        {(perms?.modules ?? []).map((m) => {
          const isExpanded = !!expanded[m.code];
          const anyActive = (m.programs || []).some((p) => {
            const href = programHref(p.code);
            if (!href) return false;
            return pathname === href || (href !== "/" && pathname?.startsWith(href));
          });
          return (
            <div key={m.code}>
              <button
                onClick={() => toggleModule(m.code)}
                className={`w-full flex items-center ${collapsed && !mobileOpen ? "justify-center" : "gap-2"} px-3 py-2 rounded text-sm transition-colors ${
                  anyActive ? "bg-gray-800 text-white" : "text-gray-200 hover:bg-gray-700"
                }`}
                aria-expanded={isExpanded}
              >
                {(!collapsed || mobileOpen) && (
                  <span className="text-white">
                    {isExpanded ? Icon.caretDown : Icon.caretRight}
                  </span>
                )}
                <span className="text-white">
                  {m.code === 'ADMIN' ? Icon.adminModule : m.code === 'MAINT' ? Icon.maintModule : m.code === 'SALES' ? Icon.salesModule : Icon.module}
                </span>
                {(!collapsed || mobileOpen) && <span className="font-medium">{m.name}</span>}
              </button>
              {isExpanded && (
                <div className="mt-1 space-y-1">
                  {(m.programs || []).map((p) => {
                    const href = programHref(p.code);
                    const icon = (() => {
                      switch (p.code) {
                        case 'DASHBOARD': return Icon.dashboard;
                        case 'ASSETS': return Icon.assets;
                        case 'WORK_ORDERS': return Icon.workOrders;
                        case 'INVENTORY': return Icon.inventory;
                        case 'REPORTS': return Icon.reports;
                        case 'USERS': return Icon.users;
                        case 'SETTINGS': return Icon.settings;
                        case 'ADMIN_ENTITIES': return Icon.adminEntities;
                        case 'ADMIN_MODULES': return Icon.adminModules;
                        case 'SALES_CREATE_ORDER': return Icon.salesCreateOrder;
                        case 'SALES_ORDER_SEARCH': return Icon.salesOrderSearch;
                        case 'SALES_CLIENT_SEARCH': return Icon.salesClientSearch;
                        case 'SALES_PRODUCTION_SCHEDULE': return Icon.salesProductionSchedule;
                        case 'SALES_REPRESENTATIVE': return Icon.users;
                        case 'CLIENTS': return Icon.users;
                        case 'PAYMENT_TERMS': return Icon.settings;
                        case 'COMMERCIAL_FAMILY': return Icon.settings;
                        case 'ITEM_MAINTENANCE': return Icon.inventory;
                        case 'SAC_STANDARD_OCCURRENCE': return Icon.settings;
                        // Gestão FinTI
                        case 'DESPESAS': return Icon.reports;
                        case 'PAGAMENTOS': return Icon.reports;
                        case 'ANALISE': return Icon.dashboard;
                        case 'ORCAMENTOS': return Icon.reports;
                        case 'ATIVOS': return Icon.assets;
                        case 'CONTRATOS': return Icon.reports;
                        case 'CONFIGURACOES': return Icon.settings;
                        default: return null;
                      }
                    })();
                    if (!href) {
                      return (
                        <div
                          key={p.code}
                          className={`ml-6 flex items-center ${collapsed && !mobileOpen ? "justify-center" : "gap-2"} px-3 py-2 rounded text-sm text-gray-400 opacity-70 cursor-not-allowed`}
                          title="Programa sem rota configurada"
                        >
                          {icon && <span className="text-gray-400">{icon}</span>}
                          {(!collapsed || mobileOpen) && <span>{p.name}</span>}
                        </div>
                      );
                    }
                    const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
                    return (
                      <Link
                        key={p.code}
                        href={href}
                        className={`ml-6 flex items-center ${collapsed && !mobileOpen ? "justify-center" : "gap-2"} px-3 py-2 rounded text-sm transition-colors ${
                          active ? "bg-gray-800 text-white" : "text-gray-200 hover:bg-gray-700"
                        }`}
                      >
                        {icon && <span className="text-white">{icon}</span>}
                        {(!collapsed || mobileOpen) && <span>{p.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto p-2 border-t border-gray-950">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={`w-full ${collapsed ? "px-0" : "px-3"} py-2 rounded text-sm text-gray-200 hover:bg-gray-700 flex items-center ${collapsed ? "justify-center" : "gap-2"}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 13v-2H7V8l-5 4 5 4v-3h9zM20 3h-8v2h8v14h-8v2h8a2 2 0 002-2V5a2 2 0 00-2-2z"/></svg>
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
