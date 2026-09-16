import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { getStorageDriver } from "@/lib/storage";
import { buildFileDownloadResponse } from "@/lib/download-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("company.view");
    const document = await prisma.companyDocument.findUnique({ where: { id: params.id } });
    if (!document) throw new ApiError("Documento não encontrado.", 404);

    const buffer = await getStorageDriver().read(document.storageKey);
    return buildFileDownloadResponse(buffer, document.fileName, document.mimeType);
  } catch (error) {
    return handleApiError(error);
  }
}
