"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeApprovalTypeName } from "@/lib/approval-type-name";

type CommercialFamily = { id: number; description: string; erpCode?: string | null };
type ApprovalFieldType = "INTEGER" | "CHAR" | "DATE" | "DECIMAL";
type ApprovalField = {
  id: number;
  label: string;
  fieldType: ApprovalFieldType;
  required: boolean;
  sortOrder: number;
};
type ApprovalAssignment = {
  id: number;
  canView: boolean;
  rangeFromValue: string | null;
  rangeToValue: string | null;
  approvalField: { id: number; label: string; fieldType: ApprovalFieldType };
  user: { id: number; name: string; abbrevName?: string | null; email?: string | null; doc?: string | null };
};
type ApprovalType = {
  id: number;
  name: string;
  description?: string | null;
  isActive: boolean;
  fields: ApprovalField[];
  assignments: ApprovalAssignment[];
};
type UserSearchRow = { id: number; name: string; abbrevName?: string | null; email?: string | null; doc?: string | null };

const FIELD_TYPE_OPTIONS: Array<{ value: ApprovalFieldType; label: string; tone: string }> = [
  { value: "INTEGER", label: "Inteiro", tone: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "CHAR", label: "Char", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "DATE", label: "Data", tone: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "DECIMAL", label: "Decimal", tone: "bg-violet-100 text-violet-700 border-violet-200" },
];

function typeLabel(fieldType: ApprovalFieldType) {
  return FIELD_TYPE_OPTIONS.find((option) => option.value === fieldType)?.label || fieldType;
}

function typeTone(fieldType: ApprovalFieldType) {
  return FIELD_TYPE_OPTIONS.find((option) => option.value === fieldType)?.tone || "bg-gray-100 text-gray-700 border-gray-200";
}

function formatRangeValue(fieldType: ApprovalFieldType, value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "-";

  if (fieldType === "DECIMAL") {
    const num = Number(raw);
    return Number.isFinite(num)
      ? num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : raw;
  }

  if (fieldType === "INTEGER") {
    const num = Number(raw);
    return Number.isFinite(num) ? num.toLocaleString("pt-BR") : raw;
  }

  if (fieldType === "DATE") {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }

  return raw;
}

function blankTypeForm() {
  return { name: "", description: "", isActive: true };
}

function blankFieldForm() {
  return { id: null as number | null, label: "", fieldType: "DECIMAL" as ApprovalFieldType, required: true };
}

function blankAssignmentForm() {
  return {
    id: null as number | null,
    userId: null as number | null,
    userLabel: "",
    approvalFieldId: null as number | null,
    rangeFromValue: "",
    rangeToValue: "",
    canView: true,
  };
}

function RangeInput({
  fieldType,
  value,
  onChange,
  placeholder,
}: {
  fieldType: ApprovalFieldType;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  if (fieldType === "DATE") {
    return (
      <input
        type="date"
        className="w-full px-3 py-2 border rounded text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      type="text"
      className="w-full px-3 py-2 border rounded text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export default function AdminApprovalsPage() {
  const [tab, setTab] = useState<"commercial" | "supplies" | "finance">("commercial");
  const [families, setFamilies] = useState<CommercialFamily[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);
  const selectedFamily = useMemo(
    () => families.find((family) => family.id === selectedFamilyId) || null,
    [families, selectedFamilyId],
  );

  const [approvalTypes, setApprovalTypes] = useState<ApprovalType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const selectedType = useMemo(
    () => approvalTypes.find((approvalType) => approvalType.id === selectedTypeId) || null,
    [approvalTypes, selectedTypeId],
  );

  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [savingType, setSavingType] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [typeMode, setTypeMode] = useState<"create" | "edit">("edit");
  const [isTypeEditorOpen, setIsTypeEditorOpen] = useState(false);
  const [typeForm, setTypeForm] = useState(blankTypeForm());
  const [fieldForm, setFieldForm] = useState(blankFieldForm());
  const [assignmentForm, setAssignmentForm] = useState(blankAssignmentForm());

  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserSearchRow[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetFieldForm = useCallback(() => setFieldForm(blankFieldForm()), []);
  const resetAssignmentForm = useCallback(() => {
    setAssignmentForm(blankAssignmentForm());
    setUserQuery("");
    setUserResults([]);
  }, []);

  const applySelectedTypeToForm = useCallback((approvalType: ApprovalType | null) => {
    if (!approvalType) {
      setTypeMode("create");
      setTypeForm(blankTypeForm());
      resetFieldForm();
      resetAssignmentForm();
      return;
    }

    setTypeMode("edit");
    setTypeForm({
      name: approvalType.name || "",
      description: approvalType.description || "",
      isActive: approvalType.isActive !== false,
    });
    resetFieldForm();
    resetAssignmentForm();
  }, [resetAssignmentForm, resetFieldForm]);

  const loadFamilies = useCallback(async () => {
    setLoadingFamilies(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/approvals/commercial-families", { cache: "no-store" });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);

      const rows = Array.isArray(data?.families) ? (data.families as CommercialFamily[]) : [];
      setFamilies(rows);
      setSelectedFamilyId((prev) => (prev && rows.some((row) => row.id === prev) ? prev : rows[0]?.id ?? null));
    } catch (err: any) {
      setError(err?.message || String(err));
      setFamilies([]);
      setSelectedFamilyId(null);
    } finally {
      setLoadingFamilies(false);
    }
  }, []);

  const loadApprovalTypes = useCallback(async (familyId: number) => {
    setLoadingTypes(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/admin/approvals/commercial-families/${familyId}/types`, { cache: "no-store" });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);

      const rows = Array.isArray(data?.types) ? (data.types as ApprovalType[]) : [];
      setApprovalTypes(rows);
      setSelectedTypeId((prev) => (prev && rows.some((row) => row.id === prev) ? prev : rows[0]?.id ?? null));
      setWarning(typeof data?.warning === "string" ? data.warning : null);
    } catch (err: any) {
      setError(err?.message || String(err));
      setApprovalTypes([]);
      setSelectedTypeId(null);
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  useEffect(() => {
    void loadFamilies();
  }, [loadFamilies]);

  useEffect(() => {
    if (tab !== "commercial") return;
    if (!selectedFamilyId) {
      setApprovalTypes([]);
      setSelectedTypeId(null);
      applySelectedTypeToForm(null);
      return;
    }
    void loadApprovalTypes(selectedFamilyId);
  }, [applySelectedTypeToForm, loadApprovalTypes, selectedFamilyId, tab]);

  useEffect(() => {
    if (isTypeEditorOpen) return;
    applySelectedTypeToForm(selectedType);
  }, [applySelectedTypeToForm, isTypeEditorOpen, selectedType]);

  useEffect(() => {
    if (!assignmentForm.userId && !userQuery.trim()) {
      setUserResults([]);
      return;
    }
    const q = userQuery.trim();
    if (!q) {
      setUserResults([]);
      return;
    }
    if (assignmentForm.userId && q === assignmentForm.userLabel) {
      setUserResults([]);
      return;
    }

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await fetch(`/api/admin/approvals/users?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
        setUserResults(Array.isArray(data?.users) ? (data.users as UserSearchRow[]) : []);
      } catch (err: any) {
        setError(err?.message || String(err));
        setUserResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 250);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [assignmentForm.userId, assignmentForm.userLabel, userQuery]);

  const rangeFields = useMemo(
    () => selectedType?.fields || [],
    [selectedType],
  );

  const selectedAssignmentField = useMemo(
    () => rangeFields.find((field) => field.id === assignmentForm.approvalFieldId) || rangeFields[0] || null,
    [assignmentForm.approvalFieldId, rangeFields],
  );

  useEffect(() => {
    if (!assignmentForm.approvalFieldId && rangeFields.length > 0) {
      setAssignmentForm((prev) => ({ ...prev, approvalFieldId: rangeFields[0].id }));
    }
  }, [assignmentForm.approvalFieldId, rangeFields]);

  const handleCreateType = () => {
    setSelectedTypeId(null);
    setTypeMode("create");
    setTypeForm(blankTypeForm());
    resetFieldForm();
    resetAssignmentForm();
    setIsTypeEditorOpen(true);
  };

  const handleEditType = () => {
    if (!selectedType) return;
    setTypeMode("edit");
    setTypeForm({
      name: selectedType.name || "",
      description: selectedType.description || "",
      isActive: selectedType.isActive !== false,
    });
    setIsTypeEditorOpen(true);
  };

  const handleCancelTypeEditor = () => {
    setIsTypeEditorOpen(false);
    applySelectedTypeToForm(selectedType);
  };

  const handleSaveType = async () => {
    if (!selectedFamilyId) return;
    const payload = {
      name: typeForm.name,
      description: typeForm.description,
      isActive: typeForm.isActive,
    };

    setSavingType(true);
    setError(null);
    try {
      const res = await fetch(
        typeMode === "create"
          ? `/api/admin/approvals/commercial-families/${selectedFamilyId}/types`
          : `/api/admin/approvals/types/${selectedTypeId}`,
        {
          method: typeMode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);

      await loadApprovalTypes(selectedFamilyId);
      if (typeMode === "create" && data?.type?.id) {
        setSelectedTypeId(Number(data.type.id));
      }
      setIsTypeEditorOpen(false);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSavingType(false);
    }
  };

  const handleDeleteType = async () => {
    if (!selectedTypeId || !selectedFamilyId) return;
    const confirmed = window.confirm("Confirma excluir este tipo de aprovação?");
    if (!confirmed) return;

    setSavingType(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/approvals/types/${selectedTypeId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);

      await loadApprovalTypes(selectedFamilyId);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSavingType(false);
    }
  };

  const handleSaveField = async () => {
    if (!selectedType && selectedTypeId == null) return;
    const typeId = selectedType?.id ?? selectedTypeId;
    if (!typeId) return;

    setSavingField(true);
    setError(null);
    try {
      const res = await fetch(
        fieldForm.id
          ? `/api/admin/approvals/types/${typeId}/fields/${fieldForm.id}`
          : `/api/admin/approvals/types/${typeId}/fields`,
        {
          method: fieldForm.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: fieldForm.label,
            fieldType: fieldForm.fieldType,
            required: fieldForm.required,
          }),
        },
      );
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);

      if (selectedFamilyId) await loadApprovalTypes(selectedFamilyId);
      resetFieldForm();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSavingField(false);
    }
  };

  const handleDeleteField = async (fieldId: number) => {
    if (!selectedType || !selectedFamilyId) return;
    const confirmed = window.confirm("Confirma excluir este campo? Os vínculos ligados a ele também serão removidos.");
    if (!confirmed) return;

    setSavingField(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/approvals/types/${selectedType.id}/fields/${fieldId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);

      await loadApprovalTypes(selectedFamilyId);
      resetFieldForm();
      resetAssignmentForm();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSavingField(false);
    }
  };

  const handleEditField = (field: ApprovalField) => {
    setFieldForm({
      id: field.id,
      label: field.label,
      fieldType: field.fieldType,
      required: field.required,
    });
  };

  const handleSelectUser = (user: UserSearchRow) => {
    setAssignmentForm((prev) => ({
      ...prev,
      userId: user.id,
      userLabel: user.name,
    }));
    setUserQuery(user.name);
    setUserResults([]);
  };

  const handleSaveAssignment = async () => {
    if (!selectedType?.id) return;
    if (!assignmentForm.userId) {
      setError("Selecione um usuário válido da base do portal.");
      return;
    }
    if (!assignmentForm.approvalFieldId) {
      setError("Selecione um campo de faixa.");
      return;
    }

    setSavingAssignment(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/approvals/types/${selectedType.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignmentForm.id,
          userId: assignmentForm.userId,
          approvalFieldId: assignmentForm.approvalFieldId,
          rangeFromValue: assignmentForm.rangeFromValue,
          rangeToValue: assignmentForm.rangeToValue,
          canView: assignmentForm.canView,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);

      if (selectedFamilyId) await loadApprovalTypes(selectedFamilyId);
      resetAssignmentForm();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleEditAssignment = (assignment: ApprovalAssignment) => {
    setAssignmentForm({
      id: assignment.id,
      userId: assignment.user.id,
      userLabel: assignment.user.name,
      approvalFieldId: assignment.approvalField.id,
      rangeFromValue: assignment.rangeFromValue || "",
      rangeToValue: assignment.rangeToValue || "",
      canView: assignment.canView,
    });
    setUserQuery(assignment.user.name);
    setUserResults([]);
  };

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!selectedType?.id || !selectedFamilyId) return;
    const confirmed = window.confirm("Confirma remover este vínculo de usuário?");
    if (!confirmed) return;

    setSavingAssignment(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/approvals/types/${selectedType.id}/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);

      await loadApprovalTypes(selectedFamilyId);
      resetAssignmentForm();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSavingAssignment(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Administração • Aprovações</h1>

      <div className="flex flex-wrap gap-2 border-b">
        <button className={`px-3 py-2 text-sm ${tab === "commercial" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-600"}`} onClick={() => setTab("commercial")}>Comercial</button>
        <button className={`px-3 py-2 text-sm ${tab === "supplies" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-600"}`} onClick={() => setTab("supplies")}>Suprimentos</button>
        <button className={`px-3 py-2 text-sm ${tab === "finance" ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-600"}`} onClick={() => setTab("finance")}>Financeiro</button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {warning && <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{warning}</div>}

      {tab !== "commercial" && (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">Em desenvolvimento.</div>
      )}

      {tab === "commercial" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <section className="rounded border bg-white p-3 xl:col-span-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-medium">Famílias Comerciais</h2>
              <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={loadFamilies} disabled={loadingFamilies}>
                Atualizar
              </button>
            </div>

            <div className="space-y-2">
              {families.map((family) => (
                <button
                  key={family.id}
                  className={`w-full rounded border px-3 py-3 text-left transition ${selectedFamilyId === family.id ? "border-blue-300 bg-blue-50" : "hover:bg-gray-50"}`}
                  onClick={() => setSelectedFamilyId(family.id)}
                >
                  <div className="text-sm font-semibold">{family.description}</div>
                  <div className="text-xs text-gray-500">{family.erpCode || family.description}</div>
                </button>
              ))}
              {!loadingFamilies && families.length === 0 && (
                <div className="rounded border border-dashed px-3 py-6 text-center text-sm text-gray-500">
                  Nenhuma família comercial encontrada.
                </div>
              )}
              {loadingFamilies && <div className="text-sm text-gray-500">Carregando famílias...</div>}
            </div>
          </section>

          <section className="space-y-4 xl:col-span-9">
            <div className="rounded border bg-white p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium">Tipos de Aprovação • {selectedFamily?.description || "Selecione uma família"}</h2>
                  <p className="text-sm text-gray-500">Cadastre os tipos de aprovação utilizados para esta família e organize os campos que serão avaliados.</p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded border border-blue-200 bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700" onClick={handleCreateType}>
                    Novo Tipo
                  </button>
                  <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" onClick={handleEditType} disabled={!selectedTypeId || savingType}>
                    Editar
                  </button>
                  <button className="rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50" onClick={handleDeleteType} disabled={!selectedTypeId || savingType}>
                    Excluir
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {approvalTypes.map((approvalType) => (
                  <button
                    key={approvalType.id}
                    className={`rounded border p-4 text-left transition ${selectedTypeId === approvalType.id ? "border-blue-300 bg-blue-50 shadow-sm" : "hover:bg-gray-50"}`}
                    onClick={() => setSelectedTypeId(approvalType.id)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{approvalType.description || approvalType.name}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className={`rounded-full border px-2 py-0.5 ${approvalType.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-100 text-gray-600"}`}>
                          {approvalType.isActive ? "Ativo" : "Inativo"}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-600">{approvalType.fields.length} campo(s)</span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-600">{approvalType.assignments.length} vínculo(s)</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {!loadingTypes && approvalTypes.length === 0 && (
                <div className="mt-3 rounded border border-dashed px-3 py-6 text-center text-sm text-gray-500">
                  Nenhum tipo de aprovação cadastrado para esta família.
                </div>
              )}
              {loadingTypes && <div className="mt-3 text-sm text-gray-500">Carregando tipos...</div>}
            </div>

            {isTypeEditorOpen && (
              <div className="rounded border bg-white p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium">Configuração do Tipo de Aprovação</h3>
                    <p className="text-sm text-gray-500">Defina o nome e a finalidade do tipo selecionado. Isso ajuda o usuário a entender rapidamente o contexto da aprovação.</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" onClick={handleCancelTypeEditor} disabled={savingType}>
                      Cancelar
                    </button>
                    <button className="rounded border border-blue-200 bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" onClick={handleSaveType} disabled={savingType || !selectedFamilyId}>
                      {savingType ? "Salvando..." : typeMode === "create" ? "Criar Tipo" : "Salvar Tipo"}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <label className="mb-1 block text-sm font-medium">Nome do tipo</label>
                    <input
                      className="w-full rounded border px-3 py-2 text-sm"
                      value={typeForm.name}
                      onChange={(e) => setTypeForm((prev) => ({ ...prev, name: sanitizeApprovalTypeName(e.target.value) }))}
                    />
                    <div className="mt-1 text-xs text-gray-500">Use apenas letras e números, sem espaços e sem caracteres especiais.</div>
                  </div>
                  <div className="lg:col-span-5">
                    <label className="mb-1 block text-sm font-medium">Descrição</label>
                    <input className="w-full rounded border px-3 py-2 text-sm" value={typeForm.description} onChange={(e) => setTypeForm((prev) => ({ ...prev, description: e.target.value }))} />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-sm font-medium">Situação</label>
                    <label className="flex h-[42px] items-center gap-2 rounded border px-3 text-sm">
                      <input type="checkbox" checked={typeForm.isActive} onChange={(e) => setTypeForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                      Ativo
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded border bg-white p-3">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">Campos da Aprovação</h3>
                  <p className="text-sm text-gray-500">Defina os campos disponíveis no tipo de aprovação e quais deles podem ser usados como faixa de alçada.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-gray-500">Tipos disponíveis:</span>
                  {FIELD_TYPE_OPTIONS.map((option) => (
                    <span key={option.value} className={`rounded-full border px-2 py-1 ${option.tone}`}>{option.label}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded border bg-gray-50 p-3 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <label className="mb-1 block text-sm font-medium">Campo</label>
                  <input className="w-full rounded border px-3 py-2 text-sm" value={fieldForm.label} onChange={(e) => setFieldForm((prev) => ({ ...prev, label: e.target.value }))} disabled={!selectedType && typeMode !== "create"} />
                </div>
                <div className="lg:col-span-3">
                  <label className="mb-1 block text-sm font-medium">Tipo</label>
                  <select className="w-full rounded border px-3 py-2 text-sm" value={fieldForm.fieldType} onChange={(e) => setFieldForm((prev) => ({ ...prev, fieldType: e.target.value as ApprovalFieldType }))} disabled={!selectedType}>
                    {FIELD_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Obrigatório</label>
                  <label className="flex h-[42px] items-center gap-2 rounded border bg-white px-3 text-sm">
                    <input type="checkbox" checked={fieldForm.required} onChange={(e) => setFieldForm((prev) => ({ ...prev, required: e.target.checked }))} disabled={!selectedType} />
                    Sim
                  </label>
                </div>
                <div className="lg:col-span-3 flex items-end gap-2">
                  <button className="w-full rounded border border-blue-200 bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" onClick={handleSaveField} disabled={!selectedType || savingField}>
                    {fieldForm.id ? "Salvar" : "Adicionar"}
                  </button>
                </div>
                {fieldForm.id && (
                  <div className="lg:col-span-12">
                    <button className="text-sm text-gray-600 underline" onClick={resetFieldForm}>Cancelar edição do campo</button>
                  </div>
                )}
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Campo</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-center">Obrigatório</th>
                      <th className="px-3 py-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedType?.fields || []).map((field) => (
                      <tr key={field.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{field.label}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2 py-1 text-xs ${typeTone(field.fieldType)}`}>{typeLabel(field.fieldType)}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`rounded-full border px-2 py-1 text-xs ${field.required ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-100 text-gray-600"}`}>
                            {field.required ? "Sim" : "Não"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex justify-center gap-2">
                            <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => handleEditField(field)}>Editar</button>
                            <button className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => handleDeleteField(field.id)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {selectedType && selectedType.fields.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">Nenhum campo cadastrado para este tipo.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded border bg-white p-3">
              <h3 className="font-medium">Usuários vinculados ao tipo de aprovação</h3>
              <p className="mb-3 text-sm text-gray-500">Escolha o usuário da base do portal, informe o campo de faixa e defina o intervalo de responsabilidade para este tipo.</p>

              <div className="grid grid-cols-1 gap-3 rounded border bg-gray-50 p-3 lg:grid-cols-12">
                <div className="lg:col-span-3">
                  <label className="mb-1 block text-sm font-medium">Usuário</label>
                  <input
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={userQuery}
                    onChange={(e) => {
                      setUserQuery(e.target.value);
                      setAssignmentForm((prev) => ({ ...prev, userId: null, userLabel: e.target.value }));
                    }}
                    placeholder="Pesquisar usuário da base do portal"
                    disabled={!selectedType}
                  />
                  {searchingUsers && <div className="mt-1 text-xs text-gray-500">Pesquisando usuários...</div>}
                  {!searchingUsers && userQuery.trim() && userResults.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-auto rounded border bg-white">
                      {userResults.map((user) => (
                        <button
                          key={user.id}
                          className="block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-gray-50"
                          onClick={() => handleSelectUser(user)}
                        >
                          <div className="text-sm font-medium">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.abbrevName || "-"} • {user.email || "-"} • {user.doc || "-"}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3">
                  <label className="mb-1 block text-sm font-medium">Campo de faixa</label>
                  <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={assignmentForm.approvalFieldId ?? ""}
                    onChange={(e) => setAssignmentForm((prev) => ({ ...prev, approvalFieldId: Number(e.target.value) || null, rangeFromValue: "", rangeToValue: "" }))}
                    disabled={!selectedType || rangeFields.length === 0}
                  >
                    <option value="">Selecione</option>
                    {rangeFields.map((field) => (
                      <option key={field.id} value={field.id}>{field.label}</option>
                    ))}
                  </select>
                  {selectedType && rangeFields.length === 0 && (
                    <div className="mt-1 text-xs text-amber-700">Cadastre pelo menos um campo para vincular usuários.</div>
                  )}
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-1 block text-sm font-medium">De</label>
                  <RangeInput
                    fieldType={selectedAssignmentField?.fieldType || "DECIMAL"}
                    value={assignmentForm.rangeFromValue}
                    onChange={(value) => setAssignmentForm((prev) => ({ ...prev, rangeFromValue: value }))}
                    placeholder={selectedAssignmentField?.fieldType === "CHAR" ? "Valor inicial" : "Valor inicial"}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Até</label>
                  <RangeInput
                    fieldType={selectedAssignmentField?.fieldType || "DECIMAL"}
                    value={assignmentForm.rangeToValue}
                    onChange={(value) => setAssignmentForm((prev) => ({ ...prev, rangeToValue: value }))}
                    placeholder={selectedAssignmentField?.fieldType === "CHAR" ? "Valor final" : "Valor final"}
                  />
                </div>

                <div className="lg:col-span-1">
                  <label className="mb-1 block text-sm font-medium">Visualiza</label>
                  <label className="flex h-[42px] items-center gap-2 rounded border bg-white px-3 text-sm">
                    <input type="checkbox" checked={assignmentForm.canView} onChange={(e) => setAssignmentForm((prev) => ({ ...prev, canView: e.target.checked }))} disabled={!selectedType} />
                    Sim
                  </label>
                </div>

                <div className="lg:col-span-1 flex items-end">
                  <button className="w-full rounded border border-blue-200 bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" onClick={handleSaveAssignment} disabled={!selectedType || rangeFields.length === 0 || savingAssignment}>
                    {assignmentForm.id ? "Salvar" : "Vincular"}
                  </button>
                </div>

                {assignmentForm.id && (
                  <div className="lg:col-span-12">
                    <button className="text-sm text-gray-600 underline" onClick={resetAssignmentForm}>Cancelar edição do vínculo</button>
                  </div>
                )}
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Usuário</th>
                      <th className="px-3 py-2 text-left">Campo de faixa</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-right">De</th>
                      <th className="px-3 py-2 text-right">Até</th>
                      <th className="px-3 py-2 text-center">Visualiza</th>
                      <th className="px-3 py-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedType?.assignments || []).map((assignment) => (
                      <tr key={assignment.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium">{assignment.user.name}</div>
                          <div className="text-xs text-gray-500">{assignment.user.abbrevName || "-"} • {assignment.user.email || "-"} • {assignment.user.doc || "-"}</div>
                        </td>
                        <td className="px-3 py-2 font-medium">{assignment.approvalField.label}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2 py-1 text-xs ${typeTone(assignment.approvalField.fieldType)}`}>{typeLabel(assignment.approvalField.fieldType)}</span>
                        </td>
                        <td className="px-3 py-2 text-right">{formatRangeValue(assignment.approvalField.fieldType, assignment.rangeFromValue)}</td>
                        <td className="px-3 py-2 text-right">{formatRangeValue(assignment.approvalField.fieldType, assignment.rangeToValue)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`rounded-full border px-2 py-1 text-xs ${assignment.canView ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-100 text-gray-600"}`}>
                            {assignment.canView ? "Sim" : "Não"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex justify-center gap-2">
                            <button className="rounded border px-2 py-1 text-xs hover:bg-gray-50" onClick={() => handleEditAssignment(assignment)}>Editar</button>
                            <button className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => handleDeleteAssignment(assignment.id)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {selectedType && selectedType.assignments.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">Nenhum usuário vinculado a este tipo.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
