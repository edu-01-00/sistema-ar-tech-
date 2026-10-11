import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("productive_processes.manage");
    const existing = await prisma.equipment.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Equipamento não encontrado.", 404);

    const equipment = await prisma.equipment.update({ where: { id: params.id }, data: { active: !existing.active } });

    await writeAuditLog({
      userId: session.user.id,
      action: equipment.active ? "ACTIVATE" : "DEACTIVATE",
      entityType: "Equipment",
      entityId: equipment.id,
      description: `Equipamento "${equipment.name}" ${equipment.active ? "reativado" : "desativado"}.`,
    });

    return NextResponse.json({ equipment });
  } catch (error) {
    return handleApiError(error);
  }
}
