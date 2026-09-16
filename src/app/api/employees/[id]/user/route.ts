import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { createEmployeeUserSchema, updateEmployeeUserSchema } from "@/lib/validations/employee";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("users.manage");
    const data = parseBody(createEmployeeUserSchema, await request.json());

    const employee = await prisma.employee.findUnique({ where: { id: params.id }, include: { user: true } });
    if (!employee) throw new ApiError("Funcionário não encontrado.", 404);
    if (employee.user) throw new ApiError("Este funcionário já possui um usuário de acesso.", 409);

    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new ApiError("Nível de acesso inválido.", 422);

    const user = await prisma.user.create({
      data: {
        name: employee.name,
        email: data.email.toLowerCase().trim(),
        passwordHash: await bcrypt.hash(data.password, 10),
        roleId: data.roleId,
        employeeId: employee.id,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      description: `Usuário de acesso criado para o funcionário "${employee.name}".`,
    });

    return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("users.manage");
    const data = parseBody(updateEmployeeUserSchema, await request.json());

    const employee = await prisma.employee.findUnique({ where: { id: params.id }, include: { user: true } });
    if (!employee?.user) throw new ApiError("Este funcionário não possui usuário de acesso.", 404);

    const user = await prisma.user.update({
      where: { id: employee.user.id },
      data: {
        roleId: data.roleId,
        active: data.active,
        passwordHash: data.password ? await bcrypt.hash(data.password, 10) : undefined,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: user.id,
      description: `Usuário de acesso do funcionário "${employee.name}" atualizado.`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
