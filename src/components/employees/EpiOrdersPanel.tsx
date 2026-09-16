"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";

interface EpiOption {
  id: string;
  name: string;
}

interface EpiOrderInfo {
  id: string;
  code: string;
  status: string;
  issuedAt: string | Date;
  acceptedAt: string | Date | null;
  acceptedName: string | null;
  storageKey: string | null;
  items: { id: string; nameSnapshot: string }[];
}

export function EpiOrdersPanel({
  employeeId,
  epis,
  orders,
}: {
  employeeId: string;
  epis: EpiOption[];
  orders: EpiOrderInfo[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptName, setAcceptName] = useState("");

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function handleCreateOrder() {
    if (selected.length === 0) {
      setError("Selecione ao menos um EPI.");
      return;
    }
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/epi-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, epiIds: selected }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível gerar a ordem de serviço.");
      return;
    }
    setSelected([]);
    router.refresh();
  }

  async function handleAccept(orderId: string) {
    if (!acceptName.trim()) {
      setError("Informe o nome completo para confirmar o aceite.");
      return;
    }
    const res = await fetch(`/api/epi-orders/${orderId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptedName: acceptName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível registrar o aceite.");
      return;
    }
    setAcceptingId(null);
    setAcceptName("");
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Ordem de Serviço - EPI</h2>

      <div className="border border-gray-200 rounded-md p-3 mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">Selecione os EPIs para gerar uma nova ordem de serviço:</p>
        <div className="flex flex-wrap gap-3 mb-3">
          {epis.map((epi) => (
            <label key={epi.id} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" checked={selected.includes(epi.id)} onChange={() => toggle(epi.id)} />
              {epi.name}
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <button onClick={handleCreateOrder} disabled={creating} className="btn-primary text-xs">
          {creating ? "Gerando..." : "Gerar Ordem de Serviço"}
        </button>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma ordem de serviço gerada.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {orders.map((order) => (
            <li key={order.id} className="py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {order.code}{" "}
                    <Badge className={order.status === "ACEITO" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                      {order.status === "ACEITO" ? "Aceito" : "Pendente"}
                    </Badge>
                  </p>
                  <p className="text-xs text-gray-400">
                    Emitida em {formatDateTime(order.issuedAt)} · EPIs: {order.items.map((i) => i.nameSnapshot).join(", ")}
                  </p>
                  {order.acceptedAt && (
                    <p className="text-xs text-gray-400">
                      Aceito por {order.acceptedName} em {formatDateTime(order.acceptedAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {order.storageKey && (
                    <a href={`/api/epi-orders/${order.id}/download`} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
                      Baixar PDF
                    </a>
                  )}
                  {order.status === "PENDENTE" && acceptingId !== order.id && (
                    <button onClick={() => setAcceptingId(order.id)} className="btn-primary text-xs">
                      Registrar aceite
                    </button>
                  )}
                </div>
              </div>
              {acceptingId === order.id && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    className="input max-w-xs"
                    placeholder="Nome completo do funcionário"
                    value={acceptName}
                    onChange={(e) => setAcceptName(e.target.value)}
                  />
                  <button onClick={() => handleAccept(order.id)} className="btn-primary text-xs">
                    Confirmar concordância
                  </button>
                  <button onClick={() => setAcceptingId(null)} className="btn-secondary text-xs">
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
