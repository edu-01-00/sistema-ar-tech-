import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { getStorageDriver } from "@/lib/storage";

export async function DELETE(_request: Request, { params }: { params: { id: string; docId: string } }) {
  try {
    const session = await requirePermission("employees.documents.manage");
    const document = await prisma.employeeDocument.findUnique({ where: { id: params.docId, employeeId: params.id } });
    if (!document) throw new ApiError("Documento não encontrado.", 404);

    await prisma.employeeDocument.delete({ where: { id: document.id } });
    await getStorageDriver().remove(document.storageKey);

    await writeAuditLog({
      userId: session.user.id,
      action: "DELETE",
      entityType: "EmployeeDocument",
      entityId: document.id,
      description: `Documento "${document.fileName}" removido do funcionário.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
