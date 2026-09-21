import { z } from "zod";
import { TEST_MATRIX_VALUES } from "@/lib/validations/test";

const optionalText = z.string().trim().optional().nullable();

export const CHIMNEY_INSTALLATION_YEAR_VALUES = ["ANTERIOR_2007", "POSTERIOR_2007"] as const;
export const CHIMNEY_ACCESS_TYPE_VALUES = ["PLATAFORMA_FIXA", "PLATAFORMA_ELEVATORIA", "SOLO", "CAMINHAO_MUNCK", "TELHADO"] as const;
export const CHIMNEY_COVERAGE_VALUES = ["COBERTO", "DESCOBERTO"] as const;
export const CHIMNEY_GEOMETRY_VALUES = ["RETANGULAR", "CIRCULAR", "QUADRADA"] as const;
export const ATMOSPHERIC_EMISSION_TYPE_VALUES = ["COMBUSTAO", "PROCESSO", "NAO_APLICADO"] as const;
export const ATMOSPHERIC_COMBUSTION_TYPE_VALUES = ["EXTERNA", "NAO_EXTERNA", "NAO_APLICADO"] as const;
export const OPERATIONAL_CYCLE_VALUES = ["CONTINUO", "NAO_CONTINUO"] as const;
export const FUEL_CONSUMPTION_UNIT_VALUES = ["L_H", "M3_H", "KG_H"] as const;

const airQualityLikeSchema = z.object({
  location: optionalText,
  gpsLatitude: optionalText,
  gpsLongitude: optionalText,
  mapsLink: optionalText,
  surroundingsDescription: optionalText,
  knownSamplingDeviation: optionalText,
});

const noiseSchema = z.object({
  gpsLatitude: optionalText,
  gpsLongitude: optionalText,
  mapsLink: optionalText,
  surroundingsDescription: optionalText,
  knownSamplingDeviation: optionalText,
});

// Item 8-9: todos os campos de emissões atmosféricas são opcionais.
const atmosphericSchema = z.object({
  notes: optionalText,
  installationYear: z.enum(CHIMNEY_INSTALLATION_YEAR_VALUES).optional().nullable(),
  accessType: z.enum(CHIMNEY_ACCESS_TYPE_VALUES).optional().nullable(),
  coverage: z.enum(CHIMNEY_COVERAGE_VALUES).optional().nullable(),
  chimneyGeometry: z.enum(CHIMNEY_GEOMETRY_VALUES).optional().nullable(),
  emissionType: z.enum(ATMOSPHERIC_EMISSION_TYPE_VALUES).optional().nullable(),
  combustionType: z.enum(ATMOSPHERIC_COMBUSTION_TYPE_VALUES).optional().nullable(),
  operationalCycle: z.enum(OPERATIONAL_CYCLE_VALUES).optional().nullable(),
  geographicCoordinates: optionalText,
  processDescription: optionalText,
  rawMaterialsAndQuantities: optionalText,
  productsAndQuantities: optionalText,
  operatingDaysAndHours: optionalText,
  operatingConditions: optionalText,
  internalEquivalentDuctDiameterM: optionalText,
  upstreamDistanceM: optionalText,
  downstreamDistanceM: optionalText,
  internalLengthM: optionalText,
  internalWidthM: optionalText,
  flangeSleeveCm: optionalText,
  wallThicknessCm: optionalText,
  totalChimneyLengthM: optionalText,
  totalChimneyLengthToGroundM: optionalText,
  fuel: optionalText,
  fuelConsumption: optionalText,
  fuelConsumptionUnit: z.enum(FUEL_CONSUMPTION_UNIT_VALUES).optional().nullable(),
  nominalPowerMw: optionalText,
  pollutionControlType: optionalText,
  samplingDeviations: optionalText,
});

export const collectionPointSchema = z.object({
  clientId: z.string().min(1, "Selecione o cliente."),
  matrix: z.enum(TEST_MATRIX_VALUES, { errorMap: () => ({ message: "Selecione uma matriz válida." }) }),
  name: z.string().trim().min(2, "Informe o nome/identificação do ponto de coleta."),
  testIds: z.array(z.string()).default([]),
  legislationIds: z.array(z.string()).default([]),
  airQuality: airQualityLikeSchema.optional().nullable(),
  atmospheric: atmosphericSchema.optional().nullable(),
  noise: noiseSchema.optional().nullable(),
});

export type CollectionPointInput = z.infer<typeof collectionPointSchema>;
