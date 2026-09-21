import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { employeeSchema } from "@/lib/validations/employee";
import { EMPLOYEE_DOCUMENT_CATEGORY_LABELS } from "@/lib/format";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("employees.view");
    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, email: true, active: true, roleId: true, role: { select: { name: true } } } },
        documents: { orderBy: { createdAt: "desc" } },
        epiOrders: { include: { items: true }, orderBy: { issuedAt: "desc" } },
      },
    });
    if (!employee) throw new ApiError("Funcionário não encontrado.", 404);

    return NextResponse.json({
      employee: {
        ...employee,
        documents: employee.documents.map((d) => ({ ...d, categoryLabel: EMPLOYEE_DOCUMENT_CATEGORY_LABELS[d.category] })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("employees.manage");
    const data = parseBody(employeeSchema, await request.json());

    const existing = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Funcionário não encontrado.", 404);

    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: {
        name: data.name,
        cpf: data.cpf || null,
        email: data.email || null,
        phone: data.phone || null,
        position: data.position || null,
        registrationNumber: data.registrationNumber || null,
        hiredAt: data.hiredAt ? new Date(data.hiredAt) : null,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Employee",
      entityId: employee.id,
      description: `Funcionário "${employee.name}" atualizado.`,
    });

    return NextResponse.json({ employee });
  } catch (error) {
    return handleApiError(error);
  }
}
