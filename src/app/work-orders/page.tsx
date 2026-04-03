"use client";
import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { safeParseJson } from "../../lib/safeJson";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import KanbanBoard from "../../components/KanbanBoard";

export default function WorkOrdersPage() {
  return (
    <Suspense fallback={<div className="p-4">Carregando ordens de serviço...</div>}>
      <WorkOrdersInner />
    </Suspense>
  );
}

function WorkOrdersInner() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>("");
  const [assets, setAssets] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", assetId: "", description: "", materials: "", scheduledAt: "", sector: "", maintenanceType: "", assetCondition: "", personnelCount: "", estimatedDurationMinutes: "", tasks: "", assignedUserId: "", recurrence: "" });
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [rootAssetId, setRootAssetId] = useState<number | null>(null);
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [view, setView] = useState<"list" | "kanban" | "calendar">("list");
  const [calMode, setCalMode] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ sector: string; maintenanceType: string; from: string; to: string; status: string }>({ sector: "", maintenanceType: "", from: "", to: "", status: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<{ sector: string; maintenanceType: string; scheduledAt: string }>({ sector: "", maintenanceType: "", scheduledAt: "" });
  const sectorOptions = ["Eletrica", "Mecanica", "Automacao", "Utilidades", "Segurança"];
  const typeOptions = ["Preventiva", "Corretiva", "Inspeção", "Melhoria", "Segurança"];
  const searchParams = useSearchParams();

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filters.sector) qs.set('sector', filters.sector);
    if (filters.maintenanceType) qs.set('maintenanceType', filters.maintenanceType);
    if (filters.from) qs.set('from', filters.from);
    if (filters.to) qs.set('to', filters.to);
    if (filters.status) qs.set('status', filters.status);
    const url = `/api/work-orders${qs.toString() ? `?${qs.toString()}` : ''}`;
    fetch(url)
      .then((r) => safeParseJson(r, []))
      .then((wo) => setData(Array.isArray(wo) ? wo : []))
      .finally(() => setLoading(false));
  }, [filters.from, filters.maintenanceType, filters.sector, filters.status, filters.to]);

  useEffect(() => {
    // Carregar ativos e lista de técnicos
    fetch("/api/assets").then((r) => r.json()).then((list) => {
      setAssets(list);
      const assetIdParam = searchParams?.get("assetId");
      const assetIdsParam = searchParams?.get("assetIds");
      const rootParam = searchParams?.get("rootAssetId");
      const createParam = searchParams?.get("create");
      if (rootParam) {
        const rid = Number(rootParam);
        if (!Number.isNaN(rid)) setRootAssetId(rid);
      }
      if (assetIdsParam) {
        const ids = assetIdsParam.split(',').map((s) => Number(s)).filter((n) => !Number.isNaN(n));
        setSelectedAssetIds(ids);
        if (ids.length) setForm((prev) => ({ ...prev, assetId: String(ids[0]) }));
      } else if (assetIdParam) {
        setForm((prev) => ({ ...prev, assetId: assetIdParam }));
      }
      if (createParam === '1' && (assetIdParam || assetIdsParam)) {
        setCreating(true);
      }
    });
    fetch("/api/users").then((r) => r.json()).then((users) => {
      const list = Array.isArray(users) ? users : [];
      setTechnicians(list);
    }).catch(() => setTechnicians([]));
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  const monthMatrix = useMemo(() => {
    if (calMode !== "month") return [] as Date[][];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const offset = (startDay + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Date[] = [];
    for (let i = 0; i < offset; i++) {
      cells.push(new Date(year, month, 1 - (offset - i)));
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const last = cells[cells.length - 1];
      cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
    }
    const weeks: Date[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [currentDate, calMode]);

  const colorByStatus = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'DONE': return 'bg-green-100 border-green-300 text-green-800';
      case 'CLOSED': return 'bg-gray-100 border-gray-300 text-gray-800';
      default: return 'bg-slate-100 border-slate-300 text-slate-800';
    }
  };

  const colorBySector = (sector?: string) => {
    switch ((sector || '').toLowerCase()) {
      case 'eletrica': return 'bg-sky-100 border-sky-300 text-sky-800';
      case 'mecanica': return 'bg-red-100 border-red-300 text-red-800';
      case 'automacao': return 'bg-amber-100 border-amber-300 text-amber-800';
      case 'utilidades': return 'bg-purple-100 border-purple-300 text-purple-800';
      case 'segurança': return 'bg-lime-100 border-lime-300 text-lime-800';
      default: return 'bg-slate-100 border-slate-300 text-slate-800';
    }
  };

  // Helpers para árvore de seleção hierárquica
  type Node = any & { children?: Node[] };
  const buildTree = (items: any[]): Node[] => {
    const byParent: Record<string, Node[]> = {};
    items.forEach((it: any) => {
      const pid = String(it.parentId ?? 'root');
      (byParent[pid] ??= []).push({ ...it, children: [] });
    });
    const idMap: Record<number, Node> = {};
    Object.values(byParent).flat().forEach((n) => { idMap[n.id] = n; });
    Object.values(idMap).forEach((n) => {
      const pid = String(n.parentId ?? 'root');
      if (pid !== 'root') (idMap[n.parentId!]!.children ??= []).push(n);
    });
    const roots: Node[] = (byParent['root'] || []).map((n) => idMap[n.id]);
    return roots;
  };
  const findNode = (nodes: Node[], id: number): Node | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const f = n.children ? findNode(n.children, id) : null;
      if (f) return f;
    }
    return null;
  };
  const listDescendants = (n: Node | null): number[] => {
    if (!n) return [];
    const acc: number[] = [];
    const dfs = (x: Node) => {
      (x.children || []).forEach((c) => { acc.push(c.id); dfs(c); });
    };
    dfs(n);
    return acc;
  };

  const colorBy = (w: any) => {
    if (w.sector) return colorBySector(w.sector);
    return colorByStatus(w.status);
  };

  const ordersByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    data.forEach((w) => {
      const s = w.scheduledAt || w.scheduled_at || null;
      if (!s) return;
      const dt = new Date(s);
      const key = dt.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    });
    return map;
  }, [data]);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const delta = (start.getDay() + 6) % 7; // Segunda como início
    start.setDate(start.getDate() - delta);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [currentDate]);

  const unscheduled = useMemo(() => data.filter((w) => !w.scheduledAt && !w.scheduled_at), [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ordens de Serviço</h1>
          <p className="text-gray-600">Visualize em Lista, Kanban ou Calendário.</p>
        </div>
        <button
          className="px-3 py-2 bg-blue-600 text-white rounded"
          onClick={() => setCreating((v) => !v)}
        >
          Criar nova OS
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-1 rounded border ${view === 'list' ? 'bg-gray-800 text-white' : 'bg-white'}`}
          onClick={() => setView('list')}
        >Lista</button>
        <button
          className={`px-3 py-1 rounded border ${view === 'kanban' ? 'bg-gray-800 text-white' : 'bg-white'}`}
          onClick={() => setView('kanban')}
        >Kanban</button>
        <button
          className={`px-3 py-1 rounded border ${view === 'calendar' ? 'bg-gray-800 text-white' : 'bg-white'}`}
          onClick={() => setView('calendar')}
        >Calendário</button>
        {view === 'calendar' && (
          <div className="ml-4 flex items-center gap-2">
            <button
              className={`px-2 py-1 rounded border ${calMode === 'month' ? 'bg-gray-800 text-white' : 'bg-white'}`}
              onClick={() => setCalMode('month')}
            >Mês</button>
            <button
              className={`px-2 py-1 rounded border ${calMode === 'week' ? 'bg-gray-800 text-white' : 'bg-white'}`}
              onClick={() => setCalMode('week')}
            >Semana</button>
          </div>
        )}
      </div>

      {creating && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => {
              setForm({ title: "", assetId: "", description: "", materials: "", scheduledAt: "", sector: "", maintenanceType: "", assetCondition: "", personnelCount: "", estimatedDurationMinutes: "", tasks: "", assignedUserId: "", recurrence: "" });
              setCreating(false);
            }}
          />
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl rounded shadow-lg">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="font-semibold">Nova OS</div>
                <button
                  className="text-sm px-2 py-1 rounded hover:bg-gray-100"
                  onClick={() => {
                    setForm({ title: "", assetId: "", description: "", materials: "", scheduledAt: "", sector: "", maintenanceType: "", assetCondition: "", personnelCount: "", estimatedDurationMinutes: "", tasks: "", assignedUserId: "", recurrence: "" });
                    setCreating(false);
                  }}
                  aria-label="Fechar"
                >✕</button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!form.title.trim()) { alert('Título é obrigatório'); return; }
                  if (form.scheduledAt) {
                    const d = new Date(form.scheduledAt);
                    const now = new Date();
                    if (!Number.isNaN(d.getTime()) && d.getTime() < now.getTime()) { alert('Data programada não pode ser no passado'); return; }
                  }
                  const tasksArray = form.tasks ? form.tasks.split('\n').map((t) => t.trim()).filter(Boolean) : undefined;
                  const personnel = form.personnelCount ? Number(form.personnelCount) : undefined;
                  const estimated = form.estimatedDurationMinutes ? Number(form.estimatedDurationMinutes) : undefined;
                  const recurrenceLabel = form.recurrence ? `\nRecorrência: ${
                    form.recurrence === 'daily' ? 'Diária' :
                    form.recurrence === 'weekly' ? 'Semanal' :
                    form.recurrence === 'monthly' ? 'Mensal' :
                    form.recurrence === 'annual' ? 'Anual' : ''
                  }` : '';
                  const payload = {
                    title: form.title || `OS ${Date.now()}`,
                    status: 'OPEN',
                    assetId: (selectedAssetIds.length ? selectedAssetIds[0] : (form.assetId ? Number(form.assetId) : undefined)),
                    rootAssetId: rootAssetId || undefined,
                    description: (form.description || '') + recurrenceLabel || undefined,
                    materials: form.materials || undefined,
                    scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
                    sector: form.sector || undefined,
                    maintenanceType: form.maintenanceType || undefined,
                    assetCondition: form.assetCondition || undefined,
                    personnelCount: personnel,
                    estimatedDurationMinutes: estimated,
                    tasks: tasksArray,
                    assignedUserId: form.assignedUserId ? Number(form.assignedUserId) : undefined,
                  };
                  setCreateError("");
                  try {
                    const resp = await fetch('/api/work-orders', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });
                    if (!resp.ok) {
                      const err = await resp.json().catch(() => ({ error: 'Falha ao criar OS' }));
                      setCreateError(err?.error || 'Erro ao criar OS');
                      return;
                    }
                    const created = await resp.json();
                    if (created && created.id) {
                      setData((prev) => [...prev, created]);
                    }
                    setForm({ title: "", assetId: "", description: "", materials: "", scheduledAt: "", sector: "", maintenanceType: "", assetCondition: "", personnelCount: "", estimatedDurationMinutes: "", tasks: "", assignedUserId: "", recurrence: "" });
                    setCreating(false);
                    load();
                  } catch {
                    setCreateError('Erro de rede ao criar OS');
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 px-4 py-3"
              >
                <input
                  className="border rounded px-3 py-2"
                  placeholder="Título da OS"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <div className="relative">
                  <button
                    type="button"
                    className="border rounded px-3 py-2 w-full text-left"
                    onClick={() => setAssetDropdownOpen((o) => !o)}
                  >
                    {selectedAssetIds.length
                      ? `${selectedAssetIds.length} componente(s) selecionado(s)`
                      : (assets.find((a) => String(a.id) === form.assetId)?.name || "Selecionar componentes")}
                  </button>
                  {assetDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto border rounded bg-white shadow">
                      {(() => {
                        const tree = buildTree(assets);
                        const roots = rootAssetId ? (findNode(tree, rootAssetId) ? [findNode(tree, rootAssetId)!] : tree) : tree;
                        const Row = ({ node, level }: { node: Node; level: number }) => (
                          <div className="px-2 py-1" style={{ paddingLeft: `${level * 16 + 8}px` }}>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedAssetIds.includes(node.id)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedAssetIds((prev) => {
                                    const set = new Set(prev);
                                    if (checked) {
                                      set.add(node.id);
                                    } else {
                                      set.delete(node.id);
                                      // Ao desmarcar, remover descendentes
                                      listDescendants(node).forEach((id) => set.delete(id));
                                    }
                                    const arr = Array.from(set);
                                    if (!arr.length) setForm((f) => ({ ...f, assetId: "" }));
                                    else setForm((f) => ({ ...f, assetId: String(arr[0]) }));
                                    return arr;
                                  });
                                }}
                              />
                              <span>{node.code ? `${node.code} • ${node.name}` : node.name}</span>
                            </label>
                          </div>
                        );
                        const renderTree = (node: Node, level: number) => {
                          const rows = [<Row key={node.id} node={node} level={level} />];
                          (node.children || []).forEach((c) => rows.push(...renderTree(c, level + 1)));
                          return rows;
                        };
                        return roots.flatMap((r) => renderTree(r, 0));
                      })()}
                      <div className="p-2 border-t flex justify-end gap-2">
                        <button type="button" className="px-2 py-1 text-sm border rounded" onClick={() => setAssetDropdownOpen(false)}>Fechar</button>
                      </div>
                    </div>
                  )}
                </div>
            <select
              className="border rounded px-3 py-2"
              value={form.assignedUserId}
              onChange={(e) => setForm({ ...form, assignedUserId: e.target.value })}
            >
              <option value="">Selecionar técnico executador</option>
              {technicians.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
            <select
              className="border rounded px-3 py-2"
              value={form.recurrence}
              onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
            >
              <option value="">Recorrência do serviço</option>
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="annual">Anual</option>
            </select>
            <input
              type="datetime-local"
              className="border rounded px-3 py-2"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              placeholder="Data programada"
            />
            <select
              className="border rounded px-3 py-2"
              value={form.sector}
              onChange={(e) => setForm({ ...form, sector: e.target.value })}
            >
              <option value="">Setor</option>
              <option value="Eletrica">Eletrica</option>
              <option value="Mecanica">Mecanica</option>
              <option value="Automacao">Automacao</option>
              <option value="Utilidades">Utilidades</option>
              <option value="Segurança">Segurança</option>
            </select>
            <select
              className="border rounded px-3 py-2"
              value={form.maintenanceType}
              onChange={(e) => setForm({ ...form, maintenanceType: e.target.value })}
            >
              <option value="">Tipo de manutenção</option>
              <option value="Preventiva">Preventiva</option>
              <option value="Corretiva">Corretiva</option>
              <option value="Inspeção">Inspeção</option>
              <option value="Melhoria">Melhoria</option>
              <option value="Segurança">Segurança</option>
            </select>
            <select
              className="border rounded px-3 py-2"
              value={form.assetCondition}
              onChange={(e) => setForm({ ...form, assetCondition: e.target.value })}
            >
              <option value="">Condição do ativo</option>
              <option value="PARADO">PARADO</option>
              <option value="RODANDO">RODANDO</option>
            </select>
            <input
              type="number"
              className="border rounded px-3 py-2"
              placeholder="Qtd. de pessoas"
              value={form.personnelCount}
              onChange={(e) => setForm({ ...form, personnelCount: e.target.value })}
              min={0}
            />
            <input
              type="number"
              className="border rounded px-3 py-2"
              placeholder="Duração estimada (min)"
              value={form.estimatedDurationMinutes}
              onChange={(e) => setForm({ ...form, estimatedDurationMinutes: e.target.value })}
              min={0}
            />
            <textarea
              className="border rounded px-3 py-2 md:col-span-2"
              placeholder="Descrição do serviço"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <textarea
              className="border rounded px-3 py-2 md:col-span-2"
              placeholder="Tarefas (uma por linha)"
              rows={3}
              value={form.tasks}
              onChange={(e) => setForm({ ...form, tasks: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2 md:col-span-2"
              placeholder="Materiais a utilizar (ex: óleo, filtros)"
              value={form.materials}
              onChange={(e) => setForm({ ...form, materials: e.target.value })}
            />
                {createError && (
                  <div className="md:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {createError}
                  </div>
                )}
                <div className="md:col-span-2 flex items-center justify-end gap-2 px-4 py-3 border-t">
                  <button
                    type="button"
                    className="px-4 py-2 rounded border"
                    onClick={() => {
                      setForm({ title: "", assetId: "", description: "", materials: "", scheduledAt: "", sector: "", maintenanceType: "", assetCondition: "", personnelCount: "", estimatedDurationMinutes: "", tasks: "", assignedUserId: "", recurrence: "" });
                      setCreating(false);
                    }}
                  >Cancelar</button>
                  <button className="px-4 py-2 bg-gray-800 text-white rounded">Salvar OS</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {view === 'list' && (
      <div className="bg-white shadow rounded p-4">
        <div className="font-semibold mb-2">Lista de OS</div>
        <div className="flex flex-wrap items-end gap-2 mb-3 text-sm">
          <div className="flex flex-col">
            <label className="text-gray-600">Setor</label>
            <select
              className="border rounded px-2 py-1"
              value={filters.sector}
              onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="Eletrica">Eletrica</option>
              <option value="Mecanica">Mecanica</option>
              <option value="Automacao">Automacao</option>
              <option value="Utilidades">Utilidades</option>
              <option value="Segurança">Segurança</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-gray-600">Tipo</label>
            <select
              className="border rounded px-2 py-1"
              value={filters.maintenanceType}
              onChange={(e) => setFilters((f) => ({ ...f, maintenanceType: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="Preventiva">Preventiva</option>
              <option value="Corretiva">Corretiva</option>
              <option value="Inspeção">Inspeção</option>
              <option value="Melhoria">Melhoria</option>
              <option value="Segurança">Segurança</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-gray-600">Status</label>
            <select
              className="border rounded px-2 py-1"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Todos</option>
              <option value="OPEN">Abertas</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="COMPLETED">Concluídas</option>
              <option value="CLOSED">Encerradas</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-gray-600">De</label>
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-gray-600">Até</label>
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
          <button
            className="ml-auto px-3 py-1 border rounded"
            onClick={() => setFilters({ sector: "", maintenanceType: "", from: "", to: "", status: "" })}
          >Limpar</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2 border-b">ID</th>
                <th className="p-2 border-b">Título</th>
                <th className="p-2 border-b">Setor</th>
                <th className="p-2 border-b">Tipo</th>
                <th className="p-2 border-b">Programada</th>
                <th className="p-2 border-b">Status</th>
                <th className="p-2 border-b">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((w) => (
                <tr key={w.id} className="border-b">
                  <td className="p-2">{w.id}</td>
                  <td className="p-2">{w.title}</td>
                  <td className="p-2">
                    {editingId === w.id ? (
                      <select className="border rounded px-2 py-1" value={edit.sector} onChange={(e) => setEdit((ed) => ({ ...ed, sector: e.target.value }))}>
                        <option value="">-</option>
                        {sectorOptions.map((o) => (<option key={o} value={o}>{o}</option>))}
                      </select>
                    ) : (w.sector || '-')}
                  </td>
                  <td className="p-2">
                    {editingId === w.id ? (
                      <select className="border rounded px-2 py-1" value={edit.maintenanceType} onChange={(e) => setEdit((ed) => ({ ...ed, maintenanceType: e.target.value }))}>
                        <option value="">-</option>
                        {typeOptions.map((o) => (<option key={o} value={o}>{o}</option>))}
                      </select>
                    ) : (
                      w.maintenanceType ? <span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-800 border border-indigo-300">{w.maintenanceType}</span> : '-'
                    )}
                  </td>
                  <td className="p-2">
                    {editingId === w.id ? (
                      <input type="datetime-local" className="border rounded px-2 py-1" value={edit.scheduledAt} onChange={(e) => setEdit((ed) => ({ ...ed, scheduledAt: e.target.value }))} />
                    ) : (
                      (() => { const s = w.scheduledAt || w.scheduled_at; if (!s) return '-'; try { return new Date(s).toLocaleString('pt-BR'); } catch { return String(s); } })()
                    )}
                  </td>
                  <td className="p-2">
                    <select
                      className="border rounded px-2 py-1 text-xs"
                      value={w.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        const updated = await fetch(`/api/work-orders/${w.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }).then((r) => r.json());
                        setData((prev) => prev.map((i) => i.id === w.id ? { ...i, ...updated } : i));
                      }}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </td>
                  <td className="p-2 flex items-center gap-2">
                    {editingId === w.id ? (
                      <>
                        <button
                          className="px-2 py-1 text-xs rounded bg-green-600 text-white"
                          onClick={async () => {
                            // validação simples
                            if (edit.scheduledAt) {
                              const d = new Date(edit.scheduledAt);
                              if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) { alert('Data programada não pode ser no passado'); return; }
                            }
                            const payload: any = { sector: edit.sector || null, maintenanceType: edit.maintenanceType || null };
                            if (edit.scheduledAt) payload.scheduledAt = new Date(edit.scheduledAt).toISOString(); else payload.scheduledAt = null;
                            const updated = await fetch(`/api/work-orders/${w.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((r) => r.json());
                            setData((prev) => prev.map((i) => i.id === w.id ? { ...i, ...updated } : i));
                            setEditingId(null);
                          }}
                        >Salvar</button>
                        <button className="px-2 py-1 text-xs rounded border" onClick={() => setEditingId(null)}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <Link href={`/work-orders/${w.id}`} className="text-blue-600 hover:underline">Detalhes</Link>
                        <button
                          className="px-2 py-1 text-xs rounded border"
                          onClick={() => {
                            const s = w.scheduledAt || w.scheduled_at || '';
                            const toLocal = (val: string) => {
                              try {
                                const d = new Date(val);
                                const pad = (n: number) => String(n).padStart(2, '0');
                                return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                              } catch { return ''; }
                            };
                            setEdit({ sector: w.sector || '', maintenanceType: w.maintenanceType || '', scheduledAt: s ? toLocal(s) : '' });
                            setEditingId(w.id);
                          }}
                        >Editar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={7} className="p-2 text-gray-500">Carregando...</td>
                </tr>
              )}
              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-2 text-gray-500">Nenhuma OS encontrada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {view === 'kanban' && (
        <div>
          <KanbanBoard />
        </div>
      )}

      {view === 'calendar' && (
        <div className="space-y-4">
          {/* Filtros para o calendário */}
          <div className="bg-white shadow rounded p-3">
            <div className="font-semibold mb-2">Filtros do calendário</div>
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <div className="flex flex-col">
                <label className="text-gray-600">Setor</label>
                <select
                  className="border rounded px-2 py-1"
                  value={filters.sector}
                  onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {sectorOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-gray-600">Tipo</label>
                <select
                  className="border rounded px-2 py-1"
                  value={filters.maintenanceType}
                  onChange={(e) => setFilters((f) => ({ ...f, maintenanceType: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {typeOptions.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-gray-600">Status</label>
                <select
                  className="border rounded px-2 py-1"
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="OPEN">Abertas</option>
                  <option value="IN_PROGRESS">Em andamento</option>
                  <option value="COMPLETED">Concluídas</option>
                  <option value="CLOSED">Encerradas</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-gray-600">De</label>
                <input
                  type="date"
                  className="border rounded px-2 py-1"
                  value={filters.from}
                  onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-gray-600">Até</label>
                <input
                  type="date"
                  className="border rounded px-2 py-1"
                  value={filters.to}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                />
              </div>
              <button
                className="ml-auto px-3 py-1 border rounded"
                onClick={() => setFilters({ sector: "", maintenanceType: "", from: "", to: "", status: "" })}
              >Limpar</button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {calMode === 'month' ? (
                <>
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth()-1, 1))}
                  >Mês anterior</button>
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => setCurrentDate(new Date())}
                  >Hoje</button>
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth()+1, 1))}
                  >Próximo mês</button>
                </>
              ) : (
                <>
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()-7))}
                  >Semana anterior</button>
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => setCurrentDate(new Date())}
                  >Hoje</button>
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+7))}
                  >Próxima semana</button>
                </>
              )}
            </div>
            <div className="text-gray-700 font-medium">
              {calMode === 'month'
                ? currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                : (() => {
                    const start = new Date(currentDate);
                    const delta = (start.getDay() + 6) % 7;
                    start.setDate(start.getDate() - delta);
                    const end = new Date(start);
                    end.setDate(start.getDate() + 6);
                    return `Semana de ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}`;
                  })()
              }
            </div>
          </div>

          {calMode === 'month' && (
            <div className="bg-white shadow rounded">
              <div className="grid grid-cols-7 text-xs font-medium text-gray-600 border-b">
                {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d) => (
                  <div key={d} className="p-2 text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthMatrix.map((week, wi) => (
                  <div key={wi} className="contents">
                    {week.map((day, di) => {
                      const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                      const key = day.toISOString().slice(0,10);
                      const items = ordersByDay.get(key) || [];
                      return (
                        <div
                          key={di}
                          className={`min-h-[110px] border p-2 ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'} ${expandedDayKey === key ? 'ring-2 ring-blue-500' : ''}`}
                          onClick={() => setExpandedDayKey((cur) => (cur === key ? null : key))}
                        >
                          <div className="text-xs font-medium mb-1 flex items-center justify-between">
                            <span>{day.getDate()}</span>
                            <span className="text-[10px] text-gray-500">{items.length} OS</span>
                          </div>
                          <div className="space-y-1 overflow-y-auto max-h-24">
                            {items.map((w: any) => (
                              <Link key={w.id} href={`/work-orders/${w.id}`} className={`block text-xs border rounded px-2 py-1 ${colorBy(w)} hover:opacity-80`}>
                                <span className="font-semibold">#{w.code || w.id}</span> {w.title}{' '}
                                {w.maintenanceType && (
                                  <span className="ml-1 px-1 rounded text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-300">{w.maintenanceType}</span>
                                )}
                              </Link>
                            ))}
                            {items.length === 0 && (
                              <div className="text-[11px] text-gray-400">Sem OS</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {calMode === 'week' && (
            <div className="bg-white shadow rounded">
              <div className="grid grid-cols-7 text-xs font-medium text-gray-600 border-b">
                {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((d) => (
                  <div key={d} className="p-2 text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {weekDays.map((day, di) => {
                  const key = day.toISOString().slice(0,10);
                  const items = ordersByDay.get(key) || [];
                  return (
                    <div
                      key={di}
                      className={`min-h-[110px] border p-2 bg-white ${expandedDayKey === key ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => setExpandedDayKey((cur) => (cur === key ? null : key))}
                    >
                      <div className="text-xs font-medium mb-1 flex items-center justify-between">
                        <span>{day.getDate()}</span>
                        <span className="text-[10px] text-gray-500">{items.length} OS</span>
                      </div>
                      <div className="space-y-1 overflow-y-auto max-h-24">
                        {items.map((w: any) => (
                          <Link key={w.id} href={`/work-orders/${w.id}`} className={`block text-xs border rounded px-2 py-1 ${colorBy(w)} hover:opacity-80`}>
                            <span className="font-semibold">#{w.code || w.id}</span> {w.title}{' '}
                            {w.maintenanceType && (
                              <span className="ml-1 px-1 rounded text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-300">{w.maintenanceType}</span>
                            )}
                          </Link>
                        ))}
                        {items.length === 0 && (
                          <div className="text-[11px] text-gray-400">Sem OS</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {expandedDayKey && (
            <div className="bg-white shadow rounded p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Programação do dia {new Date(expandedDayKey).toLocaleDateString('pt-BR')}</div>
                <button className="text-sm px-2 py-1 border rounded" onClick={() => setExpandedDayKey(null)}>Fechar</button>
              </div>
              <div className="mt-2 space-y-2">
                {(ordersByDay.get(expandedDayKey) || []).map((w: any) => (
                  <Link key={w.id} href={`/work-orders/${w.id}`} className={`block text-sm border rounded px-2 py-2 ${colorBy(w)} hover:opacity-80`}>
                    <div className="font-medium">#{w.code || w.id} - {w.title}</div>
                    <div className="text-xs text-gray-700 flex items-center gap-2">
                      {w.maintenanceType && (<span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300">{w.maintenanceType}</span>)}
                      {w.sector && (<span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">{w.sector}</span>)}
                      {w.scheduledAt && (<span className="px-2 py-0.5 rounded bg-yellow-50 text-yellow-800 border border-yellow-200">{new Date(w.scheduledAt).toLocaleString('pt-BR')}</span>)}
                    </div>
                  </Link>
                ))}
                {(ordersByDay.get(expandedDayKey) || []).length === 0 && (
                  <div className="text-sm text-gray-500">Sem OS para este dia</div>
                )}
              </div>
            </div>
          )}

          {unscheduled.length > 0 && (
            <div className="bg-white shadow rounded p-3">
              <div className="font-semibold mb-2">Sem programação</div>
              <div className="grid md:grid-cols-2 gap-2">
                {unscheduled.map((w) => (
                  <Link key={w.id} href={`/work-orders/${w.id}`} className={`text-sm border rounded px-2 py-2 ${colorBy(w)} hover:opacity-80`}>
                    <span className="font-semibold">#{w.code || w.id}</span> {w.title}{' '}
                    {w.maintenanceType && (
                      <span className="ml-1 px-1 rounded text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-300">{w.maintenanceType}</span>
                    )}
                  </Link>
                ))}
              </div>
              {unscheduled.length === 0 && (
                <div className="text-sm text-gray-500">Todas as OS têm data programada.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
