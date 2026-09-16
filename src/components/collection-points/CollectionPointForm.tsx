"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { MATRIX_LABELS } from "@/lib/format";
import type { Client, Legislation, Test } from "@prisma/client";

const MATRIX_OPTIONS = Object.entries(MATRIX_LABELS);

interface ExistingPoint {
  id: string;
  clientId: string;
  matrix: string;
  name: string;
  airQualityDetail: {
    location: string | null;
    gpsLatitude: string | null;
    gpsLongitude: string | null;
    mapsLink: string | null;
    surroundingsDescription: string | null;
    knownSamplingDeviation: string | null;
  } | null;
  atmosphericDetail: { notes: string | null } | null;
  noiseDetail: { notes: string | null } | null;
  collectionPointTests: { test: Test }[];
  collectionPointLegislations: { legislation: Legislation }[];
}

export function CollectionPointForm({
  point,
  clients,
  tests,
  legislations,
  defaultClientId,
}: {
  point?: ExistingPoint;
  clients: Client[];
  tests: Test[];
  legislations: Legislation[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(point?.clientId ?? defaultClientId ?? clients[0]?.id ?? "");
  const [matrix, setMatrix] = useState(point?.matrix ?? "EMISSOES_ATMOSFERICAS");
  const [name, setName] = useState(point?.name ?? "");
  const [airQuality, setAirQuality] = useState({
    location: point?.airQualityDetail?.location ?? "",
    gpsLatitude: point?.airQualityDetail?.gpsLatitude ?? "",
    gpsLongitude: point?.airQualityDetail?.gpsLongitude ?? "",
    mapsLink: point?.airQualityDetail?.mapsLink ?? "",
    surroundingsDescription: point?.airQualityDetail?.surroundingsDescription ?? "",
    knownSamplingDeviation: point?.airQualityDetail?.knownSamplingDeviation ?? "",
  });
  const [atmosphericNotes, setAtmosphericNotes] = useState(point?.atmosphericDetail?.notes ?? "");
  const [noiseNotes, setNoiseNotes] = useState(point?.noiseDetail?.notes ?? "");
  const [testIds, setTestIds] = useState<string[]>(point?.collectionPointTests.map((t) => t.test.id) ?? []);
  const [legislationIds, setLegislationIds] = useState<string[]>(
    point?.collectionPointLegislations.map((l) => l.legislation.id) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const relevantTests = tests.filter((t) => t.matrix === matrix);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      clientId,
      matrix,
      name,
      testIds,
      legislationIds,
      airQuality: matrix === "QUALIDADE_AR" ? airQuality : null,
      atmosphericNotes: matrix === "EMISSOES_ATMOSFERICAS" ? atmosphericNotes : null,
      noiseNotes: matrix === "RUIDO_AMBIENTAL" ? noiseNotes : null,
    };

    const url = point ? `/api/collection-points/${point.id}` : "/api/collection-points";
    const res = await fetch(url, {
      method: point ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar o ponto de coleta.");
      return;
    }

    if (point) {
      router.refresh();
    } else {
      const { collectionPoint: created } = await res.json();
      router.push(`/pontos-coleta/${created.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Cliente" required>
            <select className="input" disabled={!!point} value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.corporateName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Matriz" required>
            <select className="input" disabled={!!point} value={matrix} onChange={(e) => setMatrix(e.target.value)}>
              {MATRIX_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Nome / identificação do ponto" required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
      </div>

      {matrix === "QUALIDADE_AR" && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Dados específicos - Qualidade do Ar</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Local da coleta">
              <input className="input" value={airQuality.location ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, location: e.target.value }))} />
            </Field>
            <Field label="Link do Google Maps/Earth">
              <input className="input" value={airQuality.mapsLink ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, mapsLink: e.target.value }))} />
            </Field>
            <Field label="Latitude">
              <input className="input" value={airQuality.gpsLatitude ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, gpsLatitude: e.target.value }))} />
            </Field>
            <Field label="Longitude">
              <input className="input" value={airQuality.gpsLongitude ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, gpsLongitude: e.target.value }))} />
            </Field>
          </div>
          <Field label="Descrição do entorno do ponto">
            <textarea className="input" rows={2} value={airQuality.surroundingsDescription ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, surroundingsDescription: e.target.value }))} />
          </Field>
          <Field label="Desvio da amostragem conhecido">
            <textarea className="input" rows={2} value={airQuality.knownSamplingDeviation ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, knownSamplingDeviation: e.target.value }))} />
          </Field>
        </div>
      )}

      {matrix === "EMISSOES_ATMOSFERICAS" && (
        <div className="card p-5 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Dados específicos - Emissões Atmosféricas</h2>
          <p className="text-xs text-gray-500">
            Campos técnicos específicos desta matriz poderão ser adicionados futuramente. Use o campo abaixo para
            observações gerais.
          </p>
          <Field label="Observações">
            <textarea className="input" rows={3} value={atmosphericNotes ?? ""} onChange={(e) => setAtmosphericNotes(e.target.value)} />
          </Field>
        </div>
      )}

      {matrix === "RUIDO_AMBIENTAL" && (
        <div className="card p-5 space-y-2">
          <h2 className="text-sm font-semibold text-gray-800">Dados específicos - Ruído Ambiental</h2>
          <p className="text-xs text-gray-500">
            Campos técnicos específicos desta matriz poderão ser adicionados futuramente. Use o campo abaixo para
            observações gerais.
          </p>
          <Field label="Observações">
            <textarea className="input" rows={3} value={noiseNotes ?? ""} onChange={(e) => setNoiseNotes(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Ensaios relacionados</h2>
        {relevantTests.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum ensaio cadastrado para esta matriz.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {relevantTests.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="checkbox" checked={testIds.includes(t.id)} onChange={() => toggle(testIds, setTestIds, t.id)} />
                {t.name} ({t.parameterCode})
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Legislação/norma relacionada</h2>
        {legislations.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma legislação cadastrada.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {legislations.map((l) => (
              <label key={l.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="checkbox" checked={legislationIds.includes(l.id)} onChange={() => toggle(legislationIds, setLegislationIds, l.id)} />
                {l.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Salvando..." : point ? "Salvar alterações" : "Cadastrar ponto de coleta"}
      </button>
    </form>
  );
}
