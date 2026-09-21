"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { UnitSelect } from "@/components/ui/UnitSelect";
import { MATRIX_LABELS } from "@/lib/format";
import type { Legislation, MeasurementUnit, Test } from "@prisma/client";

interface LegislationWithTests extends Legislation {
  legislationTests: { test: Test }[];
}

export function LegislationForm({
  legislation,
  availableTests,
  measurementUnits,
  canManageUnits,
}: {
  legislation?: LegislationWithTests;
  availableTests: Test[];
  measurementUnits: MeasurementUnit[];
  canManageUnits: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: legislation?.name ?? "",
    description: legislation?.description ?? "",
    item: legislation?.item ?? "",
    frameworkProcess: legislation?.frameworkProcess ?? "",
    allowedLimit: legislation?.allowedLimit ?? "",
    unit: legislation?.unit ?? "",
    corrections: legislation?.corrections ?? "",
  });
  const [testIds, setTestIds] = useState<string[]>(legislation?.legislationTests.map((lt) => lt.test.id) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleTest(id: string) {
    setTestIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const testsByMatrix = availableTests.reduce<Record<string, Test[]>>((acc, t) => {
    (acc[t.matrix] ??= []).push(t);
    return acc;
  }, {});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = legislation ? `/api/legislations/${legislation.id}` : "/api/legislations";
    const res = await fetch(url, {
      method: legislation ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, testIds }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar a legislação.");
      return;
    }

    if (legislation) {
      router.refresh();
    } else {
      const { legislation: created } = await res.json();
      router.push(`/legislacao/${created.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nome da legislação" required>
            <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </Field>
          <Field label="Item da legislação">
            <input className="input" value={form.item ?? ""} onChange={(e) => update("item", e.target.value)} />
          </Field>
          <Field label="Processo de enquadramento">
            <input className="input" value={form.frameworkProcess ?? ""} onChange={(e) => update("frameworkProcess", e.target.value)} />
          </Field>
          <Field label="Limite permitido">
            <input className="input" value={form.allowedLimit ?? ""} onChange={(e) => update("allowedLimit", e.target.value)} />
          </Field>
          <Field label="Unidade">
            <UnitSelect value={form.unit ?? ""} onChange={(v) => update("unit", v)} units={measurementUnits} canManageUnits={canManageUnits} />
          </Field>
          <Field label="Correções">
            <input className="input" value={form.corrections ?? ""} onChange={(e) => update("corrections", e.target.value)} />
          </Field>
        </div>
        <Field label="Descrição">
          <textarea className="input" rows={3} value={form.description ?? ""} onChange={(e) => update("description", e.target.value)} />
        </Field>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Ensaios vinculados</h2>
        {Object.entries(testsByMatrix).map(([matrix, tests]) => (
          <div key={matrix} className="mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-1">{MATRIX_LABELS[matrix]}</p>
            <div className="flex flex-wrap gap-3">
              {tests.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="checkbox" checked={testIds.includes(t.id)} onChange={() => toggleTest(t.id)} />
                  {t.name} ({t.parameterCode})
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Salvando..." : legislation ? "Salvar alterações" : "Cadastrar legislação"}
      </button>
    </form>
  );
}
