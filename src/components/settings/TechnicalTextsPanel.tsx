"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MATRIX_LABELS } from "@/lib/format";
import { TEST_MATRIX_VALUES } from "@/lib/validations/test";

interface TechnicalText {
  matrix: string;
  title: string;
  content: string;
}

export function TechnicalTextsPanel({ texts }: { texts: TechnicalText[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, { title: string; content: string }>>(
    Object.fromEntries(
      TEST_MATRIX_VALUES.map((m) => {
        const existing = texts.find((t) => t.matrix === m);
        return [m, { title: existing?.title ?? `Texto Técnico - ${MATRIX_LABELS[m]}`, content: existing?.content ?? "" }];
      }),
    ),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(matrix: string) {
    setSaving(matrix);
    setError(null);
    const res = await fetch("/api/technical-texts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrix, ...form[matrix] }),
    });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar o texto técnico.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Textos Técnicos por Matriz</h2>
      <p className="text-xs text-gray-500 mb-4">
        Estes textos são usados como base ao criar uma nova proposta, conforme as matrizes selecionadas. Cada proposta
        pode ter seu texto editado individualmente sem afetar este texto base.
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {TEST_MATRIX_VALUES.map((m) => (
        <div key={m} className="mb-4">
          <label className="label">{MATRIX_LABELS[m]}</label>
          <textarea
            className="input mb-2"
            rows={4}
            value={form[m].content}
            onChange={(e) => setForm((f) => ({ ...f, [m]: { ...f[m], content: e.target.value } }))}
          />
          <button className="btn-secondary text-xs" disabled={saving === m} onClick={() => handleSave(m)}>
            {saving === m ? "Salvando..." : "Salvar"}
          </button>
        </div>
      ))}
    </div>
  );
}
