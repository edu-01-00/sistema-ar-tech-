import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { getStorageDriver } from "@/lib/storage";
import { renderHtmlToPdf } from "@/lib/pdf/render";
import { buildEpiRecordHtml } from "@/lib/pdf/epi-record-template";
import { getCompanyLogoDataUri } from "@/lib/pdf/logo";

// Gera (ou regenera) o PDF da Ficha de EPI com os dados atuais do
// funcionário e os itens de EPI registrados até o momento. Pode ser
// chamada a qualquer momento (antes ou depois da assinatura, e sempre
// que novos EPIs forem adicionados).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("employees.epi.manage");

    const employee = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!employee) throw new ApiError("Funcionário não encontrado.", 404);

    const epiRecord = await prisma.epiRecord.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: { employeeId: employee.id, createdById: session.user.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    const company = await prisma.company.findFirst();
    const logoDataUri = await getCompanyLogoDataUri(company);
    const html = buildEpiRecordHtml(epiRecord, employee, company, logoDataUri);
    const pdfBuffer = await renderHtmlToPdf(html, { landscape: true });
    const storageKey = await getStorageDriver().save({
      category: "epi-records",
      fileName: `ficha-epi-${employee.id}.pdf`,
      buffer: pdfBuffer,
    });
    if (epiRecord.storageKey) await getStorageDriver().remove(epiRecord.storageKey).catch(() => undefined);

    const updated = await prisma.epiRecord.update({
      where: { id: epiRecord.id },
      data: { storageKey },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "GENERATE_PDF",
      entityType: "EpiRecord",
      entityId: epiRecord.id,
      description: `PDF da Ficha de EPI de "${employee.name}" gerado.`,
    });

    return NextResponse.json({ epiRecord: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
