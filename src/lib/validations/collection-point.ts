import { z } from "zod";
import { TEST_MATRIX_VALUES } from "@/lib/validations/test";

export const collectionPointSchema = z.object({
  clientId: z.string().min(1, "Selecione o cliente."),
  matrix: z.enum(TEST_MATRIX_VALUES, { errorMap: () => ({ message: "Selecione uma matriz válida." }) }),
  name: z.string().trim().min(2, "Informe o nome/identificação do ponto de coleta."),
  testIds: z.array(z.string()).default([]),
  legislationIds: z.array(z.string()).default([]),
  airQuality: z
    .object({
      location: z.string().trim().optional().nullable(),
      gpsLatitude: z.string().trim().optional().nullable(),
      gpsLongitude: z.string().trim().optional().nullable(),
      mapsLink: z.string().trim().optional().nullable(),
      surroundingsDescription: z.string().trim().optional().nullable(),
      knownSamplingDeviation: z.string().trim().optional().nullable(),
    })
    .optional()
    .nullable(),
  atmosphericNotes: z.string().trim().optional().nullable(),
  noiseNotes: z.string().trim().optional().nullable(),
});

export type CollectionPointInput = z.infer<typeof collectionPointSchema>;
