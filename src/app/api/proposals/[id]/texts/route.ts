import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { updateProposalTextsSchema } from "@/lib/validations/proposal";
import { assertProposalEditable } from "@/lib/services/proposal-service";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.manage");
    const data = parseBody(updateProposalTextsSchema, await request.json());

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
    assertProposalEditable(proposal.status, proposal.supersededAt);

    await prisma.$transaction(async (tx) => {
      for (const text of data.texts) {
        await tx.proposalText.upsert({
          where: { proposalId_matrix: { proposalId: proposal.id, matrix: text.matrix } },
          create: { proposalId: proposal.id, matrix: text.matrix, content: text.content },
          update: { content: text.content },
        });
      }
      await writeAuditLog(
        {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "Proposal",
          entityId: proposal.id,
          description: `Textos técnicos da proposta ${proposal.code} atualizados.`,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
