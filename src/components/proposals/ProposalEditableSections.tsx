"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MATRIX_LABELS } from "@/lib/format";
import type { WizardCollectionPoint } from "./types";

interface TestRow {
  testId: string;
  collectionPointId: string;
  name: string;
  method: string;
  unit: string;
  code: string;
  quantity: number;
  value: number;
}

async function saveSection(url: string, body: unknown, router: ReturnType<typeof useRouter>, setError: (e: string | null) => void, setSaving: (v: boolean) => void) {
  setSaving(true);
  setError(null);
  try {
    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar as alterações.");
      return false;
    }
    router.refresh();
    return true;
  } finally {
    setSaving(false);
  }
}

export function CollectionPointsSection({
  proposalId,
  clientPoints,
  matrices,
  initialSelected,
}: {
  proposalId: string;
  clientPoints: WizardCollectionPoint[];
  matrices: string[];
  initialSelected: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = clientPoints.filter((p) => matrices.includes(p.matrix));

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Pontos de coleta</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-2 mb-3">
        {available.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-md px-3 py-2">
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
            />
            {p.name} — {MATRIX_LABELS[p.matrix]}
          </label>
        ))}
      </div>
      <button
        className="btn-primary text-xs"
        disabled={saving}
        onClick={() => saveSection(`/api/proposals/${proposalId}/collection-points`, { collectionPointIds: selected }, router, setError, setSaving)}
      >
        {saving ? "Salvando..." : "Salvar pontos de coleta"}
      </button>
    </div>
  );
}

export function TestsSection({
  proposalId,
  clientPoints,
  selectedPointIds,
  initialTests,
}: {
  proposalId: string;
  clientPoints: WizardCollectionPoint[];
  selectedPointIds: string[];
  initialTests: { testId: string; collectionPointId: string; nameSnapshot: string; methodSnapshot: string; unitSnapshot: string; codeSnapshot: string; quantity: number; valueSnapshot: number }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows: TestRow[] = [];
  for (const point of clientPoints.filter((p) => selectedPointIds.includes(p.id))) {
    for (const test of point.tests) {
      const existing = initialTests.find((t) => t.testId === test.id && t.collectionPointId === point.id);
      rows.push({
        testId: test.id,
        collectionPointId: point.id,
        name: `${test.name} (${point.name})`,
        method: test.method,
        unit: test.unit,
        code: test.parameterCode,
        quantity: existing?.quantity ?? 0,
        value: existing ? Number(existing.valueSnapshot) : test.value,
      });
    }
  }
  const [testRows, setTestRows] = useState<TestRow[]>(rows);

  return (
    <div className="card p-5 overflow-x-auto">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Ensaios</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {testRows.length === 0 ? (
        <p className="text-sm text-gray-500">Selecione ao menos um ponto de coleta para listar os ensaios disponíveis.</p>
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>Ensaio</th>
              <th>Qtd. amostras</th>
              <th>Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            {testRows.map((row, idx) => (
              <tr key={`${row.testId}-${row.collectionPointId}`}>
                <td>{row.name}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="input w-24"
                    value={row.quantity}
                    onChange={(e) => {
                      const q = Math.max(0, Math.floor(Number(e.target.value) || 0));
                      setTestRows((r) => r.map((x, i) => (i === idx ? { ...x, quantity: q } : x)));
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input w-28"
                    value={row.value}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      setTestRows((r) => r.map((x, i) => (i === idx ? { ...x, value: v } : x)));
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        className="btn-primary text-xs mt-3"
        disabled={saving || testRows.length === 0}
        onClick={() =>
          saveSection(
            `/api/proposals/${proposalId}/tests`,
            { tests: testRows.filter((r) => r.quantity > 0).map((r) => ({ testId: r.testId, collectionPointId: r.collectionPointId, quantity: r.quantity, value: r.value })) },
            router,
            setError,
            setSaving,
          )
        }
      >
        {saving ? "Salvando..." : "Salvar ensaios"}
      </button>
    </div>
  );
}

export function CostsSection({
  proposalId,
  initialTravel,
  initialCosts,
}: {
  proposalId: string;
  initialTravel: { travelDistanceKm: number | null; travelValuePerKm: number | null; travelOtherCosts: number | null };
  initialCosts: { description: string; value: number; type: "ART" | "OUTRO" }[];
}) {
  const router = useRouter();
  const [travel, setTravel] = useState({
    travelDistanceKm: initialTravel.travelDistanceKm?.toString() ?? "",
    travelValuePerKm: initialTravel.travelValuePerKm?.toString() ?? "",
    travelOtherCosts: initialTravel.travelOtherCosts?.toString() ?? "",
  });
  const [costs, setCosts] = useState(initialCosts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Custos</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="label">Distância (km)</label>
          <input type="number" min={0} step="0.01" className="input" value={travel.travelDistanceKm} onChange={(e) => setTravel((t) => ({ ...t, travelDistanceKm: e.target.value }))} />
        </div>
        <div>
          <label className="label">Valor/km (R$)</label>
          <input type="number" min={0} step="0.01" className="input" value={travel.travelValuePerKm} onChange={(e) => setTravel((t) => ({ ...t, travelValuePerKm: e.target.value }))} />
        </div>
        <div>
          <label className="label">Outros custos deslocamento</label>
          <input type="number" min={0} step="0.01" className="input" value={travel.travelOtherCosts} onChange={(e) => setTravel((t) => ({ ...t, travelOtherCosts: e.target.value }))} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-600">Outros custos (ex: ART)</p>
        <button className="btn-secondary text-xs" onClick={() => setCosts((c) => [...c, { description: "", value: 0, type: "OUTRO" }])}>
          Adicionar
        </button>
      </div>
      {costs.map((c, idx) => (
        <div key={idx} className="flex gap-2 mb-2">
          <input className="input flex-1" value={c.description} onChange={(e) => setCosts((rows) => rows.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))} />
          <input type="number" min={0} step="0.01" className="input w-32" value={c.value} onChange={(e) => setCosts((rows) => rows.map((r, i) => (i === idx ? { ...r, value: Number(e.target.value) || 0 } : r)))} />
          <button className="btn-danger text-xs" onClick={() => setCosts((rows) => rows.filter((_, i) => i !== idx))}>Remover</button>
        </div>
      ))}

      <button
        className="btn-primary text-xs mt-2"
        disabled={saving}
        onClick={() =>
          saveSection(
            `/api/proposals/${proposalId}/costs`,
            {
              travelDistanceKm: travel.travelDistanceKm ? Number(travel.travelDistanceKm) : null,
              travelValuePerKm: travel.travelValuePerKm ? Number(travel.travelValuePerKm) : null,
              travelOtherCosts: travel.travelOtherCosts ? Number(travel.travelOtherCosts) : null,
              costs,
            },
            router,
            setError,
            setSaving,
          )
        }
      >
        {saving ? "Salvando..." : "Salvar custos"}
      </button>
    </div>
  );
}

export function PaymentSection({ proposalId, initialPaymentMethod, initialInstallments }: { proposalId: string; initialPaymentMethod: string | null; initialInstallments: number | null }) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod ?? "A_VISTA");
  const [installments, setInstallments] = useState(initialInstallments ?? 2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card p-5 max-w-md">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Forma de pagamento</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex gap-4 mb-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={paymentMethod === "A_VISTA"} onChange={() => setPaymentMethod("A_VISTA")} /> À vista
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={paymentMethod === "PARCELADO"} onChange={() => setPaymentMethod("PARCELADO")} /> Parcelado
        </label>
      </div>
      {paymentMethod === "PARCELADO" && (
        <div className="mb-3">
          <label className="label">Quantidade de parcelas</label>
          <input type="number" min={2} max={60} className="input w-32" value={installments} onChange={(e) => setInstallments(Number(e.target.value) || 2)} />
        </div>
      )}
      <button
        className="btn-primary text-xs"
        disabled={saving}
        onClick={() =>
          saveSection(`/api/proposals/${proposalId}/payment`, { paymentMethod, installments: paymentMethod === "PARCELADO" ? installments : undefined }, router, setError, setSaving)
        }
      >
        {saving ? "Salvando..." : "Salvar pagamento"}
      </button>
    </div>
  );
}

export function TextsSection({ proposalId, matrices, initialTexts }: { proposalId: string; matrices: string[]; initialTexts: Record<string, string> }) {
  const router = useRouter();
  const [texts, setTexts] = useState(initialTexts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Textos técnicos</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {matrices.map((m) => (
        <div key={m} className="mb-3">
          <label className="label">{MATRIX_LABELS[m]}</label>
          <textarea className="input" rows={3} value={texts[m] ?? ""} onChange={(e) => setTexts((t) => ({ ...t, [m]: e.target.value }))} />
        </div>
      ))}
      <button
        className="btn-primary text-xs"
        disabled={saving}
        onClick={() => saveSection(`/api/proposals/${proposalId}/texts`, { texts: matrices.map((m) => ({ matrix: m, content: texts[m] ?? "" })) }, router, setError, setSaving)}
      >
        {saving ? "Salvando..." : "Salvar textos"}
      </button>
    </div>
  );
}

export function AdditionalInfoSection({ proposalId, initialValue }: { proposalId: string; initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Informações adicionais</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <textarea className="input mb-3" rows={4} value={value} onChange={(e) => setValue(e.target.value)} />
      <button
        className="btn-primary text-xs"
        disabled={saving}
        onClick={() => saveSection(`/api/proposals/${proposalId}/additional-info`, { additionalInfo: value }, router, setError, setSaving)}
      >
        {saving ? "Salvando..." : "Salvar informações adicionais"}
      </button>
    </div>
  );
}
