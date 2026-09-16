import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { updateProposalTestsSchema } from "@/lib/validations/proposal";
import { assertProposalEditable, recalculateProposalTotals } from "@/lib/services/proposal-service";

// Cada ensaio selecionado na proposta é salvo como um "snapshot" (nome,
// método, unidade, código e valor no momento da proposta). Alterar o valor
// aqui nunca modifica o cadastro geral do ensaio (Test.value permanece
// intocado) — ver regra 8 dos requisitos do sistema.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.manage");
    const data = parseBody(updateProposalTestsSchema, await request.json());

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
    assertProposalEditable(proposal.status, proposal.supersededAt);

    const testIds = [...new Set(data.tests.map((t) => t.testId))];
    const tests = await prisma.test.findMany({ where: { id: { in: testIds } } });
    if (tests.length !== testIds.length) throw new ApiError("Um ou mais ensaios não foram encontrados.", 404);
    const testById = new Map(tests.map((t) => [t.id, t]));

    await prisma.$transaction(async (tx) => {
      await tx.proposalTest.deleteMany({ where: { proposalId: proposal.id } });
      if (data.tests.length > 0) {
        await tx.proposalTest.createMany({
          data: data.tests.map((t) => {
            const test = testById.get(t.testId)!;
            return {
              proposalId: proposal.id,
              testId: t.testId,
              collectionPointId: t.collectionPointId,
              nameSnapshot: test.name,
              methodSnapshot: test.method,
              unitSnapshot: test.unit,
              codeSnapshot: test.parameterCode,
              valueSnapshot: t.value,
              quantity: t.quantity,
            };
          }),
        });
      }
      await recalculateProposalTotals(tx, proposal.id);
      await writeAuditLog(
        {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "Proposal",
          entityId: proposal.id,
          description: `Ensaios da proposta ${proposal.code} atualizados.`,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
