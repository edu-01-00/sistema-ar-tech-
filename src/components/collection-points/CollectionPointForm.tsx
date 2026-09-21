"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { ImageUploadBox } from "@/components/ui/ImageUploadBox";
import {
  MATRIX_LABELS,
  CHIMNEY_INSTALLATION_YEAR_LABELS,
  CHIMNEY_ACCESS_TYPE_LABELS,
  CHIMNEY_COVERAGE_LABELS,
  CHIMNEY_GEOMETRY_LABELS,
  ATMOSPHERIC_EMISSION_TYPE_LABELS,
  ATMOSPHERIC_COMBUSTION_TYPE_LABELS,
  OPERATIONAL_CYCLE_LABELS,
  FUEL_CONSUMPTION_UNIT_LABELS,
} from "@/lib/format";
import type { Client, Legislation, Test } from "@prisma/client";

const MATRIX_OPTIONS = Object.entries(MATRIX_LABELS);

interface AirQualityLikeDetail {
  location?: string | null;
  gpsLatitude: string | null;
  gpsLongitude: string | null;
  mapsLink: string | null;
  surroundingsDescription: string | null;
  knownSamplingDeviation: string | null;
  imageStorageKey?: string | null;
}

interface AtmosphericDetail {
  notes: string | null;
  installationYear: string | null;
  accessType: string | null;
  coverage: string | null;
  chimneyGeometry: string | null;
  emissionType: string | null;
  combustionType: string | null;
  operationalCycle: string | null;
  geographicCoordinates: string | null;
  processDescription: string | null;
  rawMaterialsAndQuantities: string | null;
  productsAndQuantities: string | null;
  operatingDaysAndHours: string | null;
  operatingConditions: string | null;
  internalEquivalentDuctDiameterM: string | null;
  upstreamDistanceM: string | null;
  downstreamDistanceM: string | null;
  internalLengthM: string | null;
  internalWidthM: string | null;
  flangeSleeveCm: string | null;
  wallThicknessCm: string | null;
  totalChimneyLengthM: string | null;
  totalChimneyLengthToGroundM: string | null;
  fuel: string | null;
  fuelConsumption: string | null;
  fuelConsumptionUnit: string | null;
  nominalPowerMw: string | null;
  pollutionControlType: string | null;
  samplingDeviations: string | null;
}

interface ExistingPoint {
  id: string;
  clientId: string;
  matrix: string;
  name: string;
  airQualityDetail: AirQualityLikeDetail | null;
  atmosphericDetail: AtmosphericDetail | null;
  noiseDetail: AirQualityLikeDetail | null;
  collectionPointTests: { test: Test }[];
  collectionPointLegislations: { legislation: Legislation }[];
}

const emptyAtmospheric: AtmosphericDetail = {
  notes: "",
  installationYear: "",
  accessType: "",
  coverage: "",
  chimneyGeometry: "",
  emissionType: "",
  combustionType: "",
  operationalCycle: "",
  geographicCoordinates: "",
  processDescription: "",
  rawMaterialsAndQuantities: "",
  productsAndQuantities: "",
  operatingDaysAndHours: "",
  operatingConditions: "",
  internalEquivalentDuctDiameterM: "",
  upstreamDistanceM: "",
  downstreamDistanceM: "",
  internalLengthM: "",
  internalWidthM: "",
  flangeSleeveCm: "",
  wallThicknessCm: "",
  totalChimneyLengthM: "",
  totalChimneyLengthToGroundM: "",
  fuel: "",
  fuelConsumption: "",
  fuelConsumptionUnit: "",
  nominalPowerMw: "",
  pollutionControlType: "",
  samplingDeviations: "",
};

const emptyAirQualityLike: AirQualityLikeDetail = {
  location: "",
  gpsLatitude: "",
  gpsLongitude: "",
  mapsLink: "",
  surroundingsDescription: "",
  knownSamplingDeviation: "",
};

export function CollectionPointForm({
  point,
  clients,
  tests,
  legislations,
  defaultClientId,
  canManage = true,
}: {
  point?: ExistingPoint;
  clients: Client[];
  tests: Test[];
  legislations: Legislation[];
  defaultClientId?: string;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(point?.clientId ?? defaultClientId ?? clients[0]?.id ?? "");
  const [matrix, setMatrix] = useState(point?.matrix ?? "EMISSOES_ATMOSFERICAS");
  const [name, setName] = useState(point?.name ?? "");
  const [airQuality, setAirQuality] = useState<AirQualityLikeDetail>({
    ...emptyAirQualityLike,
    ...(point?.airQualityDetail ?? {}),
  });
  const [noise, setNoise] = useState<AirQualityLikeDetail>({
    ...emptyAirQualityLike,
    ...(point?.noiseDetail ?? {}),
  });
  const [atmospheric, setAtmospheric] = useState<AtmosphericDetail>({
    ...emptyAtmospheric,
    ...(point?.atmosphericDetail ?? {}),
  });
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

  function updateAtmospheric<K extends keyof AtmosphericDetail>(key: K, value: string) {
    setAtmospheric((a) => ({ ...a, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const cleanEmpty = <T extends object>(obj: T) =>
      Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === "" ? null : v])) as T;

    const payload = {
      clientId,
      matrix,
      name,
      testIds,
      legislationIds,
      airQuality: matrix === "QUALIDADE_AR" ? cleanEmpty({ ...airQuality, location: airQuality.location ?? "" }) : null,
      atmospheric: matrix === "EMISSOES_ATMOSFERICAS" ? cleanEmpty(atmospheric) : null,
      noise: matrix === "RUIDO_AMBIENTAL" ? cleanEmpty(noise) : null,
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
          <h2 className="text-sm font-semibold text-gray-800">Dados específicos — Qualidade do Ar</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Local da coleta">
              <input className="input" value={airQuality.location ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, location: e.target.value }))} />
            </Field>
            <Field label="Link do Google Maps/Earth">
              <input className="input" value={airQuality.mapsLink ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, mapsLink: e.target.value }))} />
            </Field>
            <Field label="Coordenadas geográficas (latitude)">
              <input className="input" value={airQuality.gpsLatitude ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, gpsLatitude: e.target.value }))} />
            </Field>
            <Field label="Coordenadas geográficas (longitude)">
              <input className="input" value={airQuality.gpsLongitude ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, gpsLongitude: e.target.value }))} />
            </Field>
          </div>
          <Field label="Descrição entorno do ponto de amostragem (solo, construções, rodovias, empresas)">
            <textarea className="input" rows={2} value={airQuality.surroundingsDescription ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, surroundingsDescription: e.target.value }))} />
          </Field>
          <Field label="Desvios de amostragem conhecidos">
            <textarea className="input" rows={2} value={airQuality.knownSamplingDeviation ?? ""} onChange={(e) => setAirQuality((a) => ({ ...a, knownSamplingDeviation: e.target.value }))} />
          </Field>
          {point && (
            <ImageUploadBox
              label="Imagem da localização do ponto"
              uploadUrl={`/api/collection-points/${point.id}/air-quality-image`}
              hasImage={!!point.airQualityDetail?.imageStorageKey}
              canManage={canManage}
            />
          )}
        </div>
      )}

      {matrix === "EMISSOES_ATMOSFERICAS" && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Dados específicos — Emissões Atmosféricas</h2>
          <p className="text-xs text-gray-500">Todos os campos abaixo são opcionais.</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Ano de instalação">
              <select className="input" value={atmospheric.installationYear ?? ""} onChange={(e) => updateAtmospheric("installationYear", e.target.value)}>
                <option value="">Não informado</option>
                {Object.entries(CHIMNEY_INSTALLATION_YEAR_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Acesso">
              <select className="input" value={atmospheric.accessType ?? ""} onChange={(e) => updateAtmospheric("accessType", e.target.value)}>
                <option value="">Não informado</option>
                {Object.entries(CHIMNEY_ACCESS_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Cobertura">
              <select className="input" value={atmospheric.coverage ?? ""} onChange={(e) => updateAtmospheric("coverage", e.target.value)}>
                <option value="">Não informado</option>
                {Object.entries(CHIMNEY_COVERAGE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Geometria da chaminé">
              <select className="input" value={atmospheric.chimneyGeometry ?? ""} onChange={(e) => updateAtmospheric("chimneyGeometry", e.target.value)}>
                <option value="">Não informado</option>
                {Object.entries(CHIMNEY_GEOMETRY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de emissão">
              <select className="input" value={atmospheric.emissionType ?? ""} onChange={(e) => updateAtmospheric("emissionType", e.target.value)}>
                <option value="">Não informado</option>
                {Object.entries(ATMOSPHERIC_EMISSION_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de combustão">
              <select className="input" value={atmospheric.combustionType ?? ""} onChange={(e) => updateAtmospheric("combustionType", e.target.value)}>
                <option value="">Não informado</option>
                {Object.entries(ATMOSPHERIC_COMBUSTION_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Ciclo operacional">
              <select className="input" value={atmospheric.operationalCycle ?? ""} onChange={(e) => updateAtmospheric("operationalCycle", e.target.value)}>
                <option value="">Não informado</option>
                {Object.entries(OPERATIONAL_CYCLE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Coordenadas geográficas">
              <input className="input" value={atmospheric.geographicCoordinates ?? ""} onChange={(e) => updateAtmospheric("geographicCoordinates", e.target.value)} />
            </Field>
            <Field label="Diâmetro interno/equivalente da chaminé/duto (m)">
              <input className="input" value={atmospheric.internalEquivalentDuctDiameterM ?? ""} onChange={(e) => updateAtmospheric("internalEquivalentDuctDiameterM", e.target.value)} />
            </Field>
            <Field label="Distância à montante (m)">
              <input className="input" value={atmospheric.upstreamDistanceM ?? ""} onChange={(e) => updateAtmospheric("upstreamDistanceM", e.target.value)} />
            </Field>
            <Field label="Distância à jusante (m)">
              <input className="input" value={atmospheric.downstreamDistanceM ?? ""} onChange={(e) => updateAtmospheric("downstreamDistanceM", e.target.value)} />
            </Field>
            <Field label="Comprimento interno (m)">
              <input className="input" value={atmospheric.internalLengthM ?? ""} onChange={(e) => updateAtmospheric("internalLengthM", e.target.value)} />
            </Field>
            <Field label="Largura interna (m)">
              <input className="input" value={atmospheric.internalWidthM ?? ""} onChange={(e) => updateAtmospheric("internalWidthM", e.target.value)} />
            </Field>
            <Field label="Flange/Luva (cm)">
              <input className="input" value={atmospheric.flangeSleeveCm ?? ""} onChange={(e) => updateAtmospheric("flangeSleeveCm", e.target.value)} />
            </Field>
            <Field label="Espessura da Parede (cm)">
              <input className="input" value={atmospheric.wallThicknessCm ?? ""} onChange={(e) => updateAtmospheric("wallThicknessCm", e.target.value)} />
            </Field>
            <Field label="Comprimento total da chaminé (m)">
              <input className="input" value={atmospheric.totalChimneyLengthM ?? ""} onChange={(e) => updateAtmospheric("totalChimneyLengthM", e.target.value)} />
            </Field>
            <Field label="Comprimento total da chaminé em relação ao solo (m)">
              <input className="input" value={atmospheric.totalChimneyLengthToGroundM ?? ""} onChange={(e) => updateAtmospheric("totalChimneyLengthToGroundM", e.target.value)} />
            </Field>
            <Field label="Potência Nominal (MW)">
              <input className="input" value={atmospheric.nominalPowerMw ?? ""} onChange={(e) => updateAtmospheric("nominalPowerMw", e.target.value)} />
            </Field>
            <Field label="Combustível">
              <input className="input" value={atmospheric.fuel ?? ""} onChange={(e) => updateAtmospheric("fuel", e.target.value)} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-end">
            <Field label="Consumo de combustível">
              <input className="input" value={atmospheric.fuelConsumption ?? ""} onChange={(e) => updateAtmospheric("fuelConsumption", e.target.value)} />
            </Field>
            <Field label="Unidade de consumo">
              <select className="input" value={atmospheric.fuelConsumptionUnit ?? ""} onChange={(e) => updateAtmospheric("fuelConsumptionUnit", e.target.value)}>
                <option value="">Não informado</option>
                {Object.entries(FUEL_CONSUMPTION_UNIT_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Descrição do processo">
            <textarea className="input" rows={2} value={atmospheric.processDescription ?? ""} onChange={(e) => updateAtmospheric("processDescription", e.target.value)} />
          </Field>
          <Field label="Matérias primas e quantidades utilizadas">
            <textarea className="input" rows={2} value={atmospheric.rawMaterialsAndQuantities ?? ""} onChange={(e) => updateAtmospheric("rawMaterialsAndQuantities", e.target.value)} />
          </Field>
          <Field label="Produtos e quantidade produzida">
            <textarea className="input" rows={2} value={atmospheric.productsAndQuantities ?? ""} onChange={(e) => updateAtmospheric("productsAndQuantities", e.target.value)} />
          </Field>
          <Field label="Dias e horários de operação">
            <textarea className="input" rows={2} value={atmospheric.operatingDaysAndHours ?? ""} onChange={(e) => updateAtmospheric("operatingDaysAndHours", e.target.value)} />
          </Field>
          <Field label="Condições de operação">
            <textarea className="input" rows={2} value={atmospheric.operatingConditions ?? ""} onChange={(e) => updateAtmospheric("operatingConditions", e.target.value)} />
          </Field>
          <Field label="Tipo de controle de emissão de poluentes">
            <textarea className="input" rows={2} value={atmospheric.pollutionControlType ?? ""} onChange={(e) => updateAtmospheric("pollutionControlType", e.target.value)} />
          </Field>
          <Field label="Desvios de amostragem">
            <textarea className="input" rows={2} value={atmospheric.samplingDeviations ?? ""} onChange={(e) => updateAtmospheric("samplingDeviations", e.target.value)} />
          </Field>
          <Field label="Observações gerais">
            <textarea className="input" rows={2} value={atmospheric.notes ?? ""} onChange={(e) => updateAtmospheric("notes", e.target.value)} />
          </Field>
        </div>
      )}

      {matrix === "RUIDO_AMBIENTAL" && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Dados específicos — Ruído Ambiental</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Link do Google Maps/Earth">
              <input className="input" value={noise.mapsLink ?? ""} onChange={(e) => setNoise((a) => ({ ...a, mapsLink: e.target.value }))} />
            </Field>
            <Field label="Coordenadas geográficas (latitude)">
              <input className="input" value={noise.gpsLatitude ?? ""} onChange={(e) => setNoise((a) => ({ ...a, gpsLatitude: e.target.value }))} />
            </Field>
            <Field label="Coordenadas geográficas (longitude)">
              <input className="input" value={noise.gpsLongitude ?? ""} onChange={(e) => setNoise((a) => ({ ...a, gpsLongitude: e.target.value }))} />
            </Field>
          </div>
          <Field label="Descrição entorno do ponto de amostragem (solo, construções, rodovias, empresas)">
            <textarea className="input" rows={2} value={noise.surroundingsDescription ?? ""} onChange={(e) => setNoise((a) => ({ ...a, surroundingsDescription: e.target.value }))} />
          </Field>
          <Field label="Desvios de amostragem conhecidos">
            <textarea className="input" rows={2} value={noise.knownSamplingDeviation ?? ""} onChange={(e) => setNoise((a) => ({ ...a, knownSamplingDeviation: e.target.value }))} />
          </Field>
          {point && (
            <ImageUploadBox
              label="Imagem da localização do ponto"
              uploadUrl={`/api/collection-points/${point.id}/noise-image`}
              hasImage={!!point.noiseDetail?.imageStorageKey}
              canManage={canManage}
            />
          )}
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
