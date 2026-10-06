import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { getStorageDriver } from "@/lib/storage";
import { buildFileDownloadResponse } from "@/lib/download-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("employees.epi.manage");
    const epiRecord = await prisma.epiRecord.findUnique({ where: { employeeId: params.id } });
    if (!epiRecord?.storageKey) throw new ApiError("Documento não encontrado. Gere o PDF antes de baixar.", 404);

    const buffer = await getStorageDriver().read(epiRecord.storageKey);
    return buildFileDownloadResponse(buffer, `ficha-epi.pdf`, "application/pdf");
  } catch (error) {
    return handleApiError(error);
  }
}
