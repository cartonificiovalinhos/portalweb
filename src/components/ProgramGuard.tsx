"use client";
import Link from "next/link";
import React from "react";

type Program = { code: string; name: string };
type ModulePerm = { code: string; name: string; programs: Program[] };
type Permissions = { activeEntityId: number | null; entities: { id: number; name: string }[]; modules: ModulePerm[] };

function pathToProgramCode(pathname: string): string | null {
  // Dashboard is always allowed (content is filtered by page)
  if (pathname === "/" || pathname.startsWith("/dashboard")) return null;
  if (pathname.startsWith("/assets")) return "ASSETS";
  if (pathname.startsWith("/work-orders")) return "WORK_ORDERS";
  if (pathname.startsWith("/users")) return "USERS";
  if (pathname.startsWith("/settings")) return "SETTINGS";
  if (pathname.startsWith("/admin/entities")) return "ADMIN_ENTITIES";
  if (pathname.startsWith("/admin/modules")) return "ADMIN_MODULES";
  if (pathname.startsWith("/sales/orders")) return "SALES_ORDER_SEARCH";
  if (pathname.startsWith("/sales/clients")) return "SALES_CLIENT_SEARCH";
  if (pathname.startsWith("/sales/production-schedule")) return "SALES_PRODUCTION_SCHEDULE";
  if (pathname.startsWith("/sales/representative")) return "SALES_REPRESENTATIVE";
  if (pathname.startsWith("/base/clients")) return "CLIENTS";
  if (pathname.startsWith("/base/payment-terms")) return "PAYMENT_TERMS";
  if (pathname.startsWith("/base/commercial-family")) return "COMMERCIAL_FAMILY";
  if (pathname.startsWith("/base/items")) return "ITEM_MAINTENANCE";
  // SAC
  if (pathname.startsWith("/sac/complaints/maintenance")) return "SAC_COMPLAINT_MAINTENANCE";
  if (pathname.startsWith("/sac/complaints/search")) return "SAC_COMPLAINT_SEARCH";
  if (pathname.startsWith("/sac/complaints/new")) return "SAC_COMPLAINT_CREATE";
  if (pathname.startsWith("/sac/occurrences/standard")) return "SAC_STANDARD_OCCURRENCE";
  if (pathname.startsWith("/reports")) return "REPORTS";
  return null;
}

export default function ProgramGuard({ perms, children, pathname }: { perms: Permissions | null; children: React.ReactNode; pathname: string | null }) {
  const code = pathname ? pathToProgramCode(pathname) : null;
  if (!code || !perms || !perms.activeEntityId) return <>{children}</>;
  const allowed = perms.modules.some((m) => m.programs.some((p) => p.code === code));
  if (allowed) return <>{children}</>;
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-2">Acesso restrito</h2>
      <p className="text-gray-600 mb-3">Você não tem permissão para acessar este programa na entidade selecionada.</p>
      <Link href="/" className="px-3 py-2 bg-blue-600 text-white rounded">Voltar ao Dashboard</Link>
    </div>
  );
}
