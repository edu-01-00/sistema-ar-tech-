import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { epiOrderSchema } from "@/lib/validations/employee";
import { generateEpiOrderCode } from "@/lib/services/epi-service";
import { getStorageDriver } from "@/lib/storage";
import { renderHtmlToPdf } from "@/lib/pdf/render";
import { buildEpiOrderHtml } from "@/lib/pdf/epi-order-template";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("employees.epi.manage");
    const data = parseBody(epiOrderSchema, await request.json());

    const employee = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!employee) throw new ApiError("Funcionário não encontrado.", 404);

    const epis = await prisma.epi.findMany({ where: { id: { in: data.epiIds } } });
    if (epis.length !== data.epiIds.length) throw new ApiError("Um ou mais EPIs selecionados não foram encontrados.", 404);

    const company = await prisma.company.findFirst();

    const order = await prisma.$transaction(async (tx) => {
      const code = await generateEpiOrderCode(tx);
      const created = await tx.epiOrder.create({
        data: {
          code,
          employeeId: employee.id,
          createdById: session.user.id,
          items: { create: epis.map((epi) => ({ epiId: epi.id, nameSnapshot: epi.name })) },
        },
        include: { items: true },
      });

      await writeAuditLog(
        {
          userId: session.user.id,
          action: "CREATE",
          entityType: "EpiOrder",
          entityId: created.id,
          description: `Ordem de serviço de EPI ${code} gerada para "${employee.name}".`,
        },
        tx,
      );

      return created;
    });

    const html = buildEpiOrderHtml(order, employee, company);
    const pdfBuffer = await renderHtmlToPdf(html);
    const storageKey = await getStorageDriver().save({ category: "epi-orders", fileName: `${order.code}.pdf`, buffer: pdfBuffer });
    const updated = await prisma.epiOrder.update({ where: { id: order.id }, data: { storageKey }, include: { items: true } });

    return NextResponse.json({ epiOrder: updated }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
