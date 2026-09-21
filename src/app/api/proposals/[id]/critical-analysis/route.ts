import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { updateProposalCriticalAnalysisSchema } from "@/lib/validations/proposal";
import { assertProposalEditable } from "@/lib/services/proposal-service";

// Item 32-33: análise crítica/confirmação da proposta. Registra quem
// confirmou e quando — usado no documento final ("ANALISADO CRITICAMENTE POR").
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.manage");
    const data = parseBody(updateProposalCriticalAnalysisSchema, await request.json());

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
    assertProposalEditable(proposal.status, proposal.supersededAt);

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: data.criticalAnalysisConfirmed
        ? { criticalAnalysisConfirmed: true, criticalAnalysisById: session.user.id, criticalAnalysisAt: new Date() }
        : { criticalAnalysisConfirmed: false, criticalAnalysisById: null, criticalAnalysisAt: null },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Proposal",
      entityId: proposal.id,
      description: data.criticalAnalysisConfirmed
        ? `Análise crítica da proposta ${proposal.code} confirmada.`
        : `Análise crítica da proposta ${proposal.code} desfeita.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
