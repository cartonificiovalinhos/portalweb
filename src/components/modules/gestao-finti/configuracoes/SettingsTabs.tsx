"use client";

import { useState } from "react";
import { 
  createCategory, 
  createSupplier, 
  createCostCenter 
} from "@/app/admin/modules/gestao-finti/configuracoes/actions";
import { Plus, Loader2 } from "lucide-react";
import { GestaoFintiCategoria, GestaoFintiFornecedor, GestaoFintiCentroCusto } from "@prisma/client";

interface SettingsTabsProps {
  categories: GestaoFintiCategoria[];
  suppliers: GestaoFintiFornecedor[];
  costCenters: GestaoFintiCentroCusto[];
}

export function SettingsTabs({ 
  categories, 
  suppliers, 
  costCenters
}: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState("categories");

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {["Categorias", "Fornecedores", "Centros de Custo"].map((tab) => {
             const map: Record<string, string> = {
                "Categorias": "categories",
                "Fornecedores": "suppliers",
                "Centros de Custo": "cost_centers"
             };
             const id = map[tab];

             return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(id)}
                  className={`
                    whitespace-nowrap border-b-2 border-solid py-4 px-1 text-sm font-medium
                    ${activeTab === id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"}
                  `}
                >
                  {tab}
                </button>
             );
          })}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === "categories" && <CategoriesTab categories={categories} />}
        {activeTab === "suppliers" && <SuppliersTab suppliers={suppliers} />}
        {activeTab === "cost_centers" && <CostCentersTab costCenters={costCenters} />}
      </div>
    </div>
  );
}

function CategoriesTab({ categories }: { categories: GestaoFintiCategoria[] }) {
  const [name, setName] = useState("");
  const [isTi, setIsTi] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createCategory(name, isTi);
      setName("");
      setIsTi(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao criar categoria.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Nova Categoria</h3>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
             <input 
                type="checkbox" 
                id="catIsTi" 
                checked={isTi} 
                onChange={(e) => setIsTi(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
             />
             <label htmlFor="catIsTi" className="text-sm text-gray-700">TI Financeiro</label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Adicionar
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Categorias Existentes</h3>
        <ul className="divide-y divide-gray-200 rounded-lg border bg-white shadow-sm max-h-[500px] overflow-y-auto">
          {categories.map((cat) => (
            <li key={cat.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
              <span className="text-sm font-medium text-gray-900">{cat.nome}</span>
              {cat.isTi && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">TI</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SuppliersTab({ suppliers }: { suppliers: GestaoFintiFornecedor[] }) {
    const [name, setName] = useState("");
    const [document, setDocument] = useState("");
    const [isTi, setIsTi] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createSupplier(name, document, isTi);
            setName("");
            setDocument("");
            setIsTi(false);
        } catch (error) {
            console.error(error);
            alert("Erro ao criar fornecedor.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Novo Fornecedor</h3>
                <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nome</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Documento</label>
                        <input
                            type="text"
                            value={document}
                            onChange={(e) => setDocument(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="supIsTi" 
                            checked={isTi} 
                            onChange={(e) => setIsTi(e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="supIsTi" className="text-sm text-gray-700">TI Financeiro</label>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Adicionar
                    </button>
                </form>
            </div>
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Fornecedores Existentes</h3>
                <ul className="divide-y divide-gray-200 rounded-lg border bg-white shadow-sm max-h-[500px] overflow-y-auto">
                    {suppliers.map((sup) => (
                        <li key={sup.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                            <div>
                                <p className="text-sm font-medium text-gray-900">{sup.nome}</p>
                                {sup.documento && <p className="text-xs text-gray-500">{sup.documento}</p>}
                            </div>
                            {sup.isTi && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">TI</span>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

function CostCentersTab({ costCenters }: { costCenters: GestaoFintiCentroCusto[] }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createCostCenter(name, description);
            setName("");
            setDescription("");
        } catch (error) {
            console.error(error);
            alert("Erro ao criar centro de custo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Novo Centro de Custo</h3>
                <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nome</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Descrição</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Adicionar
                    </button>
                </form>
            </div>
             <div className="space-y-4">
                <h3 className="text-lg font-medium">Centros de Custo Existentes</h3>
                <ul className="divide-y divide-gray-200 rounded-lg border bg-white shadow-sm max-h-[500px] overflow-y-auto">
                    {costCenters.map((cc) => (
                        <li key={cc.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                            <div>
                                <p className="text-sm font-medium text-gray-900">{cc.nome}</p>
                                {cc.descricao && <p className="text-xs text-gray-500">{cc.descricao}</p>}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
