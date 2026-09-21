"use client";

import { useState } from "react";
import type { MeasurementUnit } from "@prisma/client";

// Select de unidade de medida alimentado pelo catálogo centralizado
// (MeasurementUnit), compartilhado entre Ensaios e Legislação — uma unidade
// cadastrada aqui fica disponível automaticamente nos dois lugares.
export function UnitSelect({
  value,
  onChange,
  units,
  canManageUnits,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  units: MeasurementUnit[];
  canManageUnits: boolean;
  required?: boolean;
}) {
  const [localUnits, setLocalUnits] = useState(units);
  const [adding, setAdding] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAddUnit() {
    const name = newUnit.trim();
    if (!name) return;
    setError(null);
    const res = await fetch("/api/measurement-units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível cadastrar a unidade.");
      return;
    }
    const { measurementUnit } = await res.json();
    setLocalUnits((list) => [...list, measurementUnit].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    onChange(measurementUnit.name);
    setNewUnit("");
    setAdding(false);
  }

  return (
    <div>
      <div className="flex gap-2">
        <select className="input flex-1" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
          <option value="">Selecione...</option>
          {localUnits.map((u) => (
            <option key={u.id} value={u.name}>
              {u.name}
            </option>
          ))}
          {value && !localUnits.some((u) => u.name === value) && <option value={value}>{value}</option>}
        </select>
        {canManageUnits && (
          <button type="button" className="btn-secondary text-xs shrink-0" onClick={() => setAdding((v) => !v)}>
            + Unidade
          </button>
        )}
      </div>
      {adding && (
        <div className="flex gap-2 mt-2">
          <input
            className="input flex-1"
            placeholder="Nova unidade de medida (ex: mg/L)"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
          />
          <button type="button" className="btn-primary text-xs shrink-0" onClick={handleAddUnit}>
            Adicionar
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
