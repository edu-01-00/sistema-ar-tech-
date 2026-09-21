import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { epiOrderAcceptSchema } from "@/lib/validations/employee";
import { getStorageDriver } from "@/lib/storage";
import { renderHtmlToPdf } from "@/lib/pdf/render";
import { buildEpiOrderHtml } from "@/lib/pdf/epi-order-template";
import { getCompanyLogoDataUri } from "@/lib/pdf/logo";

// Registra o aceite da Ordem de Serviço de EPI (declaração de concordância).
// Estrutura simples hoje (nome + data/hora), preparada para evoluir para
// assinatura eletrônica mais robusta no futuro sem quebrar o fluxo atual.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("employees.epi.manage");
    const data = parseBody(epiOrderAcceptSchema, await request.json());

    const order = await prisma.epiOrder.findUnique({
      where: { id: params.id },
      include: { items: true, employee: true },
    });
    if (!order) throw new ApiError("Ordem de serviço não encontrada.", 404);
    if (order.status === "ACEITO") throw new ApiError("Esta ordem de serviço já foi aceita.", 409);

    const acceptedAt = new Date();
    const updated = await prisma.epiOrder.update({
      where: { id: order.id },
      data: { status: "ACEITO", acceptedAt, acceptedName: data.acceptedName },
      include: { items: true, employee: true },
    });

    const company = await prisma.company.findFirst();
    const logoDataUri = await getCompanyLogoDataUri(company);
    const html = buildEpiOrderHtml(updated, updated.employee, company, logoDataUri);
    const pdfBuffer = await renderHtmlToPdf(html);
    const storageKey = await getStorageDriver().save({ category: "epi-orders", fileName: `${updated.code}.pdf`, buffer: pdfBuffer });
    if (order.storageKey) await getStorageDriver().remove(order.storageKey).catch(() => undefined);

    await prisma.epiOrder.update({ where: { id: order.id }, data: { storageKey } });

    await writeAuditLog({
      userId: session.user.id,
      action: "ACCEPT",
      entityType: "EpiOrder",
      entityId: order.id,
      description: `Ordem de serviço ${order.code} aceita por "${data.acceptedName}".`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
