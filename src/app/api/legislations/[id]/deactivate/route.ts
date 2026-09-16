import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("legislations.manage");
    const existing = await prisma.legislation.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Legislação não encontrada.", 404);

    const legislation = await prisma.legislation.update({ where: { id: params.id }, data: { active: !existing.active } });

    await writeAuditLog({
      userId: session.user.id,
      action: legislation.active ? "ACTIVATE" : "DEACTIVATE",
      entityType: "Legislation",
      entityId: legislation.id,
      description: `Legislação "${legislation.name}" ${legislation.active ? "reativada" : "desativada"}.`,
    });

    return NextResponse.json({ legislation });
  } catch (error) {
    return handleApiError(error);
  }
}
