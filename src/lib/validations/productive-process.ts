import { z } from "zod";

export const createProductiveProcessSchema = z.object({
  collectionPointId: z.string().min(1, "Selecione o ponto de coleta."),
});

// Mesma regra de quantidade já usada para os ensaios da proposta
// (proposalTestItemSchema, em validations/proposal.ts): inteiro, não negativo.
export const serviceOrderItemSchema = z.object({
  proposalTestId: z.string().min(1),
  quantity: z.coerce.number().int("Quantidade deve ser um número inteiro.").min(0, "A quantidade não pode ser negativa."),
});

export const createServiceOrderSchema = z.object({
  items: z.array(serviceOrderItemSchema).min(1, "Selecione ao menos um parâmetro."),
});

// =========================================================================
// CAMPANHA DE MONITORAMENTO — execução técnica (ISO/IEC 17025)
// =========================================================================

export const PRODUCTIVE_PROCESS_EXPLICIT_STATUS_VALUES = ["EM_CAMPO", "VALIDADO", "CANCELADO"] as const;

export const transitionProductiveProcessStatusSchema = z.object({
  status: z.enum(PRODUCTIVE_PROCESS_EXPLICIT_STATUS_VALUES),
});

export const samplingPlanSchema = z.object({
  scheduledAt: z.string().trim().min(1, "Informe a data/hora agendada."),
  fieldResponsibleId: z.string().min(1, "Selecione o responsável técnico pela ida a campo."),
  notes: z.string().trim().optional().nullable(),
  equipmentIds: z.array(z.string()).default([]),
});

export const custodyEntrySchema = z.object({
  arrivedAt: z.string().trim().min(1, "Informe a data/hora de chegada."),
  weatherConditions: z.string().trim().optional().nullable(),
  temperatureC: z.coerce.number().optional().nullable(),
  humidityPercent: z.coerce.number().min(0).max(100).optional().nullable(),
});

export const ACCEPTANCE_STATUS_VALUES = ["ACEITA", "ACEITA_COM_RESSALVAS", "REJEITADA"] as const;

export const sampleAcceptanceSchema = z.object({
  status: z.enum(ACCEPTANCE_STATUS_VALUES),
  filtersIntegrityOk: z.boolean().default(true),
  sealsIntegrityOk: z.boolean().default(true),
  absorbentSolutionOk: z.boolean().default(true),
  deviationNotes: z.string().trim().optional().nullable(),
});

export const resultWorksheetGravimetrySchema = z.object({
  filterWeightBefore: z.coerce.number().optional().nullable(),
  filterWeightAfter: z.coerce.number().optional().nullable(),
  fieldBlankWeight: z.coerce.number().optional().nullable(),
  labReadingValue: z.coerce.number().optional().nullable(),
  sampledVolumeM3: z.coerce.number().optional().nullable(),
});

export const resultWorksheetAcousticSchema = z.object({
  leqDba: z.coerce.number().optional().nullable(),
  l10Dba: z.coerce.number().optional().nullable(),
  l90Dba: z.coerce.number().optional().nullable(),
  backgroundNoiseDba: z.coerce.number().optional().nullable(),
  measurementMinutes: z.coerce.number().int().min(0).optional().nullable(),
});

export const resultWorksheetSchema = z.object({
  gravimetry: resultWorksheetGravimetrySchema.optional(),
  acoustic: resultWorksheetAcousticSchema.optional(),
});

export const equipmentSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do equipamento."),
  serialNumber: z.string().trim().optional().nullable(),
  calibrationCertificate: z.string().trim().optional().nullable(),
  calibrationValidUntil: z.string().trim().optional().nullable(),
});
