import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("measurement_units.manage");
    const existing = await prisma.measurementUnit.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Unidade de medida não encontrada.", 404);

    const unit = await prisma.measurementUnit.update({ where: { id: params.id }, data: { active: !existing.active } });

    await writeAuditLog({
      userId: session.user.id,
      action: unit.active ? "ACTIVATE" : "DEACTIVATE",
      entityType: "MeasurementUnit",
      entityId: unit.id,
      description: `Unidade de medida "${unit.name}" ${unit.active ? "reativada" : "desativada"}.`,
    });

    return NextResponse.json({ measurementUnit: unit });
  } catch (error) {
    return handleApiError(error);
  }
}
