import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { getStorageDriver, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/storage";
import { buildFileDownloadResponse } from "@/lib/download-response";

// Logomarca da empresa: usada na Ordem de Serviço de EPI e em propostas.
// Substituir a logo remove o arquivo anterior do armazenamento.

export async function GET() {
  try {
    await requirePermission("company.view");
    const company = await prisma.company.findFirst();
    if (!company?.logoStorageKey) throw new ApiError("Nenhuma logomarca cadastrada.", 404);

    const buffer = await getStorageDriver().read(company.logoStorageKey);
    return buildFileDownloadResponse(buffer, company.logoFileName ?? "logo", company.logoMimeType ?? "image/png");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("company.manage");
    const company = await prisma.company.findFirst();
    if (!company) throw new ApiError("Cadastre a empresa antes de enviar a logomarca.", 422);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError("Selecione uma imagem para enviar.", 422);
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) throw new ApiError("Apenas imagens JPG ou PNG são permitidas.", 422);
    if (file.size > MAX_IMAGE_SIZE_BYTES) throw new ApiError("A imagem excede o tamanho máximo permitido (5MB).", 422);

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await getStorageDriver().save({ category: "company-logo", fileName: file.name, buffer });

    const previousKey = company.logoStorageKey;
    const updated = await prisma.company.update({
      where: { id: company.id },
      data: { logoStorageKey: storageKey, logoFileName: file.name, logoMimeType: file.type },
    });

    if (previousKey) {
      await getStorageDriver().remove(previousKey);
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Company",
      entityId: updated.id,
      description: "Logomarca da empresa atualizada.",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const session = await requirePermission("company.manage");
    const company = await prisma.company.findFirst();
    if (!company?.logoStorageKey) throw new ApiError("Nenhuma logomarca cadastrada.", 404);

    const previousKey = company.logoStorageKey;
    await prisma.company.update({
      where: { id: company.id },
      data: { logoStorageKey: null, logoFileName: null, logoMimeType: null },
    });
    await getStorageDriver().remove(previousKey);

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Company",
      entityId: company.id,
      description: "Logomarca da empresa removida.",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
