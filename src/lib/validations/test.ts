import { z } from "zod";

export const TEST_MATRIX_VALUES = ["EMISSOES_ATMOSFERICAS", "QUALIDADE_AR", "RUIDO_AMBIENTAL"] as const;

export const testSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do ensaio."),
  method: z.string().trim().min(1, "Informe o método."),
  cas: z.string().trim().optional().nullable(),
  quantificationLimit: z.string().trim().optional().nullable(),
  isSubcontracted: z.boolean().default(false),
  isAccredited: z.boolean().default(false),
  unit: z.string().trim().min(1, "Informe a unidade de medida."),
  value: z.coerce.number().min(0, "O valor não pode ser negativo."),
  matrix: z.enum(TEST_MATRIX_VALUES, { errorMap: () => ({ message: "Selecione uma matriz válida." }) }),
});

export type TestInput = z.infer<typeof testSchema>;

// A matriz define o prefixo do código do parâmetro (gerado automaticamente
// na criação), então não é editável depois de cadastrado o ensaio.
export const testUpdateSchema = testSchema.omit({ matrix: true });
export type TestUpdateInput = z.infer<typeof testUpdateSchema>;
