"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviseButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    if (!window.confirm("Criar uma nova revisão desta proposta? A revisão atual será mantida no histórico.")) return;
    setSaving(true);
    const res = await fetch(`/api/proposals/${proposalId}/revise`, { method: "POST" });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Não foi possível criar a revisão.");
      return;
    }
    const { proposal } = await res.json();
    router.push(`/propostas/${proposal.id}`);
  }

  return (
    <button onClick={handleClick} disabled={saving} className="btn-secondary text-xs">
      {saving ? "Criando..." : "Criar revisão"}
    </button>
  );
}
