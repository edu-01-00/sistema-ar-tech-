import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { updateProposalCostsSchema } from "@/lib/validations/proposal";
import { assertProposalEditable, recalculateProposalTotals } from "@/lib/services/proposal-service";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.manage");
    const data = parseBody(updateProposalCostsSchema, await request.json());

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
    assertProposalEditable(proposal.status, proposal.supersededAt);

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          travelDistanceKm: data.travelDistanceKm ?? null,
          travelValuePerKm: data.travelValuePerKm ?? null,
          travelOtherCosts: data.travelOtherCosts ?? null,
        },
      });
      await tx.proposalCost.deleteMany({ where: { proposalId: proposal.id } });
      if (data.costs.length > 0) {
        await tx.proposalCost.createMany({
          data: data.costs.map((c) => ({ proposalId: proposal.id, description: c.description, value: c.value, type: c.type })),
        });
      }
      await recalculateProposalTotals(tx, proposal.id);
      await writeAuditLog(
        {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "Proposal",
          entityId: proposal.id,
          description: `Custos da proposta ${proposal.code} atualizados.`,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
