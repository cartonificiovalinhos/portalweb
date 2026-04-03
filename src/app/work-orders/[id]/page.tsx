"use client";
import { useEffect, useMemo, useState } from 'react';
import { safeParseJson } from '../../../lib/safeJson';
import { useParams } from 'next/navigation';
import { SignaturePad } from '../../../components/SignaturePad';
import Image from 'next/image';

export default function WorkOrderDetail() {
  const params = useParams() as any;
  const id = params.id;
  const [wo, setWo] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [signature, setSignature] = useState<string>("");
  const [assets, setAssets] = useState<any[]>([]);

  // Carregar todos os ativos para montar a árvore de consulta
  useEffect(() => {
    fetch('/api/assets').then((r) => safeParseJson(r, [] as any[])).then((list) => {
      setAssets(Array.isArray(list) ? list : []);
    });
  }, []);

  useEffect(() => {
    fetch(`/api/work-orders/${id}`).then(r => safeParseJson(r, {} as any)).then(setWo);
    fetch(`/api/work-orders/${id}/attachments`).then(r => safeParseJson(r, [])).then((list) => setAttachments(Array.isArray(list) ? list : []));
  }, [id]);

  const printOS = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const fmt = (d?: string) => {
      if (!d) return '-';
      try { return new Date(d).toLocaleString(); } catch { return String(d); }
    };
    const style = `
      body { font-family: Arial, sans-serif; color: #111; }
      .wrap { max-width: 900px; margin: 0 auto; padding: 24px; }
      .header { display:flex; align-items:center; gap:16px; border-bottom: 2px solid #333; padding-bottom: 12px; }
      .logo { width: 80px; height: 80px; object-fit: contain; }
      .title { font-size: 22px; font-weight: 700; }
      .meta { margin-top: 6px; color: #555; font-size: 12px; }
      .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-top: 12px; }
      .card { border:1px solid #ddd; border-radius:8px; padding:12px; margin-top: 16px; }
      .card h3 { margin: 0 0 8px 0; font-size: 14px; }
      .row { display:flex; gap:8px; }
      .label { width: 160px; color:#555; }
      table { width:100%; border-collapse: collapse; font-size: 12px; }
      th, td { border:1px solid #ddd; padding:6px 8px; text-align:left; }
      .attachments { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:10px; }
      .attachments img { width:100%; height:100px; object-fit:cover; border:1px solid #ddd; border-radius:6px; }
      .signature { max-width: 320px; border:1px solid #ddd; border-radius:6px; }
      .footer { margin-top: 24px; font-size: 11px; color:#666; }
      @media print { .no-print { display:none; } }
    `;
    const mttrText = wo.mttr != null ? `${wo.mttr} min` : '-';
    const maintained = wo.maintainedComponents ? (Array.isArray(wo.maintainedComponents) ? wo.maintainedComponents : []) : [];
    const usedEq = wo.usedEquipment ? (Array.isArray(wo.usedEquipment) ? wo.usedEquipment : []) : [];
    const tasks = wo.tasks ? (Array.isArray(wo.tasks) ? wo.tasks : []) : [];
    const attachmentsHtml = (attachments || []).map((a: any) => `<div><img src="${a.url}" alt="${a.fileName}" /><div style="font-size:11px;color:#555;margin-top:4px">${a.fileName}</div></div>`).join('');
    w.document.write(`
      <html>
        <head>
          <title>OS ${wo.code || wo.id}</title>
          <meta charset="utf-8" />
          <style>${style}</style>
        </head>
        <body>
          <div class="wrap">
            <div class="header">
              <img class="logo" src="/icons/logo cartonificio.png" alt="Cartonificio" />
              <div>
                <div class="title">Ordem de Serviço #${wo.code || wo.id}</div>
                <div class="meta">Emitida por: Cartonificio Valinhos • ${new Date().toLocaleString()}</div>
              </div>
            </div>

            <div class="card">
              <h3>Dados da OS</h3>
              <div class="grid">
                <div><span class="label">Título:</span> ${wo.title || '-'}</div>
                <div><span class="label">Ativo:</span> ${wo.asset?.name || '-'}</div>
                <div><span class="label">Setor:</span> ${wo.sector || '-'}</div>
                <div><span class="label">Tipo:</span> ${wo.maintenanceType || '-'}</div>
                <div><span class="label">Código ERP:</span> ${wo.erpCode || '-'}</div>
                <div><span class="label">Condição do ativo:</span> ${wo.assetCondition || '-'}</div>
                <div><span class="label">Pessoas:</span> ${wo.personnelCount ?? '-'}</div>
                <div><span class="label">Duração estimada:</span> ${wo.estimatedDurationMinutes ?? '-'} min</div>
                <div><span class="label">Programada:</span> ${fmt(wo.scheduledAt || wo.scheduled_at)}</div>
                <div><span class="label">Abertura:</span> ${fmt(wo.openedAt)}</div>
                <div><span class="label">Início:</span> ${fmt(wo.startedAt)}</div>
                <div><span class="label">Conclusão:</span> ${fmt(wo.completedAt)}</div>
                <div><span class="label">Encerramento:</span> ${fmt(wo.closedAt)}</div>
                <div><span class="label">MTTR:</span> ${mttrText}</div>
                <div><span class="label">Status:</span> ${wo.status}</div>
              </div>
            </div>

            <div class="card">
              <h3>Descrição</h3>
              <div>${(wo.description || '').replace(/\n/g, '<br/>') || '-'}</div>
            </div>

            <div class="card">
              <h3>Materiais</h3>
              <div>${wo.materials || '-'}</div>
            </div>

            <div class="card">
              <h3>Tarefas</h3>
              ${tasks.length ? `<ul>${tasks.map((t: any) => `<li>${typeof t === 'string' ? t : JSON.stringify(t)}</li>`).join('')}</ul>` : '<div>-</div>'}
            </div>

            <div class="card">
              <h3>Execução</h3>
              <div class="row"><span class="label">Equipamentos usados:</span> ${usedEq.length ? usedEq.join(', ') : '-'}</div>
              <div class="row"><span class="label">Componentes mantidos:</span> ${maintained.length ? maintained.map((c: any) => (typeof c === 'string' ? c : c?.name || JSON.stringify(c))).join(', ') : '-'}</div>
              <div class="row"><span class="label">Descrição da execução:</span> ${wo.executionDescription || '-'}</div>
              <div class="row"><span class="label">Observações:</span> ${wo.observations || '-'}</div>
            </div>

            <div class="card">
              <h3>Assinatura do técnico</h3>
              ${wo.technicianSignature ? `<img class="signature" src="${wo.technicianSignature}" alt="Assinatura" />` : '<div>-</div>'}
            </div>

            <div class="card">
              <h3>Anexos</h3>
              <div class="attachments">${attachmentsHtml || '<div>-</div>'}</div>
            </div>

            <div class="footer">Documento gerado pelo CMMS - Cartonificio • ${new Date().toLocaleDateString()}</div>
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 100);
  };

  // Helpers para árvore somente leitura
  type AssetNode = { id: number; name: string; code?: string | null; parentId?: number | null };
  const idMap = useMemo(() => {
    const map = new Map<number, AssetNode>();
    for (const a of assets) map.set(a.id, { id: a.id, name: a.name, code: a.code ?? null, parentId: a.parentId ?? null });
    return map;
  }, [assets]);
  const childrenMap = useMemo(() => {
    const map = new Map<number, AssetNode[]>();
    for (const a of assets) {
      const pid = a.parentId ?? 0;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push({ id: a.id, name: a.name, code: a.code ?? null, parentId: a.parentId ?? null });
    }
    Array.from(map.values()).forEach((arr) => arr.sort((x, y) => (x.name || '').localeCompare(y.name || '')));
    return map;
  }, [assets]);
  const renderSubtree = (rootId: number | null) => {
    if (!rootId || !idMap.has(rootId)) return null;
    const root = idMap.get(rootId)!;
    const walk = (node: AssetNode): any => {
      const kids = childrenMap.get(node.id) || [];
      return (
        <li key={node.id} className="mb-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{node.name}</span>
            {node.code && <span className="text-xs text-gray-500">{node.code}</span>}
          </div>
          {kids.length > 0 && (
            <ul className="mt-1 ml-6 border-l pl-3">
              {kids.map((c) => walk(c))}
            </ul>
          )}
        </li>
      );
    };
    return (
      <ul>
        {walk(root)}
      </ul>
    );
  };
 
  if (!wo) return <div>Carregando...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">OS #{wo.id}</h1>
      <div className="bg-white shadow rounded p-4">
        <div className="font-medium mb-2">{wo.title}</div>
        <div className="text-sm text-gray-600">Status: {wo.status}</div>
        <div className="text-sm text-gray-600">Setor: {wo.sector || '-'}</div>
        <div className="text-sm text-gray-600">Tipo: {wo.maintenanceType || '-'}</div>
        <div className="text-sm text-gray-600">
          Programada: {(() => {
            const s = wo.scheduledAt || wo.scheduled_at;
            if (!s) return '-';
            try { return new Date(s).toLocaleString(); } catch { return String(s); }
          })()}
        </div>
        <div className="text-sm">Ativo: {wo.asset?.name}</div>
        {wo.rootAssetId && (
          <div className="mt-3">
            <div className="font-medium mb-2">Componentes selecionados (visualização)</div>
            <div className="text-xs text-gray-500 mb-2">Árvore somente leitura dos ativos vinculados à abertura</div>
            <div className="rounded border p-3 bg-gray-50">
              {renderSubtree(wo.rootAssetId) || <div className="text-sm text-gray-600">Árvore não disponível</div>}
            </div>
          </div>
        )}
      </div>
      <div className="bg-white shadow rounded p-4">
        <div className="font-medium mb-2">Anexos</div>
        <div className="flex items-center gap-2 mb-3">
          <input type="file" accept="image/*" capture="environment" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
              const url = reader.result as string;
              setUploading(true);
              await fetch(`/api/work-orders/${id}/attachments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: file.name, url, mimeType: file.type })
              });
              setUploading(false);
              const list = await fetch(`/api/work-orders/${id}/attachments`).then(r => safeParseJson(r, []));
              setAttachments(Array.isArray(list) ? list : []);
            };
            reader.readAsDataURL(file);
          }} />
          {uploading && <span className="text-sm text-gray-600">Enviando...</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {attachments.map((a) => (
            <div key={a.id} className="border rounded overflow-hidden">
              <div className="relative w-full h-32">
                <Image src={a.url} alt={a.fileName} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" unoptimized loader={({ src }) => src} />
              </div>
              <div className="px-2 py-1 text-xs text-gray-600 truncate">{a.fileName}</div>
            </div>
          ))}
          {attachments.length === 0 && (
            <div className="text-sm text-gray-500">Nenhum anexo</div>
          )}
        </div>
      </div>
      <div>
        <div className="font-medium mb-2">Assinatura do executor/aprovador</div>
        <SignaturePad onChange={(d) => setSignature(d)} />
        <div className="mt-2">
          <button
            onClick={async () => {
              if (!signature) return;
              setUploading(true);
              await fetch(`/api/work-orders/${id}/attachments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: `assinatura-${Date.now()}.png`, url: signature, mimeType: 'image/png' })
              });
              setUploading(false);
              const list = await fetch(`/api/work-orders/${id}/attachments`).then(r => safeParseJson(r, []));
              setAttachments(Array.isArray(list) ? list : []);
            }}
            className="px-3 py-2 bg-blue-600 text-white rounded"
          >
            Salvar assinatura
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={printOS} className="px-4 py-2 bg-gray-800 text-white rounded">Imprimir OS</button>
      </div>
    </div>
  );
}
