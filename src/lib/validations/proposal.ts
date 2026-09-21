import { z } from "zod";
import { TEST_MATRIX_VALUES } from "@/lib/validations/test";

export const PAYMENT_METHOD_VALUES = ["A_VISTA", "PARCELADO", "BOLETO", "DEPOSITO_PIX"] as const;
export const PAYMENT_TERM_VALUES = ["DIAS_15", "DIAS_30", "DIAS_15_30", "DIAS_30_60_90"] as const;

export const createProposalSchema = z.object({
  clientId: z.string().min(1, "Selecione o cliente."),
  matrices: z.array(z.enum(TEST_MATRIX_VALUES)).min(1, "Selecione ao menos uma matriz."),
  contactIds: z.array(z.string()).default([]),
  // Item 15-16: escolhidos no início da criação da proposta.
  exhibitUnitValue: z.boolean().default(true),
  useAdditionalCosts: z.boolean().default(true),
});
export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const updateProposalGeneralSchema = z.object({
  clientId: z.string().min(1, "Selecione o cliente.").optional(),
  matrices: z.array(z.enum(TEST_MATRIX_VALUES)).min(1, "Selecione ao menos uma matriz.").optional(),
  contactIds: z.array(z.string()).optional(),
});

export const updateProposalCollectionPointsSchema = z.object({
  collectionPointIds: z.array(z.string()).min(1, "Selecione ao menos um ponto de coleta."),
});

export const proposalTestItemSchema = z.object({
  testId: z.string().min(1),
  collectionPointId: z.string().min(1),
  quantity: z.coerce.number().int("Quantidade deve ser um número inteiro.").min(0, "A quantidade não pode ser negativa."),
  value: z.coerce.number().min(0, "O valor não pode ser negativo."),
});

export const updateProposalTestsSchema = z.object({
  tests: z.array(proposalTestItemSchema),
});

export const proposalCostItemSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição do custo."),
  value: z.coerce.number().min(0, "O valor não pode ser negativo."),
  type: z.enum(["ART", "OUTRO"]).default("OUTRO"),
});

export const updateProposalCostsSchema = z.object({
  travelDistanceKm: z.coerce.number().min(0).optional().nullable(),
  travelValuePerKm: z.coerce.number().min(0).optional().nullable(),
  travelOtherCosts: z.coerce.number().min(0).optional().nullable(),
  costs: z.array(proposalCostItemSchema).default([]),
});

export const updateProposalPaymentSchema = z
  .object({
    paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
    installments: z.coerce.number().int().min(2).max(60).optional().nullable(),
    paymentTerm: z.enum(PAYMENT_TERM_VALUES).optional().nullable(),
  })
  .refine((data) => data.paymentMethod !== "PARCELADO" || (data.installments ?? 0) >= 2, {
    message: "Informe a quantidade de parcelas (mínimo 2).",
    path: ["installments"],
  });

export const updateProposalDisplayOptionsSchema = z.object({
  exhibitUnitValue: z.boolean(),
  useAdditionalCosts: z.boolean(),
});

export const updateProposalObservationsSchema = z.object({
  observationEmissoesAtmosfericas: z.boolean(),
  observationQualidadeAr: z.boolean(),
  observationRuido: z.boolean(),
});

export const updateProposalCriticalAnalysisSchema = z.object({
  criticalAnalysisConfirmed: z.boolean(),
});

export const updateProposalTextsSchema = z.object({
  texts: z.array(
    z.object({
      matrix: z.enum(TEST_MATRIX_VALUES),
      content: z.string(),
    }),
  ),
});

export const updateProposalAdditionalInfoSchema = z.object({
  additionalInfo: z.string().optional().nullable(),
});

export const PROPOSAL_STATUS_VALUES = ["EM_ELABORACAO", "ENVIADA", "APROVADA", "NAO_APROVADA", "CANCELADA"] as const;

export const updateProposalStatusSchema = z.object({
  status: z.enum(PROPOSAL_STATUS_VALUES),
});

// Transições de status permitidas — evita pular etapas do fluxo comercial
// (ex: ir direto de "em elaboração" para "aprovada" sem passar por "enviada").
export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  EM_ELABORACAO: ["ENVIADA", "CANCELADA"],
  ENVIADA: ["APROVADA", "NAO_APROVADA", "CANCELADA"],
  APROVADA: ["CANCELADA"],
  NAO_APROVADA: ["EM_ELABORACAO", "CANCELADA"],
  CANCELADA: [],
};
