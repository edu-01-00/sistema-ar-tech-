import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { getStorageDriver, ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/storage";
import { EmployeeDocumentCategory } from "@prisma/client";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("employees.documents.manage");
    const employee = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!employee) throw new ApiError("Funcionário não encontrado.", 404);

    const formData = await request.formData();
    const file = formData.get("file");
    const category = formData.get("category");
    if (!(file instanceof File)) throw new ApiError("Selecione um arquivo PDF para enviar.", 422);
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) throw new ApiError("Apenas arquivos PDF são permitidos.", 422);
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) throw new ApiError("O arquivo excede o tamanho máximo permitido (20MB).", 422);
    if (typeof category !== "string" || !(category in EmployeeDocumentCategory)) {
      throw new ApiError("Categoria de documento inválida.", 422);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await getStorageDriver().save({ category: "employees", fileName: file.name, buffer });

    const document = await prisma.employeeDocument.create({
      data: {
        employeeId: employee.id,
        category: category as EmployeeDocumentCategory,
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
      entityType: "EmployeeDocument",
      entityId: document.id,
      description: `Documento "${file.name}" enviado para o funcionário "${employee.name}".`,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
