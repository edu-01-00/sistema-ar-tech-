import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { epiRecordItemReturnSchema } from "@/lib/validations/employee";

// Registra a devolução de um EPI já entregue. A data de devolução é
// independente por item e pode permanecer vazia até a devolução ocorrer.
export async function PATCH(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  try {
    const session = await requirePermission("employees.epi.manage");
    const data = parseBody(epiRecordItemReturnSchema, await request.json());

    const item = await prisma.epiRecordItem.findUnique({
      where: { id: params.itemId },
      include: { epiRecord: true },
    });
    if (!item || item.epiRecord.employeeId !== params.id) throw new ApiError("Item de EPI não encontrado.", 404);

    const returnedAt = new Date(data.returnedAt);
    if (Number.isNaN(returnedAt.getTime())) throw new ApiError("Data de devolução inválida.", 422);

    const updated = await prisma.epiRecordItem.update({ where: { id: item.id }, data: { returnedAt } });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "EpiRecordItem",
      entityId: item.id,
      description: `Devolução registrada para o EPI "${item.description}".`,
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
