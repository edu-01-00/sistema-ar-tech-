"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AvailableTest {
  proposalTestId: string;
  name: string;
  method: string;
  unit: string;
  code: string;
  proposedQuantity: number;
}

interface SelectionState {
  checked: boolean;
  quantity: number;
}

// Geração de Ordem de Serviço: o usuário seleciona QUAIS parâmetros/ensaios
// (dentre os já vinculados ao ponto de coleta/proposta) serão efetivamente
// realizados, e a quantidade de cada um — nunca uma cópia automática de
// todos os parâmetros da proposta (item 5 do requisito).
export function GenerateServiceOrderForm({ productiveProcessId, availableTests }: { productiveProcessId: string; availableTests: AvailableTest[] }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Record<string, SelectionState>>(() =>
    Object.fromEntries(availableTests.map((t) => [t.proposalTestId, { checked: false, quantity: t.proposedQuantity }])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelection((s) => ({ ...s, [id]: { ...s[id], checked: !s[id].checked } }));
  }

  function setQuantity(id: string, quantity: number) {
    setSelection((s) => ({ ...s, [id]: { ...s[id], quantity } }));
  }

  async function handleSubmit() {
    const items = Object.entries(selection)
      .filter(([, s]) => s.checked)
      .map(([proposalTestId, s]) => ({ proposalTestId, quantity: s.quantity }));

    if (items.length === 0) {
      setError("Selecione ao menos um parâmetro.");
      return;
    }
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 0)) {
      setError("A quantidade não pode ser negativa.");
      return;
    }

    setSaving(true);
    setError(null);
    const res = await fetch(`/api/productive-processes/${productiveProcessId}/service-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível gerar a Ordem de Serviço.");
      return;
    }
    router.push(`/ordens-servico/${data.serviceOrder.id}`);
  }

  if (availableTests.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Gerar Ordem de Serviço</h2>
        <p className="text-sm text-gray-500">Este ponto de coleta não possui ensaios vinculados na proposta de origem.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Gerar Ordem de Serviço</h2>
      <p className="text-xs text-gray-500 mb-3">Selecione os parâmetros que serão efetivamente realizados e a quantidade de cada um.</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <table className="table-base mb-4">
        <thead>
          <tr>
            <th></th>
            <th>Ensaio</th>
            <th>Método</th>
            <th>Unidade</th>
            <th>Qtd. proposta</th>
            <th>Qtd. a realizar</th>
          </tr>
        </thead>
        <tbody>
          {availableTests.map((t) => (
            <tr key={t.proposalTestId}>
              <td>
                <input type="checkbox" checked={selection[t.proposalTestId]?.checked ?? false} onChange={() => toggle(t.proposalTestId)} />
              </td>
              <td>{t.name}</td>
              <td>{t.method}</td>
              <td>{t.unit}</td>
              <td>{t.proposedQuantity}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input w-24"
                  value={selection[t.proposalTestId]?.quantity ?? 0}
                  onChange={(e) => setQuantity(t.proposalTestId, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  disabled={!selection[t.proposalTestId]?.checked}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handleSubmit} disabled={saving} className="btn-primary text-xs">
        {saving ? "Gerando..." : "Gerar Ordem de Serviço"}
      </button>
    </div>
  );
}
