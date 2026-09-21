import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { PROPOSAL_TEXT_DEFAULTS } from "@/lib/proposal-text-defaults";

// Restaura o texto padrão original fornecido na especificação (verbatim),
// desfazendo qualquer edição feita pelo usuário. Não afeta propostas já
// emitidas (que guardam seu próprio snapshot).
export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("settings.manage");
    const existing = await prisma.proposalTextTemplate.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Texto padrão não encontrado.", 404);

    const original = PROPOSAL_TEXT_DEFAULTS.find((d) => d.category === existing.category && d.matrix === existing.matrix);
    if (!original) throw new ApiError("Não há um texto padrão original cadastrado para restaurar.", 422);

    const template = await prisma.proposalTextTemplate.update({
      where: { id: params.id },
      data: { name: original.name, content: original.content, active: true, updatedById: session.user.id },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "ProposalTextTemplate",
      entityId: template.id,
      description: `Texto padrão de proposta "${template.name}" restaurado ao original.`,
    });

    return NextResponse.json({ template });
  } catch (error) {
    return handleApiError(error);
  }
}
