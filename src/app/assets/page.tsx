"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { safeParseJson } from "../../lib/safeJson";
import Link from "next/link";
import Image from "next/image";

export default function AssetsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null);
  const [rootPhotos, setRootPhotos] = useState<Record<number, string>>({});
  const [showNewRoot, setShowNewRoot] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/assets")
      .then((r) => safeParseJson(r, []))
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Navegação: lista de máquinas-mãe -> detalhe com árvore

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ativos</h1>
        <p className="text-gray-600">Cadastre e gerencie máquinas e ativos.</p>
      </div>

      <div className="bg-white shadow rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-700">Máquinas-mãe</div>
          <button onClick={() => setShowNewRoot((s) => !s)} className="px-3 py-1 text-sm bg-gray-800 text-white rounded">
            {showNewRoot ? 'Fechar' : 'Adicionar máquina-mãe'}
          </button>
        </div>
        {showNewRoot && (
          <NewRootMachinePanel
            onCreated={(id?: number) => {
              if (id) setSelectedRootId(id);
              setShowNewRoot(false);
            }}
            onRefresh={load}
          />
        )}
        {!selectedRootId && (
          <RootMachinesGrid
            items={items}
            loading={loading}
            onSelect={(id) => setSelectedRootId(id)}
            rootPhotos={rootPhotos}
            setRootPhotos={setRootPhotos}
          />
        )}
        {selectedRootId && (
          <MachineDetail
            rootId={selectedRootId}
            items={items}
            loading={loading}
            onBack={() => setSelectedRootId(null)}
            onRefresh={load}
          />
        )}
      </div>
    </div>
  );
}

type TreeNode = any & { children?: TreeNode[] };

function buildTree(items: any[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  items.forEach((i: any) => map.set(i.id, { ...i, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parentId) {
      const parent = map.get(node.parentId);
      if (parent) parent.children!.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function HierarchyView({ items, loading, onRefresh, query, rootId, onSelect, selectedId, checkedIds, onToggleCheck, expandSignal, collapseSignal }: { items: any[]; loading: boolean; onRefresh: () => void; query: string; rootId?: number; onSelect: (id: number) => void; selectedId?: number; checkedIds: number[]; onToggleCheck: (id: number, checked: boolean) => void; expandSignal: number; collapseSignal: number }) {
  if (loading) return <div className="text-gray-500">Carregando...</div>;
  let roots = buildTree(items);
  if (rootId) {
    const found = findNode(roots, rootId);
    roots = found ? [found] : [];
  }
  const q = (query || "").trim().toLowerCase();
  if (q) {
    const match = (n: any) =>
      (n.name || "").toLowerCase().includes(q) ||
      (n.code || "").toLowerCase().includes(q) ||
      (n.location || "").toLowerCase().includes(q);
    const prune = (node: any): any | null => {
      const prunedChildren = (node.children || []).map(prune).filter(Boolean);
      const isMatch = match(node);
      if (isMatch || prunedChildren.length) {
        return { ...node, children: prunedChildren };
      }
      return null;
    };
    roots = roots.map(prune).filter(Boolean) as any[];
  }
  if (!roots.length) return <div className="text-gray-500">Nenhum ativo cadastrado</div>;
  return (
    <div className="space-y-2">
      {roots.map((node) => (
        <HierarchyNode key={node.id} node={node} level={0} onRefresh={onRefresh} onSelect={onSelect} selectedId={selectedId} checkedIds={checkedIds} onToggleCheck={onToggleCheck} expandSignal={expandSignal} collapseSignal={collapseSignal} />
      ))}
    </div>
  );
}

function findNode(roots: TreeNode[], id: number): TreeNode | null {
  for (const r of roots) {
    if (r.id === id) return r;
    const found = r.children ? findNode(r.children, id) : null;
    if (found) return found;
  }
  return null;
}

function HierarchyNode({ node, level, onRefresh, onSelect, selectedId, checkedIds, onToggleCheck, expandSignal, collapseSignal }: { node: TreeNode; level: number; onRefresh: () => void; onSelect: (id: number) => void; selectedId?: number; checkedIds: number[]; onToggleCheck: (id: number, checked: boolean) => void; expandSignal: number; collapseSignal: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const [showChildForm, setShowChildForm] = useState(false);
  const [child, setChild] = useState({ name: "", code: "", location: "" });
  const [showPhotos, setShowPhotos] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edata, setEdata] = useState({
    name: node.name || "",
    code: node.code || "",
    location: node.location || "",
    manufacturer: node.manufacturer || "",
    model: node.model || "",
    year: node.year ? String(node.year) : "",
    criticality: node.criticality || "",
  });

  // Responder aos sinais globais de expandir/recolher
  useEffect(() => { setExpanded(true); }, [expandSignal]);
  useEffect(() => { setExpanded(false); }, [collapseSignal]);

  const saveEdit = async () => {
    try {
      const res = await fetch(`/api/assets/${node.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...edata,
          year: edata.year ? Number(edata.year) : null,
        })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        alert(`Falha ao salvar ativo #${node.id}. ${txt || ''}`);
        return;
      }
      setEditing(false);
      onRefresh();
      alert('Ativo salvo com sucesso.');
    } catch {
      alert(`Erro ao salvar ativo #${node.id}.`);
    }
  };

  const removeNode = async () => {
    if (!confirm('Deseja excluir este ativo?')) return;
    await fetch(`/api/assets/${node.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const createChild = async () => {
    if (!child.name.trim()) return;
    await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: child.name,
        code: child.code || null,
        location: child.location || null,
        parentId: node.id,
      })
    });
    setChild({ name: "", code: "", location: "" });
    setShowChildForm(false);
    onRefresh();
  };
  return (
    <div className={`border rounded p-2 mb-2 ${selectedId === node.id ? 'border-blue-600 bg-blue-50' : ''}`}>
      <div className="flex items-center gap-2">
        {hasChildren && (
          <button onClick={() => setExpanded((e) => !e)} className="w-6 h-6 flex items-center justify-center rounded bg-gray-100">
            {expanded ? '-' : '+'}
          </button>
        )}
        {!hasChildren && <span className="w-6" />}
        <input
          type="checkbox"
          className="mr-2"
          checked={checkedIds.includes(node.id)}
          onChange={(e) => onToggleCheck(node.id, e.target.checked)}
        />
        <div className="font-medium cursor-pointer" onClick={() => onSelect(node.id)}>{node.code ? `${node.code} • ${node.name}` : node.name}</div>
        {node.location && <div className="ml-auto text-xs text-gray-600">{node.location}</div>}
      </div>
      <div className="mt-2 text-xs text-gray-700 flex flex-wrap gap-3">
        {node.manufacturer && <span><span className="text-gray-500">Fabricante:</span> {node.manufacturer}</span>}
        {node.model && <span><span className="text-gray-500">Modelo:</span> {node.model}</span>}
        {node.year && <span><span className="text-gray-500">Ano:</span> {node.year}</span>}
        {node.criticality && (
          <span className={`px-2 py-0.5 rounded border ${node.criticality === 'HIGH' ? 'border-red-600 text-red-700' : node.criticality === 'MEDIUM' ? 'border-yellow-600 text-yellow-700' : 'border-green-600 text-green-700'}`}>
            {node.criticality === 'HIGH' ? 'Alta' : node.criticality === 'MEDIUM' ? 'Média' : 'Baixa'}
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={() => setShowChildForm((s) => !s)} className="px-2 py-1 text-xs bg-gray-200 rounded">Adicionar componente</button>
        <button onClick={() => setShowPhotos((s) => !s)} className="px-2 py-1 text-xs bg-gray-200 rounded">Fotos</button>
        <button onClick={() => setEditing((e) => !e)} className="px-2 py-1 text-xs bg-yellow-500 text-white rounded">{editing ? 'Cancelar edição' : 'Editar'}</button>
        <button onClick={removeNode} className="px-2 py-1 text-xs bg-red-600 text-white rounded">Excluir</button>
      </div>
      {expanded && hasChildren && (
      <div className="mt-2 pl-8 space-y-2">
          {node.children!.map((child) => (
            <HierarchyNode key={child.id} node={child} level={level + 1} onRefresh={onRefresh} onSelect={onSelect} selectedId={selectedId} checkedIds={checkedIds} onToggleCheck={onToggleCheck} expandSignal={expandSignal} collapseSignal={collapseSignal} />
          ))}
      </div>
      )}
      {showChildForm && (
        <div className="mt-3 pl-8">
          <div className="text-sm font-medium mb-2">Novo componente de {node.name}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="border rounded px-2 py-1" placeholder="Nome" value={child.name} onChange={(e) => setChild({ ...child, name: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Código" value={child.code} onChange={(e) => setChild({ ...child, code: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Localização" value={child.location} onChange={(e) => setChild({ ...child, location: e.target.value })} />
            <div>
              <button onClick={createChild} className="px-3 py-1 bg-gray-800 text-white rounded text-sm mr-2">Salvar</button>
              <button onClick={() => setShowChildForm(false)} className="px-3 py-1 bg-gray-200 rounded text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <div className="mt-3 pl-8">
          <div className="text-sm font-medium mb-2">Editar {node.name}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="border rounded px-2 py-1" placeholder="Nome" value={edata.name} onChange={(e) => setEdata({ ...edata, name: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Código" value={edata.code} onChange={(e) => setEdata({ ...edata, code: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Localização" value={edata.location} onChange={(e) => setEdata({ ...edata, location: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Fabricante" value={edata.manufacturer} onChange={(e) => setEdata({ ...edata, manufacturer: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Modelo" value={edata.model} onChange={(e) => setEdata({ ...edata, model: e.target.value })} />
            <input className="border rounded px-2 py-1" type="number" placeholder="Ano" value={edata.year} onChange={(e) => setEdata({ ...edata, year: e.target.value })} />
            <select className="border rounded px-2 py-1" value={edata.criticality} onChange={(e) => setEdata({ ...edata, criticality: e.target.value })}>
              <option value="">Criticidade</option>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
            </select>
            <div>
              <button onClick={saveEdit} className="px-3 py-1 bg-green-600 text-white rounded text-sm mr-2">Salvar</button>
              <button onClick={() => setEditing(false)} className="px-3 py-1 bg-gray-200 rounded text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {showPhotos && (
        <div className="mt-3 pl-8">
          <PhotosPanel assetId={node.id} />
        </div>
      )}
    </div>
  );
}

function PhotosPanel({ assetId }: { assetId: number }) {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadPhotos = useCallback(() => {
    setLoading(true);
    fetch(`/api/assets/${assetId}/photos`)
      .then((r) => safeParseJson(r, []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        // Mostrar somente anexos de imagem
        const onlyImages = list.filter((p: any) => {
          const mt = (p?.mimeType || '').toLowerCase();
          const url = String(p?.url || '');
          return (mt && mt.startsWith('image')) || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url);
        });
        setPhotos(onlyImages);
      })
      .finally(() => setLoading(false));
  }, [assetId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    await fetch(`/api/assets/${assetId}/photos`, { method: 'POST', body: fd });
    setUploading(false);
    loadPhotos();
  };

  const onRemove = async (id: number) => {
    if (!confirm('Deseja remover esta foto?')) return;
    setRemovingId(id);
    await fetch(`/api/assets/${assetId}/photos?id=${id}`, { method: 'DELETE' });
    setRemovingId(null);
    loadPhotos();
  };

  return (
    <div className="border rounded p-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Fotos do ativo #{assetId}</div>
        <label className="px-2 py-1 text-xs bg-gray-800 text-white rounded cursor-pointer">
          {uploading ? 'Enviando...' : 'Enviar foto'}
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
        </label>
      </div>
      {loading && <div className="text-xs text-gray-500">Carregando fotos...</div>}
      {!loading && photos.length === 0 && <div className="text-xs text-gray-500">Nenhuma foto enviada</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="border rounded overflow-hidden relative group">
            <div className="relative w-full h-24">
              <Image src={p.url} alt={`Foto ${p.id}`} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" unoptimized loader={({ src }) => src} />
            </div>
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={() => onRemove(p.id)}
                className="px-2 py-0.5 text-[11px] bg-red-600 text-white rounded"
                disabled={removingId === p.id}
                title="Remover foto"
              >
                {removingId === p.id ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetDetailsPanel({ asset }: { asset?: any }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  useEffect(() => {
    // Se o ativo ainda não existe (ex.: acabou de ser criado e a lista não foi recarregada),
    // evita acessar propriedades indefinidas e usa um fallback de miniatura.
    if (!asset?.id) {
      setThumb('/icons/logo cartonificio.png');
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const list = await fetch(`/api/assets/${asset.id}/photos`).then((r) => r.json());
        // Seleciona a primeira imagem válida
        const img = (Array.isArray(list) ? (list as any[]) : []).find((p: any) => {
          const mt = (p?.mimeType || '').toLowerCase();
          const url = String(p?.url || '');
          return (mt && mt.startsWith('image')) || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url);
        });
        if (!active) return;
        setThumb(img?.url || '/icons/logo cartonificio.png');
      } catch {
        if (!active) return;
        setThumb('/icons/logo cartonificio.png');
      }
    };
    load();
    return () => { active = false; };
  }, [asset?.id]);

  if (!asset) {
    return (
      <div className="border rounded p-3 text-xs text-gray-600">
        Selecione um ativo na árvore para ver detalhes.
      </div>
    );
  }

  return (
    <div className="border rounded p-3">
      <div className="flex items-start gap-3">
        <Image src={thumb || '/icons/logo cartonificio.png'} alt={asset.name} width={80} height={80} className="w-20 h-20 object-cover rounded border" unoptimized loader={({ src }) => src} />
        <div className="flex-1">
          <div className="text-lg font-semibold">{asset.name}</div>
          <div className="text-xs text-gray-600">{asset.code || '-'} • {asset.location || '-'}</div>
          <div className="mt-2 flex gap-2">
            <Link href={`/assets?assetId=${asset.id}`} className="px-2 py-1 text-xs rounded bg-gray-200" title="Configurações">⚙️ Configurações</Link>
            <Link href={`/work-orders?assetId=${asset.id}&create=1`} className="px-2 py-1 text-xs rounded bg-blue-600 text-white" title="Manutenção">🔧 Criar OS</Link>
            <Link href={`/work-orders?assetId=${asset.id}`} className="px-2 py-1 text-xs rounded bg-gray-200" title="Indicadores">📈 Indicadores</Link>
          </div>
        </div>
        {/* QR Code pequeno ao lado das informações */}
        <button
          className="ml-auto border rounded p-2 hover:bg-gray-50"
          title="Ver QR Code"
          onClick={() => setShowQR(true)}
        >
          <Image
            src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/assets/view/${asset.id}`)}`}
            alt="QR Code"
            width={64}
            height={64}
            className="w-16 h-16"
            unoptimized
            loader={({ src }) => src}
          />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700">
        {asset.manufacturer && <div><span className="text-gray-500">Fabricante:</span> {asset.manufacturer}</div>}
        {asset.model && <div><span className="text-gray-500">Modelo:</span> {asset.model}</div>}
        {asset.year && <div><span className="text-gray-500">Ano:</span> {asset.year}</div>}
        {asset.criticality && (
          <div>
            <span className="text-gray-500">Criticidade:</span> {asset.criticality === 'HIGH' ? 'Alta' : asset.criticality === 'MEDIUM' ? 'Média' : 'Baixa'}
          </div>
        )}
        {asset.status && <div><span className="text-gray-500">Status:</span> {asset.status}</div>}
      </div>

      {showQR && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-4 w-full max-w-md">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium">QR Code do componente</div>
              <button className="text-gray-600 hover:text-gray-800" onClick={() => setShowQR(false)}>✕</button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/assets/view/${asset.id}`)}`}
                alt="QR Code"
                width={256}
                height={256}
                className="w-64 h-64"
                unoptimized
                loader={({ src }) => src}
              />
              <div className="text-xs text-gray-600 break-all text-center">{typeof window !== 'undefined' ? `${window.location.origin}/assets/view/${asset.id}` : `/assets/view/${asset.id}`}</div>
              <div className="flex gap-2">
                <button className="px-3 py-2 border rounded" onClick={() => setShowQR(false)}>Fechar</button>
                <button className="px-3 py-2 bg-gray-800 text-white rounded" onClick={() => window.print()}>Imprimir QR Code</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RootMachinesGrid({ items, loading, onSelect, rootPhotos, setRootPhotos }: { items: any[]; loading: boolean; onSelect: (id: number) => void; rootPhotos: Record<number, string>; setRootPhotos: (updater: any) => void }) {
  if (loading) return <div className="text-gray-500">Carregando...</div>;
  const roots = items.filter((i) => !i.parentId);
  if (!roots.length) return <div className="text-gray-500">Nenhuma máquina-mãe cadastrada</div>;
  const ensurePhoto = async (assetId: number) => {
    if (rootPhotos[assetId]) return;
    const list = await fetch(`/api/assets/${assetId}/photos`).then((r) => safeParseJson(r, []));
    const img = (Array.isArray(list) ? (list as any[]) : []).find((p: any) => {
      const mt = (p?.mimeType || '').toLowerCase();
      const url = String(p?.url || '');
      return (mt && mt.startsWith('image')) || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url);
    });
    const first = img?.url as string | undefined;
    setRootPhotos((prev: Record<number, string>) => ({ ...prev, [assetId]: first || '/icons/logo cartonificio.png' }));
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {roots.map((r) => (
        <div key={r.id} className="border rounded overflow-hidden cursor-pointer hover:shadow relative" onMouseEnter={() => ensurePhoto(r.id)} onClick={() => onSelect(r.id)}>
          <div className="h-36 bg-gray-100">
            <div className="relative w-full h-36">
              <Image src={rootPhotos[r.id] || '/icons/logo cartonificio.png'} alt={r.name} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" unoptimized loader={({ src }) => src} />
            </div>
            {r.criticality && (
              <span className={`absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded bg-white/80 border ${r.criticality === 'HIGH' ? 'border-red-600 text-red-700' : r.criticality === 'MEDIUM' ? 'border-yellow-600 text-yellow-700' : 'border-green-600 text-green-700'}`}>
                {r.criticality === 'HIGH' ? 'Criticidade: Alta' : r.criticality === 'MEDIUM' ? 'Criticidade: Média' : 'Criticidade: Baixa'}
              </span>
            )}
          </div>
          <div className="p-3">
            <div className="font-medium">{r.name}</div>
            <div className="text-xs text-gray-600">{r.code || '-'}</div>
            <div className="text-xs text-gray-600">{r.location || '-'}</div>
            <div className="mt-2 text-xs text-gray-700 flex flex-wrap gap-2">
              {r.manufacturer && <span>Fab.: {r.manufacturer}</span>}
              {r.model && <span>Mod.: {r.model}</span>}
              {r.year && <span>Ano: {r.year}</span>}
              {r.criticality && (
                <span className={`px-2 py-0.5 rounded border ${r.criticality === 'HIGH' ? 'border-red-600 text-red-700' : r.criticality === 'MEDIUM' ? 'border-yellow-600 text-yellow-700' : 'border-green-600 text-green-700'}`}>
                  {r.criticality === 'HIGH' ? 'Alta' : r.criticality === 'MEDIUM' ? 'Média' : 'Baixa'}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MachineDetail({ rootId, items, loading, onBack, onRefresh }: { rootId: number; items: any[]; loading: boolean; onBack: () => void; onRefresh: () => void }) {
  const root = items.find((i) => i.id === rootId);
  const [query, setQuery] = useState("");
  const [expandSignal, setExpandSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);
  const [showPhotos, setShowPhotos] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingRoot, setEditingRoot] = useState(false);
  const [selectedId, setSelectedId] = useState<number>(rootId);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [rdata, setRdata] = useState({
    name: root?.name || "",
    code: root?.code || "",
    location: root?.location || "",
    manufacturer: root?.manufacturer || "",
    model: root?.model || "",
    year: root?.year ? String(root?.year) : "",
    criticality: root?.criticality || "",
  });
  const [rerrors, setRerrors] = useState<{ name?: string; year?: string }>({});

  const rootSnapshot = useMemo(() => {
    return {
      name: root?.name || "",
      code: root?.code || "",
      location: root?.location || "",
      manufacturer: root?.manufacturer || "",
      model: root?.model || "",
      year: root?.year ? String(root?.year) : "",
      criticality: root?.criticality || "",
    };
  }, [root?.code, root?.criticality, root?.location, root?.manufacturer, root?.model, root?.name, root?.year]);

  useEffect(() => {
    setRdata(rootSnapshot);
    setSelectedId(rootId);
    setCheckedIds([]);
  }, [rootId, rootSnapshot]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const assetForHistory = selectedId || rootId;
    const list = await fetch(`/api/work-orders?assetId=${assetForHistory}`).then((r) => safeParseJson(r, []));
    setHistory(Array.isArray(list) ? list : []);
    setLoadingHistory(false);
  }, [rootId, selectedId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const exportCsv = () => {
    const cols = ['id','title','status','startedAt','completedAt','closedAt','mttr'];
    const rows = history.map((h) => [h.id, h.title, h.status, h.startedAt || '', h.completedAt || '', h.closedAt || '', h.mttr ?? '']);
    const csv = [cols.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-ativo-${rootId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveRoot = async () => {
    const e: { name?: string; year?: string } = {};
    if (!rdata.name.trim()) e.name = 'Nome é obrigatório';
    if (rdata.year) {
      const y = Number(rdata.year);
      if (isNaN(y) || y < 1900 || y > 2100) e.year = 'Ano deve estar entre 1900 e 2100';
    }
    setRerrors(e);
    if (Object.keys(e).length > 0) return;
    try {
      const res = await fetch(`/api/assets/${rootId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rdata,
          year: rdata.year ? Number(rdata.year) : null,
        })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        alert(`Falha ao salvar ativo raiz #${rootId}. ${txt || ''}`);
        return;
      }
      setEditingRoot(false);
      onRefresh();
      alert('Ativo raiz salvo com sucesso.');
    } catch {
      alert(`Erro ao salvar ativo raiz #${rootId}.`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{root?.name}</div>
          <div className="text-xs text-gray-600">{root?.code} • {root?.location}</div>
          {!editingRoot && (
            <div className="mt-1 text-xs text-gray-700 flex flex-wrap gap-2">
              {root?.manufacturer && <span>Fabricante: {root?.manufacturer}</span>}
              {root?.model && <span>Modelo: {root?.model}</span>}
              {root?.year && <span>Ano: {root?.year}</span>}
              {root?.criticality && (
                <span className={`px-2 py-0.5 rounded border ${root?.criticality === 'HIGH' ? 'border-red-600 text-red-700' : root?.criticality === 'MEDIUM' ? 'border-yellow-600 text-yellow-700' : 'border-green-600 text-green-700'}`}>
                  {root?.criticality === 'HIGH' ? 'Alta' : root?.criticality === 'MEDIUM' ? 'Média' : 'Baixa'}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-3 py-1 text-sm bg-gray-200 rounded">Voltar</button>
          <Link href={checkedIds.length ? `/work-orders?assetIds=${encodeURIComponent(checkedIds.join(','))}&rootAssetId=${rootId}&create=1` : `/work-orders?assetId=${rootId}&create=1`} className="px-3 py-1 text-sm bg-blue-600 text-white rounded">Criar OS</Link>
          <button onClick={() => setShowPhotos((s) => !s)} className="px-3 py-1 text-sm bg-gray-200 rounded">Anexar fotos</button>
          <button onClick={exportCsv} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Exportar relatório</button>
          {!editingRoot && (
            <button onClick={() => setEditingRoot(true)} className="px-3 py-1 text-sm bg-yellow-500 text-white rounded">Editar</button>
          )}
          {editingRoot && (
            <>
              <button onClick={saveRoot} className="px-3 py-1 text-sm bg-green-600 text-white rounded">Salvar</button>
              <button onClick={() => setEditingRoot(false)} className="px-3 py-1 text-sm bg-gray-300 rounded">Cancelar</button>
            </>
          )}
        </div>
      </div>
      {editingRoot && (
        <div className="border rounded p-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <input className="border rounded px-2 py-1 w-full" placeholder="Nome *" value={rdata.name} onChange={(e) => setRdata({ ...rdata, name: e.target.value })} />
              {rerrors.name && <div className="text-[11px] text-red-600 mt-1">{rerrors.name}</div>}
            </div>
            <input className="border rounded px-2 py-1" placeholder="Código" value={rdata.code} onChange={(e) => setRdata({ ...rdata, code: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Localização" value={rdata.location} onChange={(e) => setRdata({ ...rdata, location: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Fabricante" value={rdata.manufacturer} onChange={(e) => setRdata({ ...rdata, manufacturer: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Modelo" value={rdata.model} onChange={(e) => setRdata({ ...rdata, model: e.target.value })} />
            <div>
              <input className="border rounded px-2 py-1 w-full" type="number" placeholder="Ano (1900–2100)" min={1900} max={2100} value={rdata.year} onChange={(e) => setRdata({ ...rdata, year: e.target.value })} />
              {rerrors.year && <div className="text-[11px] text-red-600 mt-1">{rerrors.year}</div>}
            </div>
            <select className="border rounded px-2 py-1" value={rdata.criticality} onChange={(e) => setRdata({ ...rdata, criticality: e.target.value })}>
              <option value="">Criticidade</option>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
            </select>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <input className="border rounded px-3 py-2 w-full" placeholder="Buscar na árvore" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" className="border rounded p-2 hover:bg-gray-50" title="Expandir todos" onClick={() => setExpandSignal((n) => n + 1)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 15.5l-5-5 1.4-1.4L12 12.7l3.6-3.6 1.4 1.4-5 5z"/>
                <path d="M12 20.5l-5-5 1.4-1.4L12 17.7l3.6-3.6 1.4 1.4-5 5z"/>
              </svg>
            </button>
            <button type="button" className="border rounded p-2 hover:bg-gray-50" title="Recolher todos" onClick={() => setCollapseSignal((n) => n + 1)}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 8.5l5 5-1.4 1.4L12 11.3l-3.6 3.6-1.4-1.4 5-5z"/>
                <path d="M12 3.5l5 5-1.4 1.4L12 6.3l-3.6 3.6-1.4-1.4 5-5z"/>
              </svg>
            </button>
          </div>
          <HierarchyView
            items={items}
            loading={loading}
            onRefresh={onRefresh}
            query={query}
            rootId={rootId}
            onSelect={(id) => setSelectedId(id)}
            selectedId={selectedId}
            checkedIds={checkedIds}
            onToggleCheck={(id, checked) => {
              // Seleção em cascata: marca/desmarca todos os descendentes
              const roots = buildTree(items);
              const target = findNode(roots, id);
              const collectDescendants = (n?: TreeNode | null): number[] => {
                if (!n) return [];
                const acc: number[] = [];
                const dfs = (x: TreeNode) => {
                  (x.children || []).forEach((c) => { acc.push(c.id); dfs(c); });
                };
                dfs(n);
                return acc;
              };
              const desc = collectDescendants(target);
              setCheckedIds((prev) => {
                const set = new Set(prev);
                if (checked) {
                  set.add(id);
                  desc.forEach((d) => set.add(d));
                } else {
                  set.delete(id);
                  desc.forEach((d) => set.delete(d));
                }
                return Array.from(set);
              });
            }}
            expandSignal={expandSignal}
            collapseSignal={collapseSignal}
          />
        </div>
        <div>
          {selectedId && (
            <AssetDetailsPanel asset={items.find((i) => i.id === selectedId) || root} />
          )}
          <div className="border rounded p-2 mt-3">
            <div className="text-sm font-medium mb-1">Histórico de manutenções</div>
            {loadingHistory && <div className="text-xs text-gray-500">Carregando...</div>}
            {!loadingHistory && history.length === 0 && <div className="text-xs text-gray-500">Nenhuma OS para este ativo</div>}
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="border rounded p-2">
                  <div className="text-sm font-medium">{h.title}</div>
                  <div className="text-xs text-gray-600">Status: {h.status}</div>
                  <div className="text-xs text-gray-600">Início: {h.startedAt ? new Date(h.startedAt).toLocaleString() : '-'}</div>
                  <div className="text-xs text-gray-600">Conclusão: {h.completedAt ? new Date(h.completedAt).toLocaleString() : '-'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {showPhotos && (
        <PhotosPanel assetId={selectedId || rootId} />
      )}
    </div>
  );
}

function NewRootMachinePanel({ onCreated, onRefresh }: { onCreated: (id?: number) => void; onRefresh: () => void }) {
  const [data, setData] = useState({
    name: "",
    code: "",
    location: "",
    manufacturer: "",
    model: "",
    year: "",
    criticality: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; year?: string }>({});

  const validate = () => {
    const e: { name?: string; year?: string } = {};
    if (!data.name.trim()) e.name = 'Nome é obrigatório';
    if (data.year) {
      const y = Number(data.year);
      if (isNaN(y) || y < 1900 || y > 2100) e.year = 'Ano deve estar entre 1900 e 2100';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        code: data.code || null,
        location: data.location || null,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        year: data.year ? Number(data.year) : null,
        criticality: data.criticality || null,
        parentId: null,
      })
    });
    setSaving(false);
    let id: number | undefined = undefined;
    try {
      const created = await safeParseJson(res, {} as any);
      id = created?.id;
    } catch {}
    onRefresh();
    onCreated(id);
  };

  return (
    <div className="border rounded p-3 mb-4">
      <div className="text-sm font-medium mb-2">Nova máquina-mãe</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <input className="border rounded px-2 py-1 w-full" placeholder="Nome *" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
          {errors.name && <div className="text-[11px] text-red-600 mt-1">{errors.name}</div>}
        </div>
        <input className="border rounded px-2 py-1" placeholder="Código" value={data.code} onChange={(e) => setData({ ...data, code: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Localização" value={data.location} onChange={(e) => setData({ ...data, location: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Fabricante" value={data.manufacturer} onChange={(e) => setData({ ...data, manufacturer: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Modelo" value={data.model} onChange={(e) => setData({ ...data, model: e.target.value })} />
        <div>
          <input className="border rounded px-2 py-1 w-full" type="number" placeholder="Ano (1900–2100)" min={1900} max={2100} value={data.year} onChange={(e) => setData({ ...data, year: e.target.value })} />
          {errors.year && <div className="text-[11px] text-red-600 mt-1">{errors.year}</div>}
        </div>
        <select className="border rounded px-2 py-1" value={data.criticality} onChange={(e) => setData({ ...data, criticality: e.target.value })}>
          <option value="">Criticidade</option>
          <option value="LOW">Baixa</option>
          <option value="MEDIUM">Média</option>
          <option value="HIGH">Alta</option>
        </select>
        <div>
          <button onClick={save} disabled={saving} className="px-3 py-1 bg-gray-800 text-white rounded text-sm mr-2">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
