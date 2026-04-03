"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';

type EntityEntry = {
  id: number;
  name: string;
};

type UserEntry = { id: number; name: string; salesRepAdmin?: boolean };

type MultiOpt = { value: string; label: string };

function MultiSelectDropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: MultiOpt[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return value.map((v) => map.get(v)).filter(Boolean) as string[];
  }, [options, value]);

  const allChecked = options.length > 0 && value.length === options.length;

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <button
        type="button"
        className="border rounded px-3 py-1.5 text-sm w-full text-left focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {selectedLabels.length ? `${selectedLabels.length} selecionado(s)` : placeholder}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto border rounded bg-white shadow">
          <label className="flex items-center gap-2 px-3 py-2 text-sm border-b cursor-pointer">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => onChange(e.target.checked ? options.map((o) => o.value) : [])}
            />
            <span>Selecionar todas as opções</span>
          </label>
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(o.value)}
                onChange={(e) => {
                  onChange(
                    e.target.checked
                      ? (value.includes(o.value) ? value : [...value, o.value])
                      : value.filter((v) => v !== o.value)
                  );
                }}
              />
              <span>{o.label}</span>
            </label>
          ))}
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">Nenhuma opção disponível</div>
          )}
          <div className="flex items-center justify-between px-3 py-2 border-t text-xs">
            <button type="button" className="text-blue-600 hover:underline" onClick={() => onChange([])}>Limpar</button>
            <button type="button" className="text-gray-700 hover:underline" onClick={() => setOpen(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesDashboard() {
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<string>('');
  const [entityId, setEntityId] = useState<string>('');
  const [entities, setEntities] = useState<EntityEntry[]>([]);
  const [repOptions, setRepOptions] = useState<MultiOpt[]>([]);
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [activeGroupTab, setActiveGroupTab] = useState<'FAMILY' | 'CUSTOMER' | 'REP' | 'REGION'>('FAMILY');

  const months = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    const loadFilters = async () => {
      setLoading(true);
      try {
        const [permsRes, usersRes] = await Promise.all([
          fetch('/api/permissions', { cache: 'no-store' }).catch(() => null as any),
          fetch('/api/users', { cache: 'no-store' }).catch(() => null as any),
        ]);

        if (permsRes?.ok) {
          const j = await permsRes.json().catch(() => ({} as any));
          const list = Array.isArray(j?.entities) ? j.entities : [];
          setEntities(
            list
              .map((e: any) => ({ id: Number(e?.id), name: String(e?.name || '') }))
              .filter((e: any) => Number.isFinite(e.id) && e.id > 0 && e.name)
          );
        }

        if (usersRes?.ok) {
          const arr = await usersRes.json().catch(() => []);
          const list = Array.isArray(arr) ? (arr as UserEntry[]) : [];
          const reps = list.filter((u: any) => Boolean(u?.salesRepAdmin));
          const finalList = reps.length ? reps : list;
          setRepOptions(
            finalList
              .map((u: any) => ({ value: String(u.id), label: String(u.name || '') }))
              .filter((o: any) => o.value && o.label)
          );
        }
      } finally {
        setLoading(false);
      }
    };

    loadFilters();
  }, []);

  const regionOptions: MultiOpt[] = useMemo(() => {
    return [
      { value: 'NORTE', label: 'Norte' },
      { value: 'NORDESTE', label: 'Nordeste' },
      { value: 'CENTRO_OESTE', label: 'Centro-Oeste' },
      { value: 'SUDESTE', label: 'Sudeste' },
      { value: 'SUL', label: 'Sul' },
    ];
  }, []);

  const fmtInt = (v: number) => v.toLocaleString('pt-BR');
  const fmtDec = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const summary = {
    peso: { metaPrevista: 0, carregado: 0, devolucao: 0, realizadoLiq: 0, atingimento: 0, emCarteira: 0 },
    valor: { metaPrevista: 0, carregado: 0, devolucao: 0, realizadoLiq: 0, atingimento: 0, emCarteira: 0 },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-700 mb-1">Ano</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border rounded px-3 py-1.5 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-700 mb-1">Mês</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Todos</option>
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-700 mb-1">Entidade</label>
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Todas</option>
              {entities.map((e) => (
                <option key={e.id} value={String(e.id)}>{e.name}</option>
              ))}
            </select>
          </div>

          <MultiSelectDropdown
            label="Representante"
            placeholder={loading ? "Carregando..." : "Selecione..."}
            options={repOptions}
            value={selectedReps}
            onChange={setSelectedReps}
          />

          <MultiSelectDropdown
            label="Região"
            placeholder="Selecione..."
            options={regionOptions}
            value={selectedRegions}
            onChange={setSelectedRegions}
          />
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2 border-b font-medium">Tipo Agrupa</th>
                <th className="p-2 border-b font-medium text-right">Meta Prevista</th>
                <th className="p-2 border-b font-medium text-right">Carregado</th>
                <th className="p-2 border-b font-medium text-right">Devolução</th>
                <th className="p-2 border-b font-medium text-right">Realizado Líq</th>
                <th className="p-2 border-b font-medium text-right">(%)Atingimento</th>
                <th className="p-2 border-b font-medium text-right">Em Carteira</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border-b">Peso (KG)</td>
                <td className="p-2 border-b text-right">{fmtInt(summary.peso.metaPrevista)}</td>
                <td className="p-2 border-b text-right">{fmtInt(summary.peso.carregado)}</td>
                <td className="p-2 border-b text-right">{fmtInt(summary.peso.devolucao)}</td>
                <td className="p-2 border-b text-right">{fmtInt(summary.peso.realizadoLiq)}</td>
                <td className="p-2 border-b text-right">{fmtDec(summary.peso.atingimento)}</td>
                <td className="p-2 border-b text-right">{fmtInt(summary.peso.emCarteira)}</td>
              </tr>
              <tr>
                <td className="p-2">Valor</td>
                <td className="p-2 text-right">{fmtInt(summary.valor.metaPrevista)}</td>
                <td className="p-2 text-right">{fmtInt(summary.valor.carregado)}</td>
                <td className="p-2 text-right">{fmtInt(summary.valor.devolucao)}</td>
                <td className="p-2 text-right">{fmtInt(summary.valor.realizadoLiq)}</td>
                <td className="p-2 text-right">{fmtDec(summary.valor.atingimento)}</td>
                <td className="p-2 text-right">{fmtInt(summary.valor.emCarteira)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-6 border-b">
            <button
              type="button"
              onClick={() => setActiveGroupTab('FAMILY')}
              className={`px-1 pb-2 text-sm ${activeGroupTab === 'FAMILY' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Por Família
            </button>
            <button
              type="button"
              onClick={() => setActiveGroupTab('CUSTOMER')}
              className={`px-1 pb-2 text-sm ${activeGroupTab === 'CUSTOMER' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Por Cliente
            </button>
            <button
              type="button"
              onClick={() => setActiveGroupTab('REP')}
              className={`px-1 pb-2 text-sm ${activeGroupTab === 'REP' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Por Representante
            </button>
            <button
              type="button"
              onClick={() => setActiveGroupTab('REGION')}
              className={`px-1 pb-2 text-sm ${activeGroupTab === 'REGION' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Por Região
            </button>
          </div>

          <div className="mt-4 border rounded bg-gray-50 p-4 text-sm text-gray-600 min-h-24">
            {activeGroupTab === 'FAMILY' && <div>Conteúdo por família (em desenvolvimento).</div>}
            {activeGroupTab === 'CUSTOMER' && <div>Conteúdo por cliente (em desenvolvimento).</div>}
            {activeGroupTab === 'REP' && <div>Conteúdo por representante (em desenvolvimento).</div>}
            {activeGroupTab === 'REGION' && <div>Conteúdo por região (em desenvolvimento).</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
