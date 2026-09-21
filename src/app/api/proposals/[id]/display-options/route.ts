import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { updateProposalDisplayOptionsSchema } from "@/lib/validations/proposal";
import { assertProposalEditable, recalculateProposalTotals } from "@/lib/services/proposal-service";

// Item 15-16: "Exibir valor unitário" e "Usar custos adicionais". A escolha
// de exibição do valor unitário nunca afeta o cálculo do total (é só
// visual); já "usar custos adicionais" afeta o total, então recalculamos
// os totais sempre que essa opção é alterada.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.manage");
    const data = parseBody(updateProposalDisplayOptionsSchema, await request.json());

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
    assertProposalEditable(proposal.status, proposal.supersededAt);

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposal.id },
        data: { exhibitUnitValue: data.exhibitUnitValue, useAdditionalCosts: data.useAdditionalCosts },
      });
      await recalculateProposalTotals(tx, proposal.id);
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Proposal",
      entityId: proposal.id,
      description: `Opções de exibição da proposta ${proposal.code} atualizadas.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
