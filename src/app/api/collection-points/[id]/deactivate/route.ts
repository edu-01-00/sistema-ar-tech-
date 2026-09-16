import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("collection_points.manage");
    const existing = await prisma.collectionPoint.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Ponto de coleta não encontrado.", 404);

    const point = await prisma.collectionPoint.update({ where: { id: params.id }, data: { active: !existing.active } });

    await writeAuditLog({
      userId: session.user.id,
      action: point.active ? "ACTIVATE" : "DEACTIVATE",
      entityType: "CollectionPoint",
      entityId: point.id,
      description: `Ponto de coleta "${point.name}" ${point.active ? "reativado" : "desativado"}.`,
    });

    return NextResponse.json({ collectionPoint: point });
  } catch (error) {
    return handleApiError(error);
  }
}
