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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  A_VISTA: "À vista",
  PARCELADO: "Parcelado",
  BOLETO: "Boleto",
  DEPOSITO_PIX: "Depósito / PIX",
};

interface CompanyBankData {
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  bankAccountType: string | null;
  bankPixKey: string | null;
}

export function PaymentSection({
  proposalId,
  initialPaymentMethod,
  initialInstallments,
  initialPaymentTerm,
  company,
}: {
  proposalId: string;
  initialPaymentMethod: string | null;
  initialInstallments: number | null;
  initialPaymentTerm: string | null;
  company: CompanyBankData | null;
}) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod ?? "A_VISTA");
  const [installments, setInstallments] = useState(initialInstallments ?? 2);
  const [paymentTerm, setPaymentTerm] = useState(initialPaymentTerm ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card p-5 max-w-md">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Forma de pagamento</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex flex-col gap-2 mb-3">
        {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={paymentMethod === value}
              onChange={() => {
                setPaymentMethod(value);
                setPaymentTerm("");
              }}
            />
            {label}
          </label>
        ))}
      </div>
      {paymentMethod === "PARCELADO" && (
        <div className="mb-3">
          <label className="label">Quantidade de parcelas</label>
          <input type="number" min={2} max={60} className="input w-32" value={installments} onChange={(e) => setInstallments(Number(e.target.value) || 2)} />
        </div>
      )}
      <div className="mb-3">
        <label className="label">Prazo de vencimento</label>
        <select className="input" value={paymentTerm} onChange={(e) => setPaymentTerm(e.target.value)}>
          <option value="">Não informado</option>
          {paymentMethod === "PARCELADO" ? (
            <option value="DIAS_30_60_90">30/60/90 dias</option>
          ) : (
            <>
              <option value="DIAS_15">15 dias</option>
              <option value="DIAS_30">30 dias</option>
              <option value="DIAS_15_30">15/30 dias (dividido)</option>
            </>
          )}
        </select>
      </div>
      {paymentMethod === "DEPOSITO_PIX" && (
        <div className="rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-800 px-3 py-2 mb-3">
          <p className="font-medium mb-1">Dados bancários da empresa (preenchidos automaticamente no documento):</p>
          {company?.bankName || company?.bankPixKey ? (
            <ul className="space-y-0.5">
              {company.bankName && <li>Banco: {company.bankName}</li>}
              {company.bankAgency && <li>Agência: {company.bankAgency}</li>}
              {company.bankAccount && <li>Conta: {company.bankAccount} {company.bankAccountType ? `(${company.bankAccountType})` : ""}</li>}
              {company.bankPixKey && <li>Chave PIX: {company.bankPixKey}</li>}
            </ul>
          ) : (
            <p>Nenhum dado bancário cadastrado. Cadastre em Empresa &gt; Dados bancários.</p>
          )}
        </div>
      )}
      <button
        className="btn-primary text-xs"
        disabled={saving}
        onClick={() =>
          saveSection(
            `/api/proposals/${proposalId}/payment`,
            { paymentMethod, installments: paymentMethod === "PARCELADO" ? installments : undefined, paymentTerm: paymentTerm || undefined },
            router,
            setError,
            setSaving,
          )
        }
      >
        {saving ? "Salvando..." : "Salvar pagamento"}
      </button>
    </div>
  );
}

export function DisplayOptionsSection({
  proposalId,
  initialExhibitUnitValue,
  initialUseAdditionalCosts,
}: {
  proposalId: string;
  initialExhibitUnitValue: boolean;
  initialUseAdditionalCosts: boolean;
}) {
  const router = useRouter();
  const [exhibitUnitValue, setExhibitUnitValue] = useState(initialExhibitUnitValue);
  const [useAdditionalCosts, setUseAdditionalCosts] = useState(initialUseAdditionalCosts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card p-5 max-w-md">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Opções de exibição</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="mb-3">
        <label className="label">Exibir valor unitário no documento?</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={exhibitUnitValue} onChange={() => setExhibitUnitValue(true)} /> Sim
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={!exhibitUnitValue} onChange={() => setExhibitUnitValue(false)} /> Não
          </label>
        </div>
      </div>
      <div className="mb-3">
        <label className="label">Utilizar custos adicionais?</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={useAdditionalCosts} onChange={() => setUseAdditionalCosts(true)} /> Sim
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={!useAdditionalCosts} onChange={() => setUseAdditionalCosts(false)} /> Não
          </label>
        </div>
      </div>
      <button
        className="btn-primary text-xs"
        disabled={saving}
        onClick={() => saveSection(`/api/proposals/${proposalId}/display-options`, { exhibitUnitValue, useAdditionalCosts }, router, setError, setSaving)}
      >
        {saving ? "Salvando..." : "Salvar opções"}
      </button>
    </div>
  );
}

export function ObservationsSection({
  proposalId,
  initialObservations,
}: {
  proposalId: string;
  initialObservations: { observationEmissoesAtmosfericas: boolean; observationQualidadeAr: boolean; observationRuido: boolean };
}) {
  const router = useRouter();
  const [observations, setObservations] = useState(initialObservations);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card p-5 max-w-md">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Observações importantes</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <label className="flex items-center gap-2 text-sm mb-2">
        <input
          type="checkbox"
          checked={observations.observationEmissoesAtmosfericas}
          onChange={(e) => setObservations((o) => ({ ...o, observationEmissoesAtmosfericas: e.target.checked }))}
        />
        Emissões Atmosféricas em Duto ou Chaminé
      </label>
      <label className="flex items-center gap-2 text-sm mb-2">
        <input
          type="checkbox"
          checked={observations.observationQualidadeAr}
          onChange={(e) => setObservations((o) => ({ ...o, observationQualidadeAr: e.target.checked }))}
        />
        Monitoramento da Qualidade do Ar
      </label>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input
          type="checkbox"
          checked={observations.observationRuido}
          onChange={(e) => setObservations((o) => ({ ...o, observationRuido: e.target.checked }))}
        />
        Avaliação de Pressão Sonora (Ruído)
      </label>
      <button
        className="btn-primary text-xs"
        disabled={saving}
        onClick={() => saveSection(`/api/proposals/${proposalId}/observations`, observations, router, setError, setSaving)}
      >
        {saving ? "Salvando..." : "Salvar observações"}
      </button>
    </div>
  );
}

export function CriticalAnalysisSection({
  proposalId,
  initialConfirmed,
  confirmedByName,
  confirmedAt,
}: {
  proposalId: string;
  initialConfirmed: boolean;
  confirmedByName: string | null;
  confirmedAt: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card p-5 max-w-xl">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Análise crítica / Confirmação</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <p className="text-xs text-gray-600 mb-3">
        Ao confirmar, você declara ter verificado: os requisitos do cliente, a capacidade do laboratório, os métodos
        selecionados e a qualificação de eventuais serviços providos externamente (item 6.6 da ISO/IEC 17025:2017).
      </p>
      {initialConfirmed ? (
        <p className="text-sm text-green-700 mb-3">
          Confirmada por <strong>{confirmedByName}</strong>{confirmedAt ? ` em ${new Date(confirmedAt).toLocaleString("pt-BR")}` : ""}.
        </p>
      ) : (
        <p className="text-sm text-gray-500 mb-3">Ainda não confirmada.</p>
      )}
      <button
        className={initialConfirmed ? "btn-secondary text-xs" : "btn-primary text-xs"}
        disabled={saving}
        onClick={() =>
          saveSection(`/api/proposals/${proposalId}/critical-analysis`, { criticalAnalysisConfirmed: !initialConfirmed }, router, setError, setSaving)
        }
      >
        {saving ? "Salvando..." : initialConfirmed ? "Desfazer confirmação" : "Confirmar análise crítica"}
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
