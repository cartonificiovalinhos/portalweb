"use client";
import React, { useEffect, useMemo, useState } from "react";

type Family = { id: number; description: string };
type Occurrence = { id: number; description: string };

export default function StandardOccurrencePage() {
  const [occ, setOcc] = useState<Occurrence | null>(null);
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [occSug, setOccSug] = useState<Occurrence[]>([]);
  const [showOccSug, setShowOccSug] = useState(false);

  const [families, setFamilies] = useState<Family[]>([]);
  const [linked, setLinked] = useState<Family[]>([]);
  const [leftFilter, setLeftFilter] = useState("");
  const [rightFilter, setRightFilter] = useState("");
  const [leftSel, setLeftSel] = useState<number[]>([]);
  const [rightSel, setRightSel] = useState<number[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/base/commercial-families', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((arr) => setFamilies(Array.isArray(arr) ? arr : []))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // Buscar ocorrências conforme digitado na descrição
  useEffect(() => {
    const q = desc.trim();
    if (!q) { setOccSug([]); return; }
    const ctrl = new AbortController();
    fetch(`/api/sac/standard-occurrences?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((arr) => setOccSug(Array.isArray(arr) ? arr : []))
      .catch(() => {})
      .finally(() => {});
    return () => ctrl.abort();
  }, [desc]);

  function selectOcc(o: Occurrence) {
    setOcc(o);
    setDesc(o.description);
    setShowOccSug(false);
    // Carregar famílias vinculadas
    const ctrl = new AbortController();
    fetch(`/api/sac/standard-occurrences/${o.id}/families`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((arr) => setLinked(Array.isArray(arr) ? arr : []))
      .catch(() => {})
      .finally(() => {});
  }

  async function saveOccurrence() {
    setSaving(true); setError(null);
    try {
      if (occ && occ.id) {
        // Atualização simples: recriar via POST se descrição mudou para manter escopo mínimo
        if (desc.trim() && desc.trim() !== occ.description.trim()) {
          const res = await fetch('/api/sac/standard-occurrences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc.trim() }) });
          const json = await res.json();
          if (!res.ok || json.error) throw new Error(json.error || 'Falha ao salvar');
          selectOcc(json);
        }
      } else {
        const res = await fetch('/api/sac/standard-occurrences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc.trim() }) });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error || 'Falha ao salvar');
        selectOcc(json);
      }
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  const available = useMemo(() => {
    const linkedIds = new Set(linked.map((f) => f.id));
    const base = families.filter((f) => !linkedIds.has(f.id));
    const lf = leftFilter.trim().toLowerCase();
    return lf ? base.filter((f) => f.description.toLowerCase().includes(lf)) : base;
  }, [families, linked, leftFilter]);

  const linkedFiltered = useMemo(() => {
    const rf = rightFilter.trim().toLowerCase();
    return rf ? linked.filter((f) => f.description.toLowerCase().includes(rf)) : linked;
  }, [linked, rightFilter]);

  function moveRight() {
    const add = families.filter((f) => leftSel.includes(f.id));
    const merged = [...linked, ...add.filter((a) => !linked.some((l) => l.id === a.id))];
    setLinked(merged);
    setLeftSel([]);
  }
  function moveLeft() {
    const remaining = linked.filter((f) => !rightSel.includes(f.id));
    setLinked(remaining);
    setRightSel([]);
  }

  async function saveLinks() {
    if (!occ) return;
    setSaving(true); setError(null);
    try {
      const ids = linked.map((f) => f.id);
      const res = await fetch(`/api/sac/standard-occurrences/${occ.id}/families`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ familyIds: ids })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Falha ao salvar vínculos');
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  function newOccurrence() {
    setOcc(null);
    setDesc('');
    setLinked([]);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">SAC • Ocorrência Padrão</h1>

      <div className="grid grid-cols-12 gap-2 border p-2 bg-gray-50">
        <div className="col-span-2">
          <label className="text-xs">ID</label>
          <input className="w-full border px-2 py-1" value={occ?.id ?? ''} readOnly />
        </div>
        <div className="col-span-6">
          <label className="text-xs">Descrição</label>
          <div className="relative">
            <input
              className="w-full border px-2 py-1"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onFocus={() => occSug.length && setShowOccSug(true)}
              onBlur={() => setTimeout(() => setShowOccSug(false), 150)}
              placeholder="Buscar/editar descrição"
            />
            {showOccSug && occSug.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto border rounded bg-white shadow">
                {occSug.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectOcc(o)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  >
                    <div className="text-sm">{o.description}</div>
                    <div className="text-xs text-gray-600">ID: {o.id}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="col-span-4 flex items-end gap-2">
          <button onClick={saveOccurrence} className="px-3 py-2 bg-blue-600 text-white rounded">{occ ? 'Salvar alterações' : 'Criar'}</button>
          <button onClick={newOccurrence} className="px-3 py-2 bg-gray-600 text-white rounded">Novo</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 border p-3">
        <div className="col-span-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Famílias comerciais</span>
            <input value={leftFilter} onChange={(e) => setLeftFilter(e.target.value)} placeholder="Filtrar disponíveis (descrição)" className="border px-2 py-1 w-64" />
          </div>
          <div className="space-y-2 max-h-64 overflow-auto border rounded p-2 bg-white">
            {available.map((f) => (
              <label key={f.id} className="flex items-center gap-2">
                <input type="checkbox" checked={leftSel.includes(f.id)} onChange={(e) => {
                  const checked = e.target.checked;
                  setLeftSel((prev) => checked ? [...prev, f.id] : prev.filter((id) => id !== f.id));
                }} />
                <span>{f.description}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="col-span-2 flex flex-col items-center justify-center gap-2">
          <button onClick={moveRight} className="px-3 py-2 bg-indigo-500 text-white rounded">→</button>
          <button onClick={moveLeft} className="px-3 py-2 bg-gray-500 text-white rounded">←</button>
        </div>
        <div className="col-span-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Famílias vinculadas</span>
            <input value={rightFilter} onChange={(e) => setRightFilter(e.target.value)} placeholder="Filtrar vinculadas (descrição)" className="border px-2 py-1 w-64" />
          </div>
          <div className="space-y-2 max-h-64 overflow-auto border rounded p-2 bg-white">
            {linkedFiltered.length === 0 && (
              <div className="text-sm text-gray-600">Nenhuma família vinculada</div>
            )}
            {linkedFiltered.map((f) => (
              <label key={f.id} className="flex items-center gap-2">
                <input type="checkbox" checked={rightSel.includes(f.id)} onChange={(e) => {
                  const checked = e.target.checked;
                  setRightSel((prev) => checked ? [...prev, f.id] : prev.filter((id) => id !== f.id));
                }} />
                <span>{f.description}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={saveLinks} disabled={!occ} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50">Salvar vínculos</button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
        {saving && <span className="text-gray-600 text-sm">Salvando...</span>}
      </div>
    </div>
  );
}
