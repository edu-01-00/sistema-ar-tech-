import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { getStorageDriver, ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("company.documents.manage");
    const company = await prisma.company.findFirst();
    if (!company) throw new ApiError("Cadastre a empresa antes de enviar documentos.", 422);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError("Selecione um arquivo PDF para enviar.", 422);
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) throw new ApiError("Apenas arquivos PDF são permitidos.", 422);
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) throw new ApiError("O arquivo excede o tamanho máximo permitido (20MB).", 422);

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await getStorageDriver().save({ category: "company", fileName: file.name, buffer });

    const document = await prisma.companyDocument.create({
      data: {
        companyId: company.id,
        fileName: file.name,
        storageKey,
        mimeType: file.type,
        size: file.size,
        uploadedById: session.user.id,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "CompanyDocument",
      entityId: document.id,
      description: `Documento "${file.name}" enviado para a empresa.`,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
