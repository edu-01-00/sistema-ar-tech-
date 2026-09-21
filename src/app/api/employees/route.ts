import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { employeeSchema } from "@/lib/validations/employee";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("employees.view");
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const showInactive = request.nextUrl.searchParams.get("inactive") === "1";

    const employees = await prisma.employee.findMany({
      where: {
        active: showInactive ? undefined : true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { cpf: { contains: q.replace(/\D/g, "") } },
              ],
            }
          : {}),
      },
      include: { user: { select: { id: true, email: true, active: true, role: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ employees });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("employees.manage");
    const data = parseBody(employeeSchema, await request.json());

    const employee = await prisma.employee.create({
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
      action: "CREATE",
      entityType: "Employee",
      entityId: employee.id,
      description: `Funcionário "${employee.name}" cadastrado.`,
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
