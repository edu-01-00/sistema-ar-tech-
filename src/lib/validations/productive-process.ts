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
