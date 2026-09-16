import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("employees.manage");
    const existing = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Funcionário não encontrado.", 404);

    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: { active: !existing.active },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: employee.active ? "ACTIVATE" : "DEACTIVATE",
      entityType: "Employee",
      entityId: employee.id,
      description: `Funcionário "${employee.name}" ${employee.active ? "reativado" : "desativado"}.`,
    });

    return NextResponse.json({ employee });
  } catch (error) {
    return handleApiError(error);
  }
}
