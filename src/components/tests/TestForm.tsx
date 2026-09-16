"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { MATRIX_LABELS } from "@/lib/format";
import type { Test } from "@prisma/client";

const MATRIX_OPTIONS = Object.entries(MATRIX_LABELS);

export function TestForm({ test }: { test?: Test }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: test?.name ?? "",
    method: test?.method ?? "",
    cas: test?.cas ?? "",
    quantificationLimit: test?.quantificationLimit ?? "",
    isSubcontracted: test?.isSubcontracted ?? false,
    isAccredited: test?.isAccredited ?? false,
    unit: test?.unit ?? "",
    value: test ? Number(test.value) : 0,
    matrix: test?.matrix ?? "EMISSOES_ATMOSFERICAS",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = test ? `/api/tests/${test.id}` : "/api/tests";
    const res = await fetch(url, {
      method: test ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar o ensaio.");
      return;
    }

    if (test) {
      router.refresh();
    } else {
      const { test: created } = await res.json();
      router.push(`/ensaios/${created.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4 max-w-2xl">
      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
      {test && (
        <p className="text-xs text-gray-500">
          Código do parâmetro: <strong>{test.parameterCode}</strong> (gerado automaticamente)
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome do ensaio" required>
          <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </Field>
        <Field label="Matriz" required>
          <select className="input" disabled={!!test} value={form.matrix} onChange={(e) => update("matrix", e.target.value as typeof form.matrix)}>
            {MATRIX_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Método" required>
          <input className="input" value={form.method} onChange={(e) => update("method", e.target.value)} required />
        </Field>
        <Field label="CAS">
          <input className="input" value={form.cas ?? ""} onChange={(e) => update("cas", e.target.value)} />
        </Field>
        <Field label="Limite de quantificação">
          <input className="input" value={form.quantificationLimit ?? ""} onChange={(e) => update("quantificationLimit", e.target.value)} />
        </Field>
        <Field label="Unidade de medida" required>
          <input className="input" value={form.unit} onChange={(e) => update("unit", e.target.value)} required />
        </Field>
        <Field label="Valor do ensaio (R$)" required>
          <input type="number" min={0} step="0.01" className="input" value={form.value} onChange={(e) => update("value", Number(e.target.value))} required />
        </Field>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isSubcontracted} onChange={(e) => update("isSubcontracted", e.target.checked)} />
          Subcontrato
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isAccredited} onChange={(e) => update("isAccredited", e.target.checked)} />
          Acreditado
        </label>
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Salvando..." : test ? "Salvar alterações" : "Cadastrar ensaio"}
      </button>
    </form>
  );
}
