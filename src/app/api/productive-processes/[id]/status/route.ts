import { NextRequest, NextResponse } from "next/server";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { transitionProductiveProcessStatusSchema } from "@/lib/validations/productive-process";
import { transitionProductiveProcessStatus } from "@/lib/services/productive-process-service";

// Transições explícitas do ciclo de vida técnico (ISO 17025): marcar coleta
// em campo concluída, validar resultados ou cancelar. As demais transições
// acontecem automaticamente ao registrar os dados de cada fase.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("productive_processes.manage");
    const data = parseBody(transitionProductiveProcessStatusSchema, await request.json());
    const productiveProcess = await transitionProductiveProcessStatus(session.user.id, params.id, data.status);
    return NextResponse.json({ productiveProcess });
  } catch (error) {
    return handleApiError(error);
  }
}
