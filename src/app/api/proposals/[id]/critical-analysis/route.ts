import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { updateProposalCriticalAnalysisSchema } from "@/lib/validations/proposal";
import { assertProposalEditable } from "@/lib/services/proposal-service";

// Análise crítica/confirmação da proposta: 4 itens verificados
// individualmente (não aparecem no PDF). A confirmação geral
// (criticalAnalysisConfirmed, usada em "ANALISADO CRITICAMENTE POR") só é
// considerada válida quando os 4 itens estão marcados.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.manage");
    const data = parseBody(updateProposalCriticalAnalysisSchema, await request.json());

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
    assertProposalEditable(proposal.status, proposal.supersededAt);

    const allConfirmed = data.criticalAnalysisReq1 && data.criticalAnalysisReq2 && data.criticalAnalysisReq3 && data.criticalAnalysisReq4;

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: allConfirmed
        ? {
            criticalAnalysisReq1: true,
            criticalAnalysisReq2: true,
            criticalAnalysisReq3: true,
            criticalAnalysisReq4: true,
            criticalAnalysisConfirmed: true,
            criticalAnalysisById: session.user.id,
            criticalAnalysisAt: new Date(),
          }
        : {
            criticalAnalysisReq1: data.criticalAnalysisReq1,
            criticalAnalysisReq2: data.criticalAnalysisReq2,
            criticalAnalysisReq3: data.criticalAnalysisReq3,
            criticalAnalysisReq4: data.criticalAnalysisReq4,
            criticalAnalysisConfirmed: false,
            criticalAnalysisById: null,
            criticalAnalysisAt: null,
          },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Proposal",
      entityId: proposal.id,
      description: allConfirmed
        ? `Análise crítica da proposta ${proposal.code} confirmada.`
        : `Análise crítica da proposta ${proposal.code} atualizada (pendente).`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
