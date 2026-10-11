import { NextRequest, NextResponse } from "next/server";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { resultWorksheetSchema } from "@/lib/validations/productive-process";
import { createOrUpdateResultWorksheet } from "@/lib/services/productive-process-service";

// Fase 4 — Resultados (Folha de Trabalho): gravimetria (EA/QAR) ou leituras
// acústicas (RA), conforme a matriz do ponto de coleta do processo.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("productive_processes.manage");
    const data = parseBody(resultWorksheetSchema, await request.json());
    const worksheet = await createOrUpdateResultWorksheet(session.user.id, params.id, data);
    return NextResponse.json({ resultWorksheet: worksheet });
  } catch (error) {
    return handleApiError(error);
  }
}
