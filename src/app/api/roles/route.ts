import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    await requireAnyPermission(["users.manage", "roles.manage"]);
    const roles = await prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ roles });
  } catch (error) {
    return handleApiError(error);
  }
}

const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do papel."),
  description: z.string().trim().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAnyPermission(["roles.manage"]);
    const data = parseBody(createRoleSchema, await request.json());

    const role = await prisma.role.create({ data: { name: data.name, description: data.description || null } });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Role",
      entityId: role.id,
      description: `Papel "${role.name}" criado.`,
    });

    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
