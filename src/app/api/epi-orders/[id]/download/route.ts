import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { getStorageDriver } from "@/lib/storage";
import { buildFileDownloadResponse } from "@/lib/download-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("employees.epi.manage");
    const order = await prisma.epiOrder.findUnique({ where: { id: params.id } });
    if (!order?.storageKey) throw new ApiError("Documento não encontrado.", 404);

    const buffer = await getStorageDriver().read(order.storageKey);
    return buildFileDownloadResponse(buffer, `${order.code}.pdf`, "application/pdf");
  } catch (error) {
    return handleApiError(error);
  }
}
