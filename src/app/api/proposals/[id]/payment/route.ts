import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { updateProposalPaymentSchema } from "@/lib/validations/proposal";
import { assertProposalEditable } from "@/lib/services/proposal-service";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.manage");
    const data = parseBody(updateProposalPaymentSchema, await request.json());

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
    assertProposalEditable(proposal.status, proposal.supersededAt);

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        paymentMethod: data.paymentMethod,
        installments: data.paymentMethod === "PARCELADO" ? data.installments : null,
        paymentTerm: data.paymentTerm ?? null,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Proposal",
      entityId: proposal.id,
      description: `Forma de pagamento da proposta ${proposal.code} definida.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
