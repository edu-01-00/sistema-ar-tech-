import { z } from "zod";

export const measurementUnitSchema = z.object({
  name: z.string().trim().min(1, "Informe a unidade de medida."),
});

export type MeasurementUnitInput = z.infer<typeof measurementUnitSchema>;
