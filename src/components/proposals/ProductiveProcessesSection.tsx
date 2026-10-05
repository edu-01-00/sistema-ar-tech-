"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MATRIX_LABELS } from "@/lib/format";

interface ProductiveProcessListItem {
  id: string;
  code: string;
  collectionPointId: string;
  collectionPointName: string;
}

interface ProposalPoint {
  id: string;
  name: string;
  matrix: string;
}

// Seção exibida na proposta aprovada: lista os Processos Produtivos já
// gerados e permite gerar um novo, selecionando UM ponto de coleta da
// proposta (nunca todos de uma vez — cada ponto gera seu próprio PP).
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
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Processos Produtivos</h2>

      {existingProcesses.length === 0 ? (
        <p className="text-sm text-gray-500 mb-3">Nenhum Processo Produtivo gerado ainda.</p>
      ) : (
        <ul className="divide-y divide-gray-100 mb-4">
          {existingProcesses.map((pp) => (
            <li key={pp.id} className="py-2 flex items-center justify-between gap-3">
              <div className="text-sm text-gray-800">
                <span className="font-medium">{pp.code}</span>
                <span className="text-gray-500"> — {pp.collectionPointName}</span>
              </div>
              <Link href={`/processos-produtivos/${pp.id}`} className="btn-secondary text-xs">
                Ver detalhes
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canManage && points.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
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
