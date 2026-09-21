import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { updateProposalTextTemplateSchema } from "@/lib/validations/proposal-text-template";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("settings.manage");
    const data = parseBody(updateProposalTextTemplateSchema, await request.json());

    const existing = await prisma.proposalTextTemplate.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Texto padrão não encontrado.", 404);

    const template = await prisma.proposalTextTemplate.update({
      where: { id: params.id },
      data: { name: data.name, content: data.content, active: data.active, updatedById: session.user.id },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "ProposalTextTemplate",
      entityId: template.id,
      description: `Texto padrão de proposta "${template.name}" atualizado.`,
    });

    return NextResponse.json({ template });
  } catch (error) {
    return handleApiError(error);
  }
}
