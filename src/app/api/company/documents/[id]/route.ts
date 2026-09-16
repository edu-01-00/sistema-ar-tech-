import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { getStorageDriver } from "@/lib/storage";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("company.documents.manage");
    const document = await prisma.companyDocument.findUnique({ where: { id: params.id } });
    if (!document) throw new ApiError("Documento não encontrado.", 404);

    await prisma.companyDocument.delete({ where: { id: params.id } });
    await getStorageDriver().remove(document.storageKey);

    await writeAuditLog({
      userId: session.user.id,
      action: "DELETE",
      entityType: "CompanyDocument",
      entityId: document.id,
      description: `Documento "${document.fileName}" removido da empresa.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
