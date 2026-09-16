import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { updateProposalCollectionPointsSchema } from "@/lib/validations/proposal";
import { assertProposalEditable } from "@/lib/services/proposal-service";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.manage");
    const data = parseBody(updateProposalCollectionPointsSchema, await request.json());

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
    assertProposalEditable(proposal.status, proposal.supersededAt);

    const points = await prisma.collectionPoint.findMany({ where: { id: { in: data.collectionPointIds } } });
    if (points.length !== data.collectionPointIds.length) throw new ApiError("Um ou mais pontos de coleta não foram encontrados.", 404);
    if (points.some((p) => p.clientId !== proposal.clientId)) {
      throw new ApiError("Não é permitido selecionar um ponto de coleta de outro cliente.", 422);
    }

    await prisma.$transaction(async (tx) => {
      await tx.proposalCollectionPoint.deleteMany({ where: { proposalId: proposal.id } });
      await tx.proposalCollectionPoint.createMany({
        data: data.collectionPointIds.map((collectionPointId) => ({ proposalId: proposal.id, collectionPointId })),
      });
      await writeAuditLog(
        {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "Proposal",
          entityId: proposal.id,
          description: `Pontos de coleta da proposta ${proposal.code} atualizados.`,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
