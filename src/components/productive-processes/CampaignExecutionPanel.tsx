"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime, PRODUCTIVE_PROCESS_STATUS_LABELS, PRODUCTIVE_PROCESS_STATUS_COLORS, ACCEPTANCE_STATUS_LABELS } from "@/lib/format";
import type { ProductiveProcessStatusValue } from "@/lib/productive-process-logic";

// Aceita number/string ou Prisma.Decimal (que só expõe toString) — os
// campos numéricos destas telas sempre terminam convertidos via .toString().
type DecimalLike = number | string | { toString(): string };

interface UserOption {
  id: string;
  name: string;
}

interface EquipmentOption {
  id: string;
  name: string;
  calibrationValidUntil: string | Date | null;
}

interface SamplingPlanInfo {
  scheduledAt: string | Date;
  fieldResponsible: UserOption;
  notes: string | null;
  equipmentChecks: { id: string; equipment: EquipmentOption; calibrationValidUntilSnapshot: string | Date | null }[];
}

interface CustodyEntryInfo {
  arrivedAt: string | Date;
  receivedBy: UserOption;
  weatherConditions: string | null;
  temperatureC: DecimalLike | null;
  humidityPercent: DecimalLike | null;
}

interface SampleAcceptanceInfo {
  status: "ACEITA" | "ACEITA_COM_RESSALVAS" | "REJEITADA";
  filtersIntegrityOk: boolean;
  sealsIntegrityOk: boolean;
  absorbentSolutionOk: boolean;
  deviationNotes: string | null;
  acceptedBy: UserOption;
  acceptedAt: string | Date;
}

interface ResultWorksheetInfo {
  analyzedBy: UserOption | null;
  analyzedAt: string | Date | null;
  validatedBy: UserOption | null;
  validatedAt: string | Date | null;
  gravimetry: {
    filterWeightBefore: DecimalLike | null;
    filterWeightAfter: DecimalLike | null;
    fieldBlankWeight: DecimalLike | null;
    labReadingValue: DecimalLike | null;
    sampledVolumeM3: DecimalLike | null;
  } | null;
  acoustic: {
    leqDba: DecimalLike | null;
    l10Dba: DecimalLike | null;
    l90Dba: DecimalLike | null;
    backgroundNoiseDba: DecimalLike | null;
    measurementMinutes: number | null;
  } | null;
}

function toDateTimeLocal(value: string | Date | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampaignExecutionPanel({
  productiveProcessId,
  status,
  matrix,
  users,
  equipmentCatalog,
  samplingPlan,
  custodyEntry,
  sampleAcceptance,
  resultWorksheet,
}: {
  productiveProcessId: string;
  status: ProductiveProcessStatusValue;
  matrix: string;
  users: UserOption[];
  equipmentCatalog: EquipmentOption[];
  samplingPlan: SamplingPlanInfo | null;
  custodyEntry: CustodyEntryInfo | null;
  sampleAcceptance: SampleAcceptanceInfo | null;
  resultWorksheet: ResultWorksheetInfo | null;
}) {
  const router = useRouter();
  const isAcoustic = matrix === "RUIDO_AMBIENTAL";
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Fase 1 — Plano de Amostragem
  const [scheduledAt, setScheduledAt] = useState(toDateTimeLocal(samplingPlan?.scheduledAt ?? null));
  const [fieldResponsibleId, setFieldResponsibleId] = useState(samplingPlan?.fieldResponsible.id ?? users[0]?.id ?? "");
  const [notes, setNotes] = useState(samplingPlan?.notes ?? "");
  const [equipmentIds, setEquipmentIds] = useState<string[]>(samplingPlan?.equipmentChecks.map((c) => c.equipment.id) ?? []);

  // Fase 2 — Entrada e Custódia
  const [arrivedAt, setArrivedAt] = useState(toDateTimeLocal(custodyEntry?.arrivedAt ?? null));
  const [weatherConditions, setWeatherConditions] = useState(custodyEntry?.weatherConditions ?? "");
  const [temperatureC, setTemperatureC] = useState(custodyEntry?.temperatureC?.toString() ?? "");
  const [humidityPercent, setHumidityPercent] = useState(custodyEntry?.humidityPercent?.toString() ?? "");

  // Fase 3 — Checagem e Aceitação
  const [acceptanceStatus, setAcceptanceStatus] = useState<"ACEITA" | "ACEITA_COM_RESSALVAS" | "REJEITADA">("ACEITA");
  const [filtersIntegrityOk, setFiltersIntegrityOk] = useState(true);
  const [sealsIntegrityOk, setSealsIntegrityOk] = useState(true);
  const [absorbentSolutionOk, setAbsorbentSolutionOk] = useState(true);
  const [deviationNotes, setDeviationNotes] = useState("");

  // Fase 4 — Resultados
  const g = resultWorksheet?.gravimetry;
  const a = resultWorksheet?.acoustic;
  const [filterWeightBefore, setFilterWeightBefore] = useState(g?.filterWeightBefore?.toString() ?? "");
  const [filterWeightAfter, setFilterWeightAfter] = useState(g?.filterWeightAfter?.toString() ?? "");
  const [fieldBlankWeight, setFieldBlankWeight] = useState(g?.fieldBlankWeight?.toString() ?? "");
  const [labReadingValue, setLabReadingValue] = useState(g?.labReadingValue?.toString() ?? "");
  const [sampledVolumeM3, setSampledVolumeM3] = useState(g?.sampledVolumeM3?.toString() ?? "");
  const [leqDba, setLeqDba] = useState(a?.leqDba?.toString() ?? "");
  const [l10Dba, setL10Dba] = useState(a?.l10Dba?.toString() ?? "");
  const [l90Dba, setL90Dba] = useState(a?.l90Dba?.toString() ?? "");
  const [backgroundNoiseDba, setBackgroundNoiseDba] = useState(a?.backgroundNoiseDba?.toString() ?? "");
  const [measurementMinutes, setMeasurementMinutes] = useState(a?.measurementMinutes?.toString() ?? "");

  async function callApi(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Não foi possível salvar.");
      return null;
    }
    return data;
  }

  async function handleSaveSamplingPlan() {
    if (!scheduledAt || !fieldResponsibleId) {
      setError("Informe a data/hora agendada e o responsável técnico.");
      return;
    }
    setSaving("plan");
    setError(null);
    const ok = await callApi(`/api/productive-processes/${productiveProcessId}/sampling-plan`, {
      scheduledAt,
      fieldResponsibleId,
      notes: notes.trim() || null,
      equipmentIds,
    });
    setSaving(null);
    if (ok) router.refresh();
  }

  async function handleMarkFieldworkDone() {
    setSaving("fieldwork");
    setError(null);
    const ok = await callApi(`/api/productive-processes/${productiveProcessId}/status`, { status: "EM_CAMPO" });
    setSaving(null);
    if (ok) router.refresh();
  }

  async function handleSaveCustody() {
    if (!arrivedAt) {
      setError("Informe a data/hora de chegada.");
      return;
    }
    setSaving("custody");
    setError(null);
    const ok = await callApi(`/api/productive-processes/${productiveProcessId}/custody`, {
      arrivedAt,
      weatherConditions: weatherConditions.trim() || null,
      temperatureC: temperatureC ? Number(temperatureC) : null,
      humidityPercent: humidityPercent ? Number(humidityPercent) : null,
    });
    setSaving(null);
    if (ok) router.refresh();
  }

  async function handleSaveAcceptance() {
    if (acceptanceStatus !== "ACEITA" && !deviationNotes.trim()) {
      setError("Informe o motivo da ressalva/rejeição.");
      return;
    }
    setSaving("acceptance");
    setError(null);
    const ok = await callApi(`/api/productive-processes/${productiveProcessId}/acceptance`, {
      status: acceptanceStatus,
      filtersIntegrityOk,
      sealsIntegrityOk,
      absorbentSolutionOk,
      deviationNotes: deviationNotes.trim() || null,
    });
    setSaving(null);
    if (ok) router.refresh();
  }

  async function handleSaveResults() {
    setSaving("results");
    setError(null);
    const payload = isAcoustic
      ? {
          acoustic: {
            leqDba: leqDba ? Number(leqDba) : null,
            l10Dba: l10Dba ? Number(l10Dba) : null,
            l90Dba: l90Dba ? Number(l90Dba) : null,
            backgroundNoiseDba: backgroundNoiseDba ? Number(backgroundNoiseDba) : null,
            measurementMinutes: measurementMinutes ? Number(measurementMinutes) : null,
          },
        }
      : {
          gravimetry: {
            filterWeightBefore: filterWeightBefore ? Number(filterWeightBefore) : null,
            filterWeightAfter: filterWeightAfter ? Number(filterWeightAfter) : null,
            fieldBlankWeight: fieldBlankWeight ? Number(fieldBlankWeight) : null,
            labReadingValue: labReadingValue ? Number(labReadingValue) : null,
            sampledVolumeM3: sampledVolumeM3 ? Number(sampledVolumeM3) : null,
          },
        };
    const ok = await callApi(`/api/productive-processes/${productiveProcessId}/results`, payload);
    setSaving(null);
    if (ok) router.refresh();
  }

  async function handleValidate() {
    setSaving("validate");
    setError(null);
    const ok = await callApi(`/api/productive-processes/${productiveProcessId}/status`, { status: "VALIDADO" });
    setSaving(null);
    if (ok) router.refresh();
  }

  async function handleCancel() {
    if (!confirm("Cancelar este Processo Produtivo? Esta ação não pode ser desfeita.")) return;
    setSaving("cancel");
    setError(null);
    const ok = await callApi(`/api/productive-processes/${productiveProcessId}/status`, { status: "CANCELADO" });
    setSaving(null);
    if (ok) router.refresh();
  }

  const canEditPlan = status === "PLANEJADO" || status === "AGENDADO";
  const canMarkFieldwork = status === "AGENDADO";
  const canEditCustody = status === "EM_CAMPO" || status === "RECEBIDO_CUSTODIA";
  const canEditAcceptance = status === "RECEBIDO_CUSTODIA";
  const canEditResults = status === "EM_ANALISE";
  const canValidate = status === "EM_ANALISE";
  const canCancel = !["VALIDADO", "REJEITADO", "CANCELADO"].includes(status);

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h2 className="text-sm font-semibold text-gray-800">Status do processo</h2>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRODUCTIVE_PROCESS_STATUS_COLORS[status]}`}>
            {PRODUCTIVE_PROCESS_STATUS_LABELS[status]}
          </span>
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2 flex-wrap">
          {canMarkFieldwork && (
            <button onClick={handleMarkFieldworkDone} disabled={saving === "fieldwork"} className="btn-primary text-xs">
              {saving === "fieldwork" ? "Salvando..." : "Marcar coleta em campo concluída"}
            </button>
          )}
          {canValidate && (
            <button onClick={handleValidate} disabled={saving === "validate"} className="btn-primary text-xs">
              {saving === "validate" ? "Validando..." : "Validar resultados"}
            </button>
          )}
          {canCancel && (
            <button onClick={handleCancel} disabled={saving === "cancel"} className="btn-danger text-xs">
              {saving === "cancel" ? "Cancelando..." : "Cancelar processo"}
            </button>
          )}
        </div>
      </div>

      {/* Fase 1 — Plano de Amostragem */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">1. Plano de Amostragem</h2>
        {canEditPlan ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Data/hora agendada</label>
                <input className="input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <div>
                <label className="label">Responsável técnico (campo)</label>
                <select className="input" value={fieldResponsibleId} onChange={(e) => setFieldResponsibleId(e.target.value)}>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Checklist de equipamentos</p>
              <div className="flex flex-wrap gap-3">
                {equipmentCatalog.map((eq) => {
                  const expired = eq.calibrationValidUntil && new Date(eq.calibrationValidUntil) < new Date(scheduledAt || Date.now());
                  return (
                    <label key={eq.id} className={`flex items-center gap-1.5 text-sm ${expired ? "text-red-600" : "text-gray-700"}`}>
                      <input
                        type="checkbox"
                        checked={equipmentIds.includes(eq.id)}
                        onChange={() =>
                          setEquipmentIds((ids) => (ids.includes(eq.id) ? ids.filter((id) => id !== eq.id) : [...ids, eq.id]))
                        }
                      />
                      {eq.name}
                      {expired && " (calibração vencida)"}
                    </label>
                  );
                })}
                {equipmentCatalog.length === 0 && <p className="text-xs text-gray-400">Nenhum equipamento cadastrado.</p>}
              </div>
            </div>
            <button onClick={handleSaveSamplingPlan} disabled={saving === "plan"} className="btn-primary text-xs">
              {saving === "plan" ? "Salvando..." : "Salvar plano de amostragem"}
            </button>
          </div>
        ) : samplingPlan ? (
          <div className="text-sm text-gray-600 space-y-1">
            <p>Agendado para {formatDateTime(samplingPlan.scheduledAt)}, responsável: {samplingPlan.fieldResponsible.name}</p>
            {samplingPlan.notes && <p className="text-xs text-gray-400">{samplingPlan.notes}</p>}
            {samplingPlan.equipmentChecks.length > 0 && (
              <p className="text-xs text-gray-400">Equipamentos: {samplingPlan.equipmentChecks.map((c) => c.equipment.name).join(", ")}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Ainda não iniciado.</p>
        )}
      </div>

      {/* Fase 2 — Entrada e Custódia */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">2. Entrada e Custódia</h2>
        {canEditCustody ? (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="label">Data/hora de chegada</label>
                <input className="input" type="datetime-local" value={arrivedAt} onChange={(e) => setArrivedAt(e.target.value)} />
              </div>
              <div>
                <label className="label">Temperatura (°C)</label>
                <input className="input" type="number" step="0.1" value={temperatureC} onChange={(e) => setTemperatureC(e.target.value)} />
              </div>
              <div>
                <label className="label">Umidade (%)</label>
                <input className="input" type="number" step="0.1" value={humidityPercent} onChange={(e) => setHumidityPercent(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Condições climáticas de campo</label>
              <input className="input" value={weatherConditions} onChange={(e) => setWeatherConditions(e.target.value)} />
            </div>
            <button onClick={handleSaveCustody} disabled={saving === "custody"} className="btn-primary text-xs">
              {saving === "custody" ? "Salvando..." : "Registrar entrada e custódia"}
            </button>
          </div>
        ) : custodyEntry ? (
          <div className="text-sm text-gray-600 space-y-1">
            <p>Recebido em {formatDateTime(custodyEntry.arrivedAt)} por {custodyEntry.receivedBy.name}</p>
            {custodyEntry.weatherConditions && <p className="text-xs text-gray-400">{custodyEntry.weatherConditions}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aguardando conclusão da coleta em campo.</p>
        )}
      </div>

      {/* Fase 3 — Checagem e Aceitação */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">3. Checagem e Aceitação</h2>
        {canEditAcceptance ? (
          <div className="space-y-3">
            <div className="flex gap-4">
              {(["ACEITA", "ACEITA_COM_RESSALVAS", "REJEITADA"] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={acceptanceStatus === v} onChange={() => setAcceptanceStatus(v)} />
                  {ACCEPTANCE_STATUS_LABELS[v]}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={filtersIntegrityOk} onChange={(e) => setFiltersIntegrityOk(e.target.checked)} />
                Integridade dos filtros OK
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={sealsIntegrityOk} onChange={(e) => setSealsIntegrityOk(e.target.checked)} />
                Lacres de segurança OK
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={absorbentSolutionOk} onChange={(e) => setAbsorbentSolutionOk(e.target.checked)} />
                Soluções absorvedoras OK
              </label>
            </div>
            <div>
              <label className="label">Anomalias ou desvios {acceptanceStatus !== "ACEITA" && "(obrigatório)"}</label>
              <textarea className="input" rows={2} value={deviationNotes} onChange={(e) => setDeviationNotes(e.target.value)} />
            </div>
            <button onClick={handleSaveAcceptance} disabled={saving === "acceptance"} className="btn-primary text-xs">
              {saving === "acceptance" ? "Salvando..." : "Registrar checagem e aceitação"}
            </button>
          </div>
        ) : sampleAcceptance ? (
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              {ACCEPTANCE_STATUS_LABELS[sampleAcceptance.status]} por {sampleAcceptance.acceptedBy.name} em{" "}
              {formatDateTime(sampleAcceptance.acceptedAt)}
            </p>
            {sampleAcceptance.deviationNotes && <p className="text-xs text-gray-400">{sampleAcceptance.deviationNotes}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aguardando entrada e custódia da amostra.</p>
        )}
      </div>

      {/* Fase 4 — Resultados */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">4. Resultados (Folha de Trabalho)</h2>
        {canEditResults ? (
          <div className="space-y-3">
            {isAcoustic ? (
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Leq (dB(A))</label>
                  <input className="input" type="number" step="0.01" value={leqDba} onChange={(e) => setLeqDba(e.target.value)} />
                </div>
                <div>
                  <label className="label">L10 (dB(A))</label>
                  <input className="input" type="number" step="0.01" value={l10Dba} onChange={(e) => setL10Dba(e.target.value)} />
                </div>
                <div>
                  <label className="label">L90 (dB(A))</label>
                  <input className="input" type="number" step="0.01" value={l90Dba} onChange={(e) => setL90Dba(e.target.value)} />
                </div>
                <div>
                  <label className="label">Ruído de fundo (dB(A))</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={backgroundNoiseDba}
                    onChange={(e) => setBackgroundNoiseDba(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Duração da medição (min)</label>
                  <input
                    className="input"
                    type="number"
                    value={measurementMinutes}
                    onChange={(e) => setMeasurementMinutes(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Peso do filtro antes (g)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    value={filterWeightBefore}
                    onChange={(e) => setFilterWeightBefore(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Peso do filtro depois (g)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    value={filterWeightAfter}
                    onChange={(e) => setFilterWeightAfter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Branco de campo (g)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    value={fieldBlankWeight}
                    onChange={(e) => setFieldBlankWeight(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Leitura de laboratório</label>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    value={labReadingValue}
                    onChange={(e) => setLabReadingValue(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Volume amostrado (m³)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    value={sampledVolumeM3}
                    onChange={(e) => setSampledVolumeM3(e.target.value)}
                  />
                </div>
              </div>
            )}
            <button onClick={handleSaveResults} disabled={saving === "results"} className="btn-primary text-xs">
              {saving === "results" ? "Salvando..." : "Salvar resultados"}
            </button>
          </div>
        ) : resultWorksheet && (resultWorksheet.gravimetry || resultWorksheet.acoustic) ? (
          <div className="text-sm text-gray-600 space-y-1">
            {isAcoustic && resultWorksheet.acoustic && (
              <p>
                Leq: {resultWorksheet.acoustic.leqDba?.toString() ?? "-"} dB(A) · L10: {resultWorksheet.acoustic.l10Dba?.toString() ?? "-"} · L90:{" "}
                {resultWorksheet.acoustic.l90Dba?.toString() ?? "-"} · Ruído de fundo: {resultWorksheet.acoustic.backgroundNoiseDba?.toString() ?? "-"}
              </p>
            )}
            {!isAcoustic && resultWorksheet.gravimetry && (
              <p>Leitura de laboratório: {resultWorksheet.gravimetry.labReadingValue?.toString() ?? "-"}</p>
            )}
            {resultWorksheet.validatedAt && (
              <p className="text-xs text-green-700">
                Validado por {resultWorksheet.validatedBy?.name} em {formatDateTime(resultWorksheet.validatedAt)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aguardando aceitação da amostra.</p>
        )}
      </div>
    </div>
  );
}
