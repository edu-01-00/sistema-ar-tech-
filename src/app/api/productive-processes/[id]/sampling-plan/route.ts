import { NextRequest, NextResponse } from "next/server";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { samplingPlanSchema } from "@/lib/validations/productive-process";
import { createOrUpdateSamplingPlan } from "@/lib/services/productive-process-service";

// Fase 1 — Plano de Amostragem (ISO 7.3): agendamento + checklist de
// equipamentos. Os pontos monitorados já são os do próprio Processo
// Produtivo (1 ponto por processo) — não há seleção de ponto aqui.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("productive_processes.manage");
    const data = parseBody(samplingPlanSchema, await request.json());

    const scheduledAt = new Date(data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new ApiError("Data/hora agendada inválida.", 422);

    const plan = await createOrUpdateSamplingPlan(session.user.id, params.id, {
      scheduledAt,
      fieldResponsibleId: data.fieldResponsibleId,
      notes: data.notes,
      equipmentIds: data.equipmentIds,
    });
    return NextResponse.json({ samplingPlan: plan }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
