import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { legislationSchema } from "@/lib/validations/legislation";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("legislations.view");
    const legislation = await prisma.legislation.findUnique({
      where: { id: params.id },
      include: { legislationTests: { include: { test: true } } },
    });
    if (!legislation) throw new ApiError("Legislação não encontrada.", 404);
    return NextResponse.json({ legislation });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("legislations.manage");
    const data = parseBody(legislationSchema, await request.json());

    const existing = await prisma.legislation.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Legislação não encontrada.", 404);

    const legislation = await prisma.$transaction(async (tx) => {
      await tx.legislationTest.deleteMany({ where: { legislationId: params.id } });
      return tx.legislation.update({
        where: { id: params.id },
        data: {
          name: data.name,
          description: data.description || null,
          item: data.item || null,
          frameworkProcess: data.frameworkProcess || null,
          allowedLimit: data.allowedLimit || null,
          unit: data.unit || null,
          corrections: data.corrections || null,
          legislationTests: { create: data.testIds.map((testId) => ({ testId })) },
        },
      });
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Legislation",
      entityId: legislation.id,
      description: `Legislação "${legislation.name}" atualizada.`,
    });

    return NextResponse.json({ legislation });
  } catch (error) {
    return handleApiError(error);
  }
}
