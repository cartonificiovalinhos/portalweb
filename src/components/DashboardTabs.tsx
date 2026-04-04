"use client";
import React, { useState, useEffect } from "react";
import SalesDashboard from "./SalesDashboard";

type Module = {
  id: number;
  code: string;
  name: string;
};

interface DashboardTabsProps {
  modules: Module[];
  maintenanceContent: React.ReactNode;
}

export default function DashboardTabs({ modules, maintenanceContent }: DashboardTabsProps) {
  // Initialize with the first module's code, or null if empty
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    if (modules.length > 0 && !activeTab) {
      // Prefer MAINT if available, otherwise first one
      const maint = modules.find(m => m.code === 'MAINT');
      setActiveTab(maint ? maint.code : modules[0].code);
    }
  }, [modules, activeTab]);

  if (modules.length === 0) {
    return (
      <div className="text-gray-500 italic">
        Nenhum módulo com dashboard configurado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 flex items-end justify-between gap-4">
        <ul className="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500">
          {modules.map((m) => (
            <li key={m.code} className="mr-2">
              <button
                onClick={() => setActiveTab(m.code)}
                className={`inline-block px-3 py-2 border-b-2 border-solid rounded-t-lg transition-colors duration-200 ${
                  activeTab === m.code
                    ? "text-blue-600 border-blue-600 active group-hover:text-blue-600"
                    : "border-transparent hover:text-gray-600 hover:border-gray-300"
                }`}
                aria-current={activeTab === m.code ? "page" : undefined}
              >
                {m.name}
              </button>
            </li>
          ))}
        </ul>
        <h1 className="text-2xl font-semibold text-gray-900 pb-2">Dashboard</h1>
      </div>

      <div className="pt-1">
        {activeTab === 'MAINT' ? (
          <div className="animate-in fade-in duration-300">
            {maintenanceContent}
          </div>
        ) : (activeTab === 'SALES' || activeTab === 'VENDAS') ? (
          <div className="animate-in fade-in duration-300">
            <SalesDashboard />
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded border border-dashed border-gray-200">
            <p>Dashboard do módulo <strong>{modules.find(m => m.code === activeTab)?.name}</strong></p>
            <p className="text-sm mt-2">Em desenvolvimento...</p>
          </div>
        )}
      </div>
    </div>
  );
}
