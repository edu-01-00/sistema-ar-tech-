import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.enum(ALL_PERMISSION_KEYS as [string, ...string[]])),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("roles.manage");
    const data = parseBody(updateRolePermissionsSchema, await request.json());

    const role = await prisma.role.findUnique({ where: { id: params.id } });
    if (!role) throw new ApiError("Papel não encontrado.", 404);
    if (role.isSystem) throw new ApiError("As permissões do papel Administrador não podem ser alteradas.", 422);

    const permissions = await prisma.permission.findMany({ where: { key: { in: data.permissionKeys } } });

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) });
      }
      await writeAuditLog(
        {
          userId: session.user.id,
          action: "UPDATE",
          entityType: "Role",
          entityId: role.id,
          description: `Permissões do papel "${role.name}" atualizadas.`,
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
