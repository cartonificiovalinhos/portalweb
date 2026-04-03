"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function AssetQuickView() {
  const params = useParams() as any;
  const id = Number(params.id);
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/assets/${id}`)
      .then(r => r.json())
      .then(setAsset)
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) return <div className="p-3">ID inválido</div>;
  if (loading) return <div className="p-3">Carregando...</div>;
  if (!asset) return <div className="p-3">Componente não encontrado</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-start gap-4">
        <Image src={asset.thumbnail || '/icons/logo cartonificio.png'} alt={asset.name} width={96} height={96} className="w-24 h-24 object-cover rounded border" unoptimized loader={({ src }) => src} />
        <div className="flex-1">
          <div className="text-2xl font-semibold">{asset.name}</div>
          <div className="text-sm text-gray-600">Código: {asset.code || '-'}</div>
          <div className="text-sm text-gray-600">Localização: {asset.location || '-'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {asset.manufacturer && <div><span className="text-gray-500">Fabricante:</span> {asset.manufacturer}</div>}
        {asset.model && <div><span className="text-gray-500">Modelo:</span> {asset.model}</div>}
        {asset.year && <div><span className="text-gray-500">Ano:</span> {asset.year}</div>}
        {asset.criticality && <div><span className="text-gray-500">Criticidade:</span> {asset.criticality}</div>}
        {asset.status && <div><span className="text-gray-500">Status:</span> {asset.status}</div>}
      </div>

      <div className="space-y-2">
        <div className="font-medium">Ações</div>
        <div className="flex gap-2">
          <Link href={`/work-orders?assetId=${asset.id}&create=1`} className="px-3 py-2 rounded bg-blue-600 text-white">Abrir nova Ordem de Serviço</Link>
          <Link href={`/assets`} className="px-3 py-2 rounded border">Ir para Ativos</Link>
        </div>
      </div>
    </div>
  );
}
