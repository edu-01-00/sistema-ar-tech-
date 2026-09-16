"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROPOSAL_STATUS_LABELS } from "@/lib/format";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  EM_ELABORACAO: ["ENVIADA", "CANCELADA"],
  ENVIADA: ["APROVADA", "NAO_APROVADA", "CANCELADA"],
  APROVADA: ["CANCELADA"],
  NAO_APROVADA: ["EM_ELABORACAO", "CANCELADA"],
  CANCELADA: [],
};

export function ProposalStatusActions({ proposalId, status, canChangeStatus }: { proposalId: string; status: string; canChangeStatus: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canChangeStatus) return null;
  const options = ALLOWED_TRANSITIONS[status] ?? [];
  if (options.length === 0) return null;

  async function changeStatus(newStatus: string) {
    if (!window.confirm(`Alterar status para "${PROPOSAL_STATUS_LABELS[newStatus]}"?`)) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/proposals/${proposalId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível alterar o status.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {options.map((opt) => (
        <button key={opt} disabled={saving} onClick={() => changeStatus(opt)} className="btn-secondary text-xs">
          {PROPOSAL_STATUS_LABELS[opt]}
        </button>
      ))}
    </div>
  );
}
