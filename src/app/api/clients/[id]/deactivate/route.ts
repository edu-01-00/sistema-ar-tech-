import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("clients.manage");
    const existing = await prisma.client.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Cliente não encontrado.", 404);

    const client = await prisma.client.update({ where: { id: params.id }, data: { active: !existing.active } });

    await writeAuditLog({
      userId: session.user.id,
      action: client.active ? "ACTIVATE" : "DEACTIVATE",
      entityType: "Client",
      entityId: client.id,
      description: `Cliente "${client.corporateName}" ${client.active ? "reativado" : "desativado"}.`,
    });

    return NextResponse.json({ client });
  } catch (error) {
    return handleApiError(error);
  }
}
