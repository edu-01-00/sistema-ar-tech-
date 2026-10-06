import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { epiRecordItemSchema } from "@/lib/validations/employee";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("employees.epi.manage");
    const data = parseBody(epiRecordItemSchema, await request.json());

    const employee = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!employee) throw new ApiError("Funcionário não encontrado.", 404);

    const deliveredAt = new Date(data.deliveredAt);
    if (Number.isNaN(deliveredAt.getTime())) throw new ApiError("Data de entrega inválida.", 422);

    let returnedAt: Date | null = null;
    if (data.returnedAt) {
      returnedAt = new Date(data.returnedAt);
      if (Number.isNaN(returnedAt.getTime())) throw new ApiError("Data de devolução inválida.", 422);
    }

    const epiRecord = await prisma.epiRecord.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: { employeeId: employee.id, createdById: session.user.id },
    });

    const item = await prisma.epiRecordItem.create({
      data: {
        epiRecordId: epiRecord.id,
        description: data.description,
        quantity: data.quantity,
        caNumber: data.caNumber || null,
        deliveredAt,
        returnedAt,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "EpiRecordItem",
      entityId: item.id,
      description: `EPI "${item.description}" registrado na Ficha de EPI de "${employee.name}".`,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
