import { NextRequest, NextResponse } from "next/server";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { custodyEntrySchema } from "@/lib/validations/productive-process";
import { createOrUpdateCustodyEntry } from "@/lib/services/productive-process-service";

// Fase 2 — Entrada e Custódia (ISO 7.4): chegada ao laboratório (ou
// conclusão da medição in situ), responsável pelo registro e condições
// climáticas de campo.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("productive_processes.manage");
    const data = parseBody(custodyEntrySchema, await request.json());

    const arrivedAt = new Date(data.arrivedAt);
    if (Number.isNaN(arrivedAt.getTime())) throw new ApiError("Data/hora de chegada inválida.", 422);

    const entry = await createOrUpdateCustodyEntry(session.user.id, params.id, {
      arrivedAt,
      weatherConditions: data.weatherConditions,
      temperatureC: data.temperatureC,
      humidityPercent: data.humidityPercent,
    });
    return NextResponse.json({ custodyEntry: entry }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
