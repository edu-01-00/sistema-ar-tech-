"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/format";

interface EpiRecordItemInfo {
  id: string;
  description: string;
  quantity: number;
  caNumber: string | null;
  deliveredAt: string | Date;
  returnedAt: string | Date | null;
  signedName: string | null;
  signedAt: string | Date | null;
}

interface EpiRecordInfo {
  id: string;
  signedAt: string | Date | null;
  signedName: string | null;
  storageKey: string | null;
  items: EpiRecordItemInfo[];
}

export function EpiRecordPanel({
  employeeId,
  record,
  admissionLabel,
  terminationLabel,
}: {
  employeeId: string;
  record: EpiRecordInfo;
  admissionLabel: string;
  terminationLabel: string | null;
}) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [caNumber, setCaNumber] = useState("");
  const [deliveredAt, setDeliveredAt] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [signing, setSigning] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [returnDates, setReturnDates] = useState<Record<string, string>>({});
  const [itemSignNames, setItemSignNames] = useState<Record<string, string>>({});
  const [signingItemId, setSigningItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAddItem() {
    if (!description.trim()) {
      setError("Informe a descrição do EPI.");
      return;
    }
    if (!deliveredAt) {
      setError("Informe a data de entrega.");
      return;
    }
    setAddingItem(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/epi-record/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: description.trim(),
        quantity: Number(quantity) || 1,
        caNumber: caNumber.trim() || null,
        deliveredAt,
      }),
    });
    setAddingItem(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível registrar o EPI.");
      return;
    }
    setDescription("");
    setQuantity("1");
    setCaNumber("");
    setDeliveredAt("");
    router.refresh();
  }

  async function handleRegisterReturn(itemId: string) {
    const returnedAt = returnDates[itemId];
    if (!returnedAt) {
      setError("Informe a data de devolução.");
      return;
    }
    const res = await fetch(`/api/employees/${employeeId}/epi-record/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnedAt }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível registrar a devolução.");
      return;
    }
    router.refresh();
  }

  async function handleSignItem(itemId: string) {
    const name = itemSignNames[itemId]?.trim();
    if (!name) {
      setError("Informe o nome completo para confirmar a assinatura do EPI.");
      return;
    }
    setSigningItemId(itemId);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/epi-record/items/${itemId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedName: name }),
    });
    setSigningItemId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível registrar a assinatura do EPI.");
      return;
    }
    setItemSignNames((prev) => ({ ...prev, [itemId]: "" }));
    router.refresh();
  }

  async function handleSign() {
    if (!signedName.trim()) {
      setError("Informe o nome completo para confirmar a assinatura.");
      return;
    }
    setSigning(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/epi-record/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedName: signedName.trim() }),
    });
    setSigning(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível registrar a assinatura.");
      return;
    }
    setSignedName("");
    router.refresh();
  }

  async function handleGeneratePdf() {
    setGeneratingPdf(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/epi-record/pdf`, { method: "POST" });
    setGeneratingPdf(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível gerar o PDF.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Ficha de EPI</h2>

      <div className="text-xs text-gray-500 mb-3 space-y-0.5">
        <p>Data de admissão: {admissionLabel}</p>
        {terminationLabel && <p>Data de demissão: {terminationLabel}</p>}
      </div>

      <div className="border border-gray-200 rounded-md p-3 mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">Assinatura digital (única, na admissão):</p>
        {record.signedAt ? (
          <p className="text-xs text-green-700">
            Assinado por <strong>{record.signedName}</strong> em {formatDateTime(record.signedAt)}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <input
              className="input max-w-xs"
              placeholder="Nome completo do funcionário"
              value={signedName}
              onChange={(e) => setSignedName(e.target.value)}
            />
            <button onClick={handleSign} disabled={signing} className="btn-primary text-xs">
              {signing ? "Assinando..." : "Confirmar assinatura"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <div className="border border-gray-200 rounded-md p-3 mb-4">
        <p className="text-xs font-medium text-gray-600 mb-2">Registrar entrega de EPI:</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            className="input col-span-2"
            placeholder="Descrição do EPI"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="input"
            type="number"
            min={1}
            placeholder="Quantidade"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <input className="input" placeholder="Nº do CA" value={caNumber} onChange={(e) => setCaNumber(e.target.value)} />
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Data de entrega</label>
            <input className="input" type="date" value={deliveredAt} onChange={(e) => setDeliveredAt(e.target.value)} />
          </div>
        </div>
        <button onClick={handleAddItem} disabled={addingItem} className="btn-primary text-xs">
          {addingItem ? "Registrando..." : "Registrar EPI"}
        </button>
      </div>

      {record.items.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">Nenhum EPI registrado.</p>
      ) : (
        <ul className="divide-y divide-gray-100 mb-4">
          {record.items.map((item) => (
            <li key={item.id} className="py-3">
              <p className="text-sm font-medium text-gray-800">
                {item.description} · Qtd: {item.quantity} {item.caNumber && `· CA: ${item.caNumber}`}
              </p>
              <p className="text-xs text-gray-400">
                Entregue em {formatDate(item.deliveredAt)}
                {item.returnedAt ? ` · Devolvido em ${formatDate(item.returnedAt)}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {!item.returnedAt && (
                  <>
                    <input
                      className="input max-w-[160px]"
                      type="date"
                      value={returnDates[item.id] ?? ""}
                      onChange={(e) => setReturnDates((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                    <button onClick={() => handleRegisterReturn(item.id)} className="btn-secondary text-xs">
                      Registrar devolução
                    </button>
                  </>
                )}

                {item.signedAt ? (
                  <span className="text-xs text-green-700">
                    Recebimento assinado por <strong>{item.signedName}</strong> em {formatDateTime(item.signedAt)}
                  </span>
                ) : (
                  <>
                    <input
                      className="input max-w-[160px]"
                      placeholder="Nome completo do funcionário"
                      value={itemSignNames[item.id] ?? ""}
                      onChange={(e) => setItemSignNames((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                    <button
                      onClick={() => handleSignItem(item.id)}
                      disabled={signingItemId === item.id}
                      className="btn-primary text-xs"
                    >
                      {signingItemId === item.id ? "Assinando..." : "Assinar recebimento"}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <button onClick={handleGeneratePdf} disabled={generatingPdf} className="btn-primary text-xs">
          {generatingPdf ? "Gerando..." : "Gerar PDF"}
        </button>
        {record.storageKey && (
          <a href={`/api/employees/${employeeId}/epi-record/download`} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
            Baixar PDF
          </a>
        )}
      </div>
    </div>
  );
}
