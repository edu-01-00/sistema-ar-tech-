import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { updateProposalObservationsSchema } from "@/lib/validations/proposal";
import { assertProposalEditable } from "@/lib/services/proposal-service";

// Item 24-28: seleção dos blocos de "Observações importantes" a exibir no
// documento final (nenhum, um, dois ou os três podem ser selecionados).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.manage");
    const data = parseBody(updateProposalObservationsSchema, await request.json());

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
    assertProposalEditable(proposal.status, proposal.supersededAt);

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        observationEmissoesAtmosfericas: data.observationEmissoesAtmosfericas,
        observationQualidadeAr: data.observationQualidadeAr,
        observationRuido: data.observationRuido,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Proposal",
      entityId: proposal.id,
      description: `Observações importantes da proposta ${proposal.code} atualizadas.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
