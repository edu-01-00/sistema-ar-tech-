import { z } from "zod";

export const legislationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da legislação."),
  description: z.string().trim().optional().nullable(),
  item: z.string().trim().optional().nullable(),
  frameworkProcess: z.string().trim().optional().nullable(),
  allowedLimit: z.string().trim().optional().nullable(),
  unit: z.string().trim().optional().nullable(),
  corrections: z.string().trim().optional().nullable(),
  testIds: z.array(z.string()).default([]),
});

export type LegislationInput = z.infer<typeof legislationSchema>;
