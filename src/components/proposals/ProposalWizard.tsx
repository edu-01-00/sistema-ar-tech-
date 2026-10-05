"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MATRIX_LABELS, formatCurrency } from "@/lib/format";
import { buildPaymentConditionText } from "@/lib/proposal-logic";
import type { WizardClient, WizardCompany } from "./types";

const STEPS = [
  "Dados gerais",
  "Ponto de coleta",
  "Ensaios",
  "Custos",
  "Pagamento",
  "Informações adicionais",
  "Observações importantes",
  "Revisão",
  "Gerar proposta",
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  A_VISTA: "À vista",
  PARCELADO: "Parcelado",
  BOLETO: "Boleto",
  DEPOSITO_PIX: "Depósito / PIX",
};

interface TestRow {
  testId: string;
  collectionPointId: string;
  name: string;
  method: string;
  unit: string;
  code: string;
  checked: boolean;
  quantity: number;
  value: number;
}

interface CostRow {
  description: string;
  value: number;
  type: "ART" | "OUTRO";
}

interface ProposalSummary {
  code: string;
  client: { corporateName: string };
  matrices: { matrix: string }[];
  tests: unknown[];
  testsTotal: number;
  travelTotalValue: number | null;
  otherCostsTotal: number;
  totalValue: number;
  paymentMethod: string | null;
  installments: number | null;
}

export function ProposalWizard({
  clients,
  company,
}: {
  clients: WizardClient[];
  company: WizardCompany | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [proposalId, setProposalId] = useState<string | null>(null);
  const [proposalCode, setProposalCode] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [matrices, setMatrices] = useState<string[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [exhibitUnitValue, setExhibitUnitValue] = useState(true);
  const [useAdditionalCosts, setUseAdditionalCosts] = useState(true);
  const [exhibitTravelValue, setExhibitTravelValue] = useState(true);
  const [collectionPointIds, setCollectionPointIds] = useState<string[]>([]);
  const [testRows, setTestRows] = useState<TestRow[]>([]);
  const [travel, setTravel] = useState({ travelDistanceKm: "", travelValuePerKm: "", travelOtherCosts: "" });
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"A_VISTA" | "PARCELADO" | "BOLETO" | "DEPOSITO_PIX">("A_VISTA");
  const [installments, setInstallments] = useState(2);
  const [paymentDueDays, setPaymentDueDays] = useState(30);
  const [firstInstallmentDueDays, setFirstInstallmentDueDays] = useState<15 | 30>(30);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [observations, setObservations] = useState({
    observationEmissoesAtmosfericas: false,
    observationQualidadeAr: false,
    observationRuido: false,
  });
  const [summary, setSummary] = useState<ProposalSummary | null>(null);

  const selectedClient = clients.find((c) => c.id === clientId);
  const availablePoints = useMemo(
    () => (selectedClient ? selectedClient.collectionPoints.filter((p) => matrices.includes(p.matrix)) : []),
    [selectedClient, matrices],
  );
  const selectedPoints = availablePoints.filter((p) => collectionPointIds.includes(p.id));

  function toggleInArray(arr: string[], setArr: (v: string[]) => void, value: string) {
    setArr(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  }

  async function callApi(url: string, method: string, body?: unknown) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar. Verifique os dados informados.");
        return null;
      }
      return data;
    } finally {
      setSaving(false);
    }
  }

  async function handleStep1Submit() {
    if (!clientId || matrices.length === 0) {
      setError("Selecione o cliente e ao menos uma matriz.");
      return;
    }
    const data = await callApi("/api/proposals", "POST", { clientId, matrices, contactIds, exhibitUnitValue, useAdditionalCosts, exhibitTravelValue });
    if (!data) return;
    setProposalId(data.proposal.id);
    setProposalCode(data.proposal.code);
    setStep(2);
  }

  async function handleStep2Submit() {
    if (collectionPointIds.length === 0) {
      setError("Selecione ao menos um ponto de coleta.");
      return;
    }
    const data = await callApi(`/api/proposals/${proposalId}/collection-points`, "PATCH", { collectionPointIds });
    if (!data) return;
    // inicializa as linhas de ensaio a partir dos pontos selecionados
    const rows: TestRow[] = [];
    for (const point of selectedPoints) {
      for (const test of point.tests) {
        rows.push({
          testId: test.id,
          collectionPointId: point.id,
          name: `${test.name} (${point.name})`,
          method: test.method,
          unit: test.unit,
          code: test.parameterCode,
          checked: false,
          quantity: 1,
          value: test.value,
        });
      }
    }
    setTestRows(rows);
    setStep(3);
  }

  async function handleStep3Submit() {
    const selected = testRows.filter((r) => r.checked);
    if (selected.length === 0) {
      setError("Selecione ao menos um ensaio.");
      return;
    }
    if (selected.some((r) => !Number.isInteger(r.quantity) || r.quantity < 0)) {
      setError("A quantidade de amostras não pode ser negativa.");
      return;
    }
    const payload = { tests: selected.map((r) => ({ testId: r.testId, collectionPointId: r.collectionPointId, quantity: r.quantity, value: r.value })) };
    const data = await callApi(`/api/proposals/${proposalId}/tests`, "PATCH", payload);
    if (!data) return;
    setStep(4);
  }

  async function handleStep4Submit() {
    const payload = {
      travelDistanceKm: travel.travelDistanceKm ? Number(travel.travelDistanceKm) : null,
      travelValuePerKm: travel.travelValuePerKm ? Number(travel.travelValuePerKm) : null,
      travelOtherCosts: travel.travelOtherCosts ? Number(travel.travelOtherCosts) : null,
      costs,
      discountPercent,
    };
    const data = await callApi(`/api/proposals/${proposalId}/costs`, "PATCH", payload);
    if (!data) return;
    setStep(5);
  }

  async function handleStep5Submit() {
    if (paymentMethod === "PARCELADO" && installments < 2) {
      setError("Informe a quantidade de parcelas (mínimo 2).");
      return;
    }
    const data = await callApi(`/api/proposals/${proposalId}/payment`, "PATCH", {
      paymentMethod,
      installments: paymentMethod === "PARCELADO" ? installments : undefined,
      firstInstallmentDueDays: paymentMethod === "PARCELADO" ? firstInstallmentDueDays : undefined,
      paymentDueDays: paymentMethod === "PARCELADO" ? undefined : paymentDueDays,
    });
    if (!data) return;
    setStep(6);
  }

  async function handleStep6Submit() {
    const data = await callApi(`/api/proposals/${proposalId}/additional-info`, "PATCH", { additionalInfo });
    if (!data) return;
    setStep(7);
  }

  async function handleStep7Submit() {
    const data = await callApi(`/api/proposals/${proposalId}/observations`, "PATCH", observations);
    if (!data) return;
    const full = await callApi(`/api/proposals/${proposalId}`, "GET");
    if (!full) return;
    setSummary(full.proposal);
    setStep(8);
  }

  function goToGenerate() {
    setStep(9);
  }

  async function handleSendProposal() {
    const data = await callApi(`/api/proposals/${proposalId}/status`, "PATCH", { status: "ENVIADA" });
    if (!data) return;
    router.push(`/propostas/${proposalId}`);
  }

  return (
    <div>
      <ol className="flex flex-wrap gap-2 mb-6 text-xs">
        {STEPS.map((label, idx) => (
          <li
            key={label}
            className={`px-2.5 py-1 rounded-full border ${
              idx + 1 === step ? "bg-brand-600 text-white border-brand-600" : idx + 1 < step ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-gray-500 border-gray-200"
            }`}
          >
            {idx + 1}. {label}
          </li>
        ))}
      </ol>

      {proposalCode && <p className="text-sm text-gray-500 mb-4">Proposta: <strong>{proposalCode}</strong></p>}
      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-4">{error}</div>}

      {step === 1 && (
        <div className="card p-5 space-y-4 max-w-2xl">
          <div>
            <label className="label">Cliente *</label>
            <select className="input" value={clientId} onChange={(e) => { setClientId(e.target.value); setContactIds([]); }}>
              <option value="">Selecione...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.corporateName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Matriz(es) *</label>
            <div className="flex flex-wrap gap-3">
              {Object.entries(MATRIX_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="checkbox" checked={matrices.includes(value)} onChange={() => toggleInArray(matrices, setMatrices, value)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {selectedClient && (
            <div>
              <label className="label">Solicitantes</label>
              {selectedClient.contacts.length === 0 ? (
                <p className="text-sm text-gray-500">Este cliente não possui contatos cadastrados.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {selectedClient.contacts.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                      <input type="checkbox" checked={contactIds.includes(c.id)} onChange={() => toggleInArray(contactIds, setContactIds, c.id)} />
                      {c.name} {c.role && `(${c.role})`}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <label className="label">Exibir valor unitário no documento?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={exhibitUnitValue} onChange={() => setExhibitUnitValue(true)} /> Sim
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={!exhibitUnitValue} onChange={() => setExhibitUnitValue(false)} /> Não
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-1">Os valores são sempre usados no cálculo do total, mesmo quando ocultos no documento.</p>
            </div>
            <div>
              <label className="label">Demonstrar custo adicional na proposta?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={useAdditionalCosts} onChange={() => setUseAdditionalCosts(true)} /> Sim
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={!useAdditionalCosts} onChange={() => setUseAdditionalCosts(false)} /> Não
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Se &quot;Não&quot;, o custo adicional é distribuído proporcionalmente nos pontos de coleta em vez de aparecer como linha separada. O total
                sempre inclui o custo adicional.
              </p>
            </div>
            <div>
              <label className="label">Exibir valor de deslocamento no documento?</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={exhibitTravelValue} onChange={() => setExhibitTravelValue(true)} /> Sim
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={!exhibitTravelValue} onChange={() => setExhibitTravelValue(false)} /> Não
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-1">O valor de deslocamento é sempre somado ao total, mesmo quando oculto no documento.</p>
            </div>
          </div>

          <button onClick={handleStep1Submit} disabled={saving} className="btn-primary">
            {saving ? "Salvando..." : "Avançar"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card p-5 space-y-4 max-w-2xl">
          {availablePoints.length === 0 ? (
            <p className="text-sm text-gray-500">Este cliente não possui pontos de coleta cadastrados para as matrizes selecionadas.</p>
          ) : (
            <div className="space-y-2">
              {availablePoints.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-md px-3 py-2">
                  <input type="checkbox" checked={collectionPointIds.includes(p.id)} onChange={() => toggleInArray(collectionPointIds, setCollectionPointIds, p.id)} />
                  {p.name} — {MATRIX_LABELS[p.matrix]}
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="btn-secondary">Voltar</button>
            <button onClick={handleStep2Submit} disabled={saving} className="btn-primary">
              {saving ? "Salvando..." : "Avançar"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-5 space-y-4">
          {testRows.length === 0 ? (
            <p className="text-sm text-gray-500">Os pontos selecionados não possuem ensaios vinculados.</p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th></th>
                  <th>Ensaio</th>
                  <th>Método</th>
                  <th>Unidade</th>
                  <th>Código</th>
                  <th>Qtd. amostras</th>
                  <th>Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {testRows.map((row, idx) => (
                  <tr key={`${row.testId}-${row.collectionPointId}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.checked}
                        onChange={() => setTestRows((rows) => rows.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r)))}
                      />
                    </td>
                    <td>{row.name}</td>
                    <td>{row.method}</td>
                    <td>{row.unit}</td>
                    <td className="font-mono text-xs">{row.code}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="input w-24"
                        value={row.quantity}
                        onChange={(e) => {
                          const q = Math.max(0, Math.floor(Number(e.target.value) || 0));
                          setTestRows((rows) => rows.map((r, i) => (i === idx ? { ...r, quantity: q } : r)));
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
                          setTestRows((rows) => rows.map((r, i) => (i === idx ? { ...r, value: v } : r)));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="btn-secondary">Voltar</button>
            <button onClick={handleStep3Submit} disabled={saving} className="btn-primary">
              {saving ? "Salvando..." : "Avançar"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card p-5 space-y-5 max-w-2xl">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Deslocamento</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Distância (km)</label>
                <input type="number" min={0} step="0.01" className="input" value={travel.travelDistanceKm} onChange={(e) => setTravel((t) => ({ ...t, travelDistanceKm: e.target.value }))} />
              </div>
              <div>
                <label className="label">Valor/km (R$)</label>
                <input type="number" min={0} step="0.01" className="input" value={travel.travelValuePerKm} onChange={(e) => setTravel((t) => ({ ...t, travelValuePerKm: e.target.value }))} />
              </div>
              <div>
                <label className="label">Outros custos de deslocamento (R$)</label>
                <input type="number" min={0} step="0.01" className="input" value={travel.travelOtherCosts} onChange={(e) => setTravel((t) => ({ ...t, travelOtherCosts: e.target.value }))} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Outros custos (ex: ART)</h3>
              <button className="btn-secondary text-xs" onClick={() => setCosts((c) => [...c, { description: "", value: 0, type: "OUTRO" }])}>
                Adicionar custo
              </button>
            </div>
            {costs.map((c, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input className="input flex-1" placeholder="Descrição (ex: ART)" value={c.description} onChange={(e) => setCosts((rows) => rows.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))} />
                <input type="number" min={0} step="0.01" className="input w-32" value={c.value} onChange={(e) => setCosts((rows) => rows.map((r, i) => (i === idx ? { ...r, value: Number(e.target.value) || 0 } : r)))} />
                <button className="btn-danger text-xs" onClick={() => setCosts((rows) => rows.filter((_, i) => i !== idx))}>Remover</button>
              </div>
            ))}
          </div>

          <div>
            <label className="label">Desconto</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                className="input w-24"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              />
              <span className="text-sm text-gray-600">%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Aplicado sobre o valor total da proposta (ensaios + custos adicionais + deslocamento).</p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(3)} className="btn-secondary">Voltar</button>
            <button onClick={handleStep4Submit} disabled={saving} className="btn-primary">
              {saving ? "Salvando..." : "Avançar"}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="card p-5 space-y-4 max-w-md">
          <div>
            <label className="label">Forma de pagamento</label>
            <div className="flex flex-col gap-2">
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={paymentMethod === value}
                    onChange={() => setPaymentMethod(value as typeof paymentMethod)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {paymentMethod === "PARCELADO" ? (
            <>
              <div>
                <label className="label">Quantidade de parcelas</label>
                <input type="number" min={2} max={60} className="input w-32" value={installments} onChange={(e) => setInstallments(Number(e.target.value) || 2)} />
              </div>
              <div>
                <label className="label">Vencimento da 1ª parcela</label>
                <select
                  className="input w-32"
                  value={firstInstallmentDueDays}
                  onChange={(e) => setFirstInstallmentDueDays(Number(e.target.value) === 15 ? 15 : 30)}
                >
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">As demais parcelas vencem a cada 30 dias a partir da 1ª.</p>
              </div>
            </>
          ) : (
            <div>
              <label className="label">Dias para vencimento</label>
              <input type="number" min={1} max={365} className="input w-32" value={paymentDueDays} onChange={(e) => setPaymentDueDays(Number(e.target.value) || 1)} />
            </div>
          )}

          {(() => {
            const previewText = buildPaymentConditionText({ paymentMethod, paymentDueDays, installments, firstInstallmentDueDays });
            return previewText ? <p className="text-xs text-gray-500 italic">&quot;{previewText}&quot;</p> : null;
          })()}

          {paymentMethod === "DEPOSITO_PIX" && (
            <div className="rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-800 px-3 py-2">
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

          <div className="flex gap-2">
            <button onClick={() => setStep(4)} className="btn-secondary">Voltar</button>
            <button onClick={handleStep5Submit} disabled={saving} className="btn-primary">
              {saving ? "Salvando..." : "Avançar"}
            </button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="card p-5 space-y-4 max-w-2xl">
          <label className="label">Informações adicionais</label>
          <textarea className="input" rows={5} value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} placeholder="Texto livre para observações específicas desta proposta." />
          <div className="flex gap-2">
            <button onClick={() => setStep(5)} className="btn-secondary">Voltar</button>
            <button onClick={handleStep6Submit} disabled={saving} className="btn-primary">
              {saving ? "Salvando..." : "Avançar"}
            </button>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="card p-5 space-y-4 max-w-2xl">
          <p className="text-sm text-gray-600">Selecione quais blocos de observações importantes devem aparecer no documento (nenhum, um, dois ou os três).</p>
          <label className="flex items-center gap-2 text-sm border border-gray-200 rounded-md px-3 py-2">
            <input
              type="checkbox"
              checked={observations.observationEmissoesAtmosfericas}
              onChange={(e) => setObservations((o) => ({ ...o, observationEmissoesAtmosfericas: e.target.checked }))}
            />
            Emissões Atmosféricas em Duto ou Chaminé
          </label>
          <label className="flex items-center gap-2 text-sm border border-gray-200 rounded-md px-3 py-2">
            <input
              type="checkbox"
              checked={observations.observationQualidadeAr}
              onChange={(e) => setObservations((o) => ({ ...o, observationQualidadeAr: e.target.checked }))}
            />
            Monitoramento da Qualidade do Ar
          </label>
          <label className="flex items-center gap-2 text-sm border border-gray-200 rounded-md px-3 py-2">
            <input
              type="checkbox"
              checked={observations.observationRuido}
              onChange={(e) => setObservations((o) => ({ ...o, observationRuido: e.target.checked }))}
            />
            Avaliação de Pressão Sonora (Ruído)
          </label>
          <div className="flex gap-2">
            <button onClick={() => setStep(6)} className="btn-secondary">Voltar</button>
            <button onClick={handleStep7Submit} disabled={saving} className="btn-primary">
              {saving ? "Salvando..." : "Avançar"}
            </button>
          </div>
        </div>
      )}

      {step === 8 && summary && (
        <div className="card p-5 space-y-4 max-w-3xl">
          <h3 className="text-sm font-semibold text-gray-800">Resumo da proposta {summary.code}</h3>
          <p className="text-sm">Cliente: <strong>{summary.client.corporateName}</strong></p>
          <p className="text-sm">Matrizes: {summary.matrices.map((m) => MATRIX_LABELS[m.matrix]).join(", ")}</p>
          <p className="text-sm">Ensaios: {summary.tests.length} selecionado(s)</p>
          <p className="text-sm">Total de ensaios: {formatCurrency(Number(summary.testsTotal))}</p>
          <p className="text-sm">Deslocamento: {formatCurrency(Number(summary.travelTotalValue ?? 0))}</p>
          <p className="text-sm">Outros custos: {formatCurrency(Number(summary.otherCostsTotal))}</p>
          <p className="text-sm font-semibold">Valor total: {formatCurrency(Number(summary.totalValue))}</p>
          <p className="text-sm">Pagamento: {summary.paymentMethod ? PAYMENT_METHOD_LABELS[summary.paymentMethod] : "Não definido"}{summary.paymentMethod === "PARCELADO" ? ` em ${summary.installments}x` : ""}</p>
          <div className="flex gap-2">
            <button onClick={() => setStep(7)} className="btn-secondary">Voltar</button>
            <button onClick={goToGenerate} className="btn-primary">Avançar</button>
          </div>
        </div>
      )}

      {step === 9 && (
        <div className="card p-5 space-y-4 max-w-2xl">
          <p className="text-sm text-gray-600">A proposta {proposalCode} foi salva com sucesso. Gere o documento para conferência e envio ao cliente.</p>
          <p className="text-xs text-gray-500">A análise crítica pode ser confirmada na página da proposta antes do envio.</p>
          <div className="flex gap-2">
            <a href={`/api/proposals/${proposalId}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary">
              Gerar / visualizar documento (PDF)
            </a>
            <button onClick={handleSendProposal} disabled={saving} className="btn-primary">
              {saving ? "Enviando..." : "Marcar como enviada"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
