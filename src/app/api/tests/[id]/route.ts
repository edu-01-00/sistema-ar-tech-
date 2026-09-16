import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { testUpdateSchema } from "@/lib/validations/test";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("tests.view");
    const test = await prisma.test.findUnique({ where: { id: params.id } });
    if (!test) throw new ApiError("Ensaio não encontrado.", 404);
    return NextResponse.json({ test });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tests.manage");
    const data = parseBody(testUpdateSchema, await request.json());

    const existing = await prisma.test.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Ensaio não encontrado.", 404);

    const test = await prisma.test.update({
      where: { id: params.id },
      data: {
        name: data.name,
        method: data.method,
        cas: data.cas || null,
        quantificationLimit: data.quantificationLimit || null,
        isSubcontracted: data.isSubcontracted,
        isAccredited: data.isAccredited,
        unit: data.unit,
        value: data.value,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Test",
      entityId: test.id,
      description: `Ensaio "${test.name}" (${test.parameterCode}) atualizado.`,
    });

    return NextResponse.json({ test });
  } catch (error) {
    return handleApiError(error);
  }
}
