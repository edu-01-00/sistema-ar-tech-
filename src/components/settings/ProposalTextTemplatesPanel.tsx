"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MATRIX_LABELS, PROPOSAL_TEXT_CATEGORY_LABELS } from "@/lib/format";

export interface ProposalTextTemplateRow {
  id: string;
  category: string;
  matrix: string | null;
  name: string;
  content: string;
  active: boolean;
}

// Item 36: painel administrativo para visualizar/editar/ativar-desativar e
// restaurar o texto padrão original de cada seção administrável da proposta.
// Editar aqui nunca altera propostas já emitidas (snapshot próprio).
export function ProposalTextTemplatesPanel({ templates }: { templates: ProposalTextTemplateRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, { name: string; content: string; active: boolean }>>(
    Object.fromEntries(templates.map((t) => [t.id, { name: t.name, content: t.content, active: t.active }])),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(id: string) {
    setSaving(id);
    setError(null);
    const res = await fetch(`/api/proposal-text-templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form[id]),
    });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar o texto.");
      return;
    }
    router.refresh();
  }

  async function handleRestoreDefault(id: string) {
    if (!window.confirm("Restaurar o texto padrão original? As alterações feitas serão perdidas.")) return;
    setSaving(id);
    setError(null);
    const res = await fetch(`/api/proposal-text-templates/${id}/restore-default`, { method: "PATCH" });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível restaurar o texto padrão.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-1">Textos Padrão da Proposta</h2>
      <p className="text-xs text-gray-500 mb-4">
        Estes textos são copiados para cada proposta no momento da sua criação. Alterá-los aqui NÃO afeta propostas já
        emitidas.
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-5">
        {templates.map((t) => (
          <div key={t.id} className="border border-gray-200 rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {PROPOSAL_TEXT_CATEGORY_LABELS[t.category] ?? t.category}
                  {t.matrix ? ` — ${MATRIX_LABELS[t.matrix] ?? t.matrix}` : ""}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={form[t.id].active}
                  onChange={(e) => setForm((f) => ({ ...f, [t.id]: { ...f[t.id], active: e.target.checked } }))}
                />
                Ativo
              </label>
            </div>
            <input
              className="input mb-2"
              value={form[t.id].name}
              onChange={(e) => setForm((f) => ({ ...f, [t.id]: { ...f[t.id], name: e.target.value } }))}
            />
            <textarea
              className="input mb-2"
              rows={6}
              value={form[t.id].content}
              onChange={(e) => setForm((f) => ({ ...f, [t.id]: { ...f[t.id], content: e.target.value } }))}
            />
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" disabled={saving === t.id} onClick={() => handleSave(t.id)}>
                {saving === t.id ? "Salvando..." : "Salvar"}
              </button>
              <button className="btn-danger text-xs" disabled={saving === t.id} onClick={() => handleRestoreDefault(t.id)}>
                Restaurar padrão
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
