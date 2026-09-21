import { z } from "zod";

export const updateProposalTextTemplateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do texto."),
  content: z.string().trim().min(1, "Informe o conteúdo do texto."),
  active: z.boolean(),
});

export type UpdateProposalTextTemplateInput = z.infer<typeof updateProposalTextTemplateSchema>;
