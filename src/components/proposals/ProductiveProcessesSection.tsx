"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MATRIX_LABELS, PRODUCTIVE_PROCESS_STATUS_LABELS, PRODUCTIVE_PROCESS_STATUS_COLORS } from "@/lib/format";
import { computeMatrixAggregateStatus, type ProductiveProcessStatusValue } from "@/lib/productive-process-logic";

interface ProductiveProcessListItem {
  id: string;
  code: string;
  collectionPointId: string;
  collectionPointName: string;
  status: ProductiveProcessStatusValue;
}

interface ProposalPoint {
  id: string;
  name: string;
  matrix: string;
}

const MATRIX_ORDER = ["EMISSOES_ATMOSFERICAS", "QUALIDADE_AR", "RUIDO_AMBIENTAL"];

// Campanha de Monitoramento: agrupa os Processos Produtivos já gerados
// (automaticamente na aprovação da proposta, um por ponto de coleta) em
// abas por matriz — cada aba reúne a execução técnica (ISO 17025) dos
// pontos daquela matriz. O status do cabeçalho da aba é o "elo mais fraco"
// entre os processos daquela matriz (computeMatrixAggregateStatus).
export function ProductiveProcessesSection({
  proposalId,
  points,
  existingProcesses,
  canManage,
}: {
  proposalId: string;
  points: ProposalPoint[];
  existingProcesses: ProductiveProcessListItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [collectionPointId, setCollectionPointId] = useState(points[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pointById = new Map(points.map((p) => [p.id, p]));
  const matricesPresent = MATRIX_ORDER.filter((m) => existingProcesses.some((pp) => pointById.get(pp.collectionPointId)?.matrix === m));
  const [activeMatrix, setActiveMatrix] = useState(matricesPresent[0] ?? MATRIX_ORDER[0]);

  const pointsWithProcessCount = points.map((p) => ({
    ...p,
    existingCount: existingProcesses.filter((pp) => pp.collectionPointId === p.id).length,
  }));

  async function handleGenerate() {
    if (!collectionPointId) {
      setError("Selecione o ponto de coleta.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/proposals/${proposalId}/productive-processes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionPointId }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível gerar o Processo Produtivo.");
      return;
    }
    router.push(`/processos-produtivos/${data.productiveProcess.id}`);
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Campanha de Monitoramento — Execução Técnica</h2>

      {existingProcesses.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">Nenhum Processo Produtivo gerado ainda.</p>
      ) : (
        <>
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            {matricesPresent.map((matrix) => {
              const statuses = existingProcesses
                .filter((pp) => pointById.get(pp.collectionPointId)?.matrix === matrix)
                .map((pp) => pp.status);
              const aggregate = computeMatrixAggregateStatus(statuses);
              return (
                <button
                  key={matrix}
                  onClick={() => setActiveMatrix(matrix)}
                  className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
                    activeMatrix === matrix ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {MATRIX_LABELS[matrix] ?? matrix}
                  {aggregate && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${PRODUCTIVE_PROCESS_STATUS_COLORS[aggregate]}`}>
                      {PRODUCTIVE_PROCESS_STATUS_LABELS[aggregate]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <ul className="divide-y divide-gray-100 mb-4">
            {existingProcesses
              .filter((pp) => pointById.get(pp.collectionPointId)?.matrix === activeMatrix)
              .map((pp) => (
                <li key={pp.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-800">
                    <span className="font-medium">{pp.code}</span>
                    <span className="text-gray-500"> — {pp.collectionPointName}</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${PRODUCTIVE_PROCESS_STATUS_COLORS[pp.status]}`}>
                      {PRODUCTIVE_PROCESS_STATUS_LABELS[pp.status]}
                    </span>
                  </div>
                  <Link href={`/processos-produtivos/${pp.id}`} className="btn-secondary text-xs">
                    Ver execução
                  </Link>
                </li>
              ))}
          </ul>
        </>
      )}

      {canManage && points.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 mb-2">
            Processos Produtivos e Ordens de Serviço são gerados automaticamente para cada ponto de coleta ao aprovar a proposta. Use a opção
            abaixo apenas para gerar manualmente um processo que, por algum motivo, ainda não exista.
          </p>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <label className="label">Ponto de coleta</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select className="input sm:max-w-sm" value={collectionPointId} onChange={(e) => setCollectionPointId(e.target.value)}>
              {pointsWithProcessCount.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {MATRIX_LABELS[p.matrix] ?? p.matrix}
                  {p.existingCount > 0 ? ` (já possui ${p.existingCount} Processo${p.existingCount > 1 ? "s" : ""} Produtivo${p.existingCount > 1 ? "s" : ""})` : ""}
                </option>
              ))}
            </select>
            <button onClick={handleGenerate} disabled={saving} className="btn-primary shrink-0">
              {saving ? "Gerando..." : "Gerar Processo Produtivo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
