"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { safeParseJson } from "../../../lib/safeJson";
import Link from "next/link";
import Image from "next/image";

type Asset = { id: number; name: string; code: string; parentId?: number | null };
type AssetPhoto = { id: number; fileName: string; url: string; mimeType?: string | null };

function AssetBranch({
  asset,
  map,
  photos,
  onUpload,
  onOpenForm,
}: {
  asset: Asset;
  map: Map<number, Asset[]>;
  photos: Record<number, AssetPhoto[]>;
  onUpload: (assetId: number, file: File) => void;
  onOpenForm: (assetId: number) => void;
}) {
  const children = map.get(asset.id) ?? [];
  const list = photos[asset.id] ?? [];
  return (
    <li className="mb-3">
      <div className="flex items-center gap-2">
        <span className="font-medium">{asset.name}</span>
        <span className="text-xs text-gray-500">{asset.code}</span>
        <button onClick={() => onOpenForm(asset.id)} className="text-blue-600 hover:underline text-xs">Nova OS</button>
        <Link href={`/work-orders?assetId=${asset.id}`} className="text-blue-600 hover:underline text-xs">Abrir OS</Link>
      </div>
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(asset.id, file);
            }}
          />
          <span className="text-xs text-gray-600">Fotos do ativo</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {list.map((p) => (
            <div key={p.id} className="border rounded overflow-hidden">
              <div className="relative w-full h-24">
                <Image src={p.url} alt={p.fileName} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" unoptimized loader={({ src }) => src} />
              </div>
              <div className="px-2 py-1 text-xs text-gray-600 truncate">{p.fileName}</div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="text-xs text-gray-500">Nenhuma foto</div>
          )}
        </div>
      </div>
      {children.length > 0 && (
        <ul className="ml-4 border-l pl-4 mt-2">
          {children.map((c) => (
            <AssetBranch key={c.id} asset={c} map={map} photos={photos} onUpload={onUpload} onOpenForm={onOpenForm} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function HierarchyPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<Record<number, AssetPhoto[]>>({});
  const [creatingFor, setCreatingFor] = useState<number | null>(null);
  const [woForm, setWoForm] = useState({ title: "", description: "" });
  const [seedLoading, setSeedLoading] = useState(false);

  const loadAssets = () => {
    setLoading(true);
    fetch("/api/assets")
      .then((r) => safeParseJson(r, []))
      .then((data) => setAssets(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const childrenByParent = useMemo(() => {
    const m = new Map<number, Asset[]>();
    assets.forEach((a) => {
      if (a.parentId) {
        const arr = m.get(a.parentId) ?? [];
        arr.push(a);
        m.set(a.parentId, arr);
      }
    });
    return m;
  }, [assets]);

  const matches = useCallback((a: Asset) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (a.name ?? "").toLowerCase().includes(q) ||
      (a.code ?? "").toLowerCase().includes(q)
    );
  }, [query]);

  const hasDescendantMatch = useCallback((a: Asset): boolean => {
    const children = childrenByParent.get(a.id) ?? [];
    for (const c of children) {
      if (matches(c) || hasDescendantMatch(c)) return true;
    }
    return false;
  }, [childrenByParent, matches]);

  const roots = useMemo(() => {
    const allRoots = assets.filter((a) => !a.parentId);
    if (!query.trim()) return allRoots;
    return allRoots.filter((r) => matches(r) || hasDescendantMatch(r));
  }, [assets, hasDescendantMatch, matches, query]);

  const ensurePhotosLoaded = async (assetId: number) => {
    if (photos[assetId]) return;
    const list = await fetch(`/api/assets/${assetId}/photos`).then((r) => safeParseJson(r, []));
    setPhotos((prev) => ({ ...prev, [assetId]: Array.isArray(list) ? list : [] }));
  };

  const onUpload = async (assetId: number, file: File) => {
    await ensurePhotosLoaded(assetId);
    const reader = new FileReader();
    reader.onload = async () => {
      const url = reader.result as string;
      await fetch(`/api/assets/${assetId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, url, mimeType: file.type }),
      });
      const list = await fetch(`/api/assets/${assetId}/photos`).then((r) => safeParseJson(r, []));
      setPhotos((prev) => ({ ...prev, [assetId]: Array.isArray(list) ? list : [] }));
    };
    reader.readAsDataURL(file);
  };

  const onOpenForm = async (assetId: number) => {
    setCreatingFor(assetId);
    setWoForm({ title: "", description: "" });
  };

  const createWO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatingFor) return;
    await fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: woForm.title, description: woForm.description, status: "OPEN", assetId: creatingFor }),
    });
    setCreatingFor(null);
    setWoForm({ title: "", description: "" });
  };

  const seedBHS = async () => {
    setSeedLoading(true);
    try {
      // Máquina-mãe
      const parent = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Onduladeira BHS", code: "OND-BHS", location: "Fabrica/Produção/Onduladeira", description: "Máquina principal de ondulação." }),
      }).then((r) => safeParseJson(r, {} as any));

      // Módulos
      const portaBobinas = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Porta Bobinas", code: "OND-PB", parentId: parent.id, description: "Módulo de alimentação de bobinas." }),
      }).then((r) => safeParseJson(r, {} as any));

      const cortadeira = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Cortadeira", code: "OND-CTR", parentId: parent.id, description: "Módulo de corte do papel." }),
      }).then((r) => safeParseJson(r, {} as any));

      // Subcomponentes
      await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Motor principal", code: "OND-PB-MTR", parentId: portaBobinas.id, description: "Motor de tração do porta bobinas." }),
      });
      await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Correia", code: "OND-CTR-CR", parentId: cortadeira.id, description: "Correia de transporte da cortadeira." }),
      });

      loadAssets();
    } finally {
      setSeedLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ativos — Hierarquia</h1>
          <p className="text-gray-600">Estrutura de máquinas, módulos e componentes.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-3 py-2 w-64"
            placeholder="Buscar por nome ou código"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={seedBHS} className="px-3 py-2 bg-gray-800 text-white rounded" disabled={seedLoading}>
            {seedLoading ? "Populando..." : "Popular Onduladeira BHS"}
          </button>
        </div>
      </div>

      {creatingFor && (
        <div className="bg-white shadow rounded p-4">
          <div className="font-semibold mb-2">Nova OS para ativo #{creatingFor}</div>
          <form onSubmit={createWO} className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="border rounded px-3 py-2" placeholder="Título" value={woForm.title} onChange={(e) => setWoForm({ ...woForm, title: e.target.value })} />
            <input className="border rounded px-3 py-2 md:col-span-2" placeholder="Descrição" value={woForm.description} onChange={(e) => setWoForm({ ...woForm, description: e.target.value })} />
            <div className="md:col-span-3">
              <button className="px-4 py-2 bg-blue-600 text-white rounded">Salvar OS</button>
              <button type="button" onClick={() => setCreatingFor(null)} className="ml-2 px-4 py-2 bg-gray-200 rounded">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded p-4">
        {loading && <div className="text-gray-500">Carregando...</div>}
        {!loading && roots.length === 0 && <div className="text-gray-500">Nenhum ativo cadastrado.</div>}
        {!loading && roots.length > 0 && (
          <ul>
            {roots.map((r) => (
              <AssetBranch key={r.id} asset={r} map={childrenByParent} photos={photos} onUpload={onUpload} onOpenForm={onOpenForm} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
