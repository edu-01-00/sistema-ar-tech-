import { NextRequest, NextResponse } from "next/server";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { sampleAcceptanceSchema } from "@/lib/validations/productive-process";
import { createOrUpdateSampleAcceptance } from "@/lib/services/productive-process-service";

// Fase 3 — Checagem e Aceitação (ISO 7.4): critérios de aceitação e
// registro de anomalias/desvios quando rejeitada ou aceita com ressalvas.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("productive_processes.manage");
    const data = parseBody(sampleAcceptanceSchema, await request.json());
    const acceptance = await createOrUpdateSampleAcceptance(session.user.id, params.id, data);
    return NextResponse.json({ sampleAcceptance: acceptance }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
