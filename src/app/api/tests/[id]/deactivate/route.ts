import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("tests.manage");
    const existing = await prisma.test.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Ensaio não encontrado.", 404);

    const test = await prisma.test.update({ where: { id: params.id }, data: { active: !existing.active } });

    await writeAuditLog({
      userId: session.user.id,
      action: test.active ? "ACTIVATE" : "DEACTIVATE",
      entityType: "Test",
      entityId: test.id,
      description: `Ensaio "${test.name}" ${test.active ? "reativado" : "desativado"}.`,
    });

    return NextResponse.json({ test });
  } catch (error) {
    return handleApiError(error);
  }
}
